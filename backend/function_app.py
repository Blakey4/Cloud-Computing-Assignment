import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import azure.functions as func
from azure.data.tables import TableServiceClient
from azure.storage.queue import QueueClient

app = func.FunctionApp()


def utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def env(name: str, default: Optional[str] = None) -> str:
    value = os.getenv(name, default)
    if value is None or str(value).strip() == "":
        raise ValueError(f"Missing environment variable: {name}")
    return value


def clean_str(x: Any) -> str:
    return x.strip() if isinstance(x, str) else ""


def parse_json(req: func.HttpRequest) -> Optional[Dict[str, Any]]:
    try:
        return req.get_json()
    except Exception:
        return None


def cors_headers(req: func.HttpRequest) -> Dict[str, str]:
    allowed = os.getenv("ALLOWED_ORIGINS", "*").strip()
    origin = (req.headers.get("Origin") or "").strip()

    headers = {
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    }

    if allowed == "*":
        headers["Access-Control-Allow-Origin"] = "*"
        return headers

    allow_list = [o.strip() for o in allowed.split(",") if o.strip()]
    if origin and origin in allow_list:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Vary"] = "Origin"
        return headers

    headers["Access-Control-Allow-Origin"] = allow_list[0] if allow_list else "*"
    return headers


def json_response(req: func.HttpRequest, payload: Any, status_code: int = 200) -> func.HttpResponse:
    headers = {"Content-Type": "application/json"}
    headers.update(cors_headers(req))
    return func.HttpResponse(json.dumps(payload), status_code=status_code, headers=headers)


