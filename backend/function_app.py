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
    v = os.getenv(name, default)
    if v is None or str(v).strip() == "":
        raise ValueError(f"Missing environment variable: {name}")
    return v


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

    h = {
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    }

    if allowed == "*":
        h["Access-Control-Allow-Origin"] = "*"
        return h

    allow_list = [o.strip() for o in allowed.split(",") if o.strip()]
    if origin and origin in allow_list:
        h["Access-Control-Allow-Origin"] = origin
        h["Vary"] = "Origin"
        return h

    h["Access-Control-Allow-Origin"] = allow_list[0] if allow_list else "*"
    return h


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
        q.send_message(json.dumps({"reason": reason, "payload": payload, "at": utc_iso()}))
    except Exception:
        pass


def to_float(x: Any, default: float = 0.0) -> float:
    try:
        return float(x)
    except Exception:
        return default


def to_int(x: Any, default: int = 0) -> int:
    try:
        return int(x)
    except Exception:
        return default


@app.function_name(name="GetMealsByArea")
@app.route(route="GetMealsByArea", methods=["GET", "OPTIONS"])
def get_meals_by_area(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return options_response(req)

    area = clean_str(req.params.get("area"))
    if not area:
        log_invalid("Missing area in GetMealsByArea", {"query": dict(req.params)})
        return json_response(req, {"error": "Missing required query param: area"}, 400)

    meals_table = table_client(env("MEALS_TABLE_NAME", "Meals"))

    result: List[Dict[str, Any]] = []
    try:
        for e in meals_table.query_entities(query_filter=f"PartitionKey eq '{area}'"):
            # Map your Table schema into the shape your JS expects
            meal = {
                "id": e.get("RowKey"),
                "name": e.get("dishName", ""),
                "description": e.get("description", ""),
                "price": to_float(e.get("price", 0.0)),
                "prepTime": to_int(e.get("prepMinutes", 0)),
                "restaurantName": e.get("restaurantName", "Unknown restaurant"),
                "imageUrl": e.get("imageUrl", "")
            }
            result.append(meal)
    except Exception as ex:
        log_invalid("Query failed in GetMealsByArea", {"area": area, "error": str(ex)})
        return json_response(req, {"error": "Failed to read meals"}, 500)

    # IMPORTANT: your JS expects an array, not {meals: [...]}
    return json_response(req, result, 200)


@app.function_name(name="SubmitORder")
@app.route(route="SubmitORder", methods=["POST", "OPTIONS"])
def submit_order(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return options_response(req)

    body = parse_json(req)
    if body is None:
        log_invalid("Invalid JSON in SubmitORder", {"raw": req.get_body().decode("utf-8", errors="ignore")})
        return json_response(req, {"error": "Invalid JSON body"}, 400)

    customer_name = clean_str(body.get("customerName"))
    address = clean_str(body.get("address"))
    area = clean_str(body.get("area"))
    items = body.get("items")

    if not customer_name or not address or not area or not isinstance(items, list) or len(items) == 0:
        log_invalid("Missing required fields in SubmitORder", body)
        return json_response(req, {"error": "Required: customerName, address, area, items[]"}, 400)

    # Compute totals based on your JS payload
    total_cost = 0.0
    total_prep = 0

    normalized_items: List[Dict[str, Any]] = []
    for it in items:
        name = clean_str(it.get("name"))
        price = to_float(it.get("price", 0.0))
        prep = to_int(it.get("prepTime", 0))
        qty = max(1, to_int(it.get("quantity", 1)))

        if not name:
            continue

        total_cost += price * qty
        total_prep += prep * qty

        normalized_items.append(
            {"name": name, "price": price, "prepTime": prep, "quantity": qty}
        )

    if len(normalized_items) == 0:
        log_invalid("No valid items in SubmitORder", body)
        return json_response(req, {"error": "items[] must include at least one valid item"}, 400)

    # ETA formula: sum(prepTime) + pickup 10 + delivery 20
    estimated_minutes = total_prep + 10 + 20

    order_id = str(uuid.uuid4())

    # Store in Orders table
    orders_table = table_client(env("ORDERS_TABLE_NAME", "Orders"))
    try:
        orders_table.create_entity(
            {
                "PartitionKey": area,
                "RowKey": order_id,
                "customerName": customer_name,
                "address": address,
                "itemsJson": json.dumps(normalized_items),
                "totalCost": round(total_cost, 2),
                "estimatedMinutes": int(estimated_minutes),
                "createdAt": utc_iso(),
            }
        )
    except Exception as ex:
        log_invalid("Write failed in SubmitORder", {"error": str(ex), "body": body})
        return json_response(req, {"error": "Failed to store order"}, 500)

    return json_response(
        req,
        {
            "orderId": order_id,
            "totalCost": round(total_cost, 2),
            "estimatedMinutes": int(estimated_minutes),
        },
        200,
    )