def options_response(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse("", status_code=204, headers=cors_headers(req))


def table_client(table_name: str):
    conn = env("STORAGE_CONNECTION_STRING")
    service = TableServiceClient.from_connection_string(conn_str=conn)
    return service.get_table_client(table_name=table_name)


def queue_client(queue_name: str) -> QueueClient:
    conn = env("STORAGE_CONNECTION_STRING")
    return QueueClient.from_connection_string(conn_str=conn, queue_name=queue_name)


def log_invalid(reason: str, payload: Any) -> None:
    try:
        q_name = os.getenv("INVALID_QUEUE_NAME", "invalid-requests")
        q = queue_client(q_name)
        q.create_queue()
        msg = {"reason": reason, "payload": payload, "at": utc_iso()}
        q.send_message(json.dumps(msg))
    except Exception:
        pass


def parse_int(x: Any, minimum: int) -> Optional[int]:
    try:
        v = int(x)
        if v < minimum:
            return None
        return v
    except Exception:
        return None


def parse_float(x: Any, minimum: float) -> Optional[float]:
    try:
        v = float(x)
        if v < minimum:
            return None
        return v
    except Exception:
        return None


def estimate_delivery_minutes(items: List[Dict[str, Any]]) -> int:
    prep_sum = sum(int(i.get("prepMinutes", 0)) for i in items)

    restaurants = set()
    for i in items:
        r = clean_str(i.get("restaurantName"))
        if r:
            restaurants.add(r)

    fixed_pickup = 10
    fixed_delivery = 15
    extra_per_additional_restaurant = 7
    extra = max(0, len(restaurants) - 1) * extra_per_additional_restaurant

    return prep_sum + fixed_pickup + fixed_delivery + extra


@app.function_name(name="GetMealsByArea")
@app.route(route="meals", methods=["GET", "POST", "OPTIONS"])
def meals(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return options_response(req)

    meals_table = table_client(env("MEALS_TABLE_NAME", "Meals"))
    restaurants_table = table_client(env("RESTAURANTS_TABLE_NAME", "Restaurants"))

    # GET /api/meals?area=Central
    if req.method == "GET":
        area = clean_str(req.params.get("area")) or clean_str(req.params.get("deliveryArea"))
        if not area:
            log_invalid("Missing area in GET /meals", {"query": dict(req.params)})
            return json_response(req, {"error": "Missing required query param: area"}, 400)

        results: List[Dict[str, Any]] = []
        for e in meals_table.query_entities(query_filter=f"PartitionKey eq '{area}'"):
            results.append(
                {
                    "mealId": e.get("RowKey"),
                    "area": e.get("PartitionKey"),
                    "restaurantName": e.get("restaurantName", ""),
                    "dishName": e.get("dishName", ""),
                    "description": e.get("description", ""),
                    "prepMinutes": int(e.get("prepMinutes", 0)),
                    "price": float(e.get("price", 0.0)),
                    "imageUrl": e.get("imageUrl", "")
                }
            )

        return json_response(req, {"meals": results})

    # POST /api/meals  (Restaurant publishes a meal)
    body = parse_json(req)
    if body is None:
        log_invalid("Invalid JSON in POST /meals", {"raw": req.get_body().decode("utf-8", errors="ignore")})
        return json_response(req, {"error": "Invalid JSON body"}, 400)

    area = clean_str(body.get("area"))
    restaurant_name = clean_str(body.get("restaurantName"))
    dish_name = clean_str(body.get("dishName"))
    description = clean_str(body.get("description"))
    prep_minutes = parse_int(body.get("prepMinutes"), 1)
    price = parse_float(body.get("price"), 0.0)
    image_url = clean_str(body.get("imageUrl"))

    if not area or not restaurant_name or not dish_name:
        log_invalid("Missing required fields in POST /meals", body)
        return json_response(req, {"error": "Required: area, restaurantName, dishName"}, 400)

    if prep_minutes is None or price is None:
        log_invalid("Invalid prepMinutes or price in POST /meals", body)
        return json_response(req, {"error": "prepMinutes must be >= 1 and price must be >= 0"}, 400)

    meal_id = clean_str(body.get("mealId")) or str(uuid.uuid4())

    meals_table.upsert_entity(
        {
            "PartitionKey": area,
            "RowKey": meal_id,
            "restaurantName": restaurant_name,
            "dishName": dish_name,
            "description": description,
            "prepMinutes": int(prep_minutes),
            "price": float(price),
            "imageUrl": image_url,
            "updatedAt": utc_iso()
        }
    )

    # Also upsert restaurant metadata in Restaurants table (since you already created it)
    restaurant_key = restaurant_name.lower().replace(" ", "-")
    restaurants_table.upsert_entity(
        {
            "PartitionKey": area,
            "RowKey": restaurant_key,
            "restaurantName": restaurant_name,
            "imageUrl": "",
            "updatedAt": utc_iso()
        }
    )

    return json_response(req, {"ok": True, "mealId": meal_id})


@app.function_name(name="SubmitOrder")
@app.route(route="orders", methods=["POST", "OPTIONS"])
def orders(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return options_response(req)

    body = parse_json(req)
    if body is None:
        log_invalid("Invalid JSON in POST /orders", {"raw": req.get_body().decode("utf-8", errors="ignore")})
        return json_response(req, {"error": "Invalid JSON body"}, 400)

    area = clean_str(body.get("area"))
    address = clean_str(body.get("address"))
    meal_ids = body.get("mealIds")

    if not area or not address or not isinstance(meal_ids, list) or len(meal_ids) == 0:
        log_invalid("Missing required fields in POST /orders", body)
        return json_response(req, {"error": "Required: area, address, mealIds[]"}, 400)

    meal_ids_clean = [clean_str(x) for x in meal_ids if clean_str(x)]
    if not meal_ids_clean:
        log_invalid("No valid mealIds in POST /orders", body)
        return json_response(req, {"error": "mealIds must contain at least one valid id"}, 400)

    meals_table = table_client(env("MEALS_TABLE_NAME", "Meals"))
    orders_table = table_client(env("ORDERS_TABLE_NAME", "Orders"))

    selected: List[Dict[str, Any]] = []
    total = 0.0

    for mid in meal_ids_clean:
        try:
            e = meals_table.get_entity(partition_key=area, row_key=mid)
        except Exception:
            continue

        item = {
            "mealId": e.get("RowKey"),
            "restaurantName": e.get("restaurantName", ""),
            "dishName": e.get("dishName", ""),
            "prepMinutes": int(e.get("prepMinutes", 0)),
            "price": float(e.get("price", 0.0))
        }
        selected.append(item)
        total += item["price"]

    if not selected:
        log_invalid("No meals found for area and mealIds in POST /orders", body)
        return json_response(req, {"error": "No meals found for given area and mealIds"}, 400)

    eta = estimate_delivery_minutes(selected)
    order_id = str(uuid.uuid4())

    orders_table.create_entity(
        {
            "PartitionKey": area,
            "RowKey": order_id,
            "address": address,
            "itemsJson": json.dumps(selected),
            "totalCost": round(total, 2),
            "estimatedMinutes": int(eta),
            "createdAt": utc_iso()
        }
    )

    return json_response(
        req,
        {
            "ok": True,
            "orderId": order_id,
            "area": area,
            "totalCost": round(total, 2),
            "estimatedMinutes": int(eta),
            "items": selected
        },
        200
    )

