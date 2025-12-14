import os, json, uuid, datetime
import azure.functions as func
from azure.data.tables import TableServiceClient

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
if not CONNECTION_STRING:
    raise RuntimeError("Missing AZURE_STORAGE_CONNECTION_STRING")

table_service = TableServiceClient.from_connection_string(CONNECTION_STRING)
meals_table = table_service.get_table_client("Meals")
orders_table = table_service.get_table_client("Orders")

VALID_AREAS = {"Central", "North", "East"}

@app.route(route="GetMealsByArea", methods=["GET"])
def get_meals_by_area(req: func.HttpRequest) -> func.HttpResponse:
    area = req.params.get("area")
    if area not in VALID_AREAS:
        return func.HttpResponse(
            json.dumps({"error": "Invalid or missing area"}),
            status_code=400,
            mimetype="application/json",
        )

    entities = meals_table.query_entities(f"PartitionKey eq '{area}'")

    out = []
    for e in entities:
        out.append({
            "mealId": e.get("RowKey"),
            "area": e.get("PartitionKey"),
            "name": e.get("DishName") or e.get("Name"),
            "description": e.get("Description"),
            "prepTimeMinutes": int(e.get("PrepTimeMinutes", 0)),
            "price": float(e.get("Price", 0.0)),
            "restaurantId": e.get("RestaurantId"),
        })

    return func.HttpResponse(json.dumps(out), status_code=200, mimetype="application/json")


@app.route(route="SubmitOrder", methods=["POST"])
def submit_order(req: func.HttpRequest) -> func.HttpResponse:
    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(json.dumps({"error": "Invalid JSON"}), status_code=400, mimetype="application/json")

    area = body.get("area")
    items = body.get("items")  # [{mealId, qty}, ...]

    if area not in VALID_AREAS or not isinstance(items, list) or len(items) == 0:
        return func.HttpResponse(json.dumps({"error": "Invalid order payload"}), status_code=400, mimetype="application/json")

    total = 0.0
    prep_times = []
    resolved = []

    for it in items:
        meal_id = it.get("mealId")
        qty = it.get("qty", 1)
        if not meal_id or not isinstance(qty, int) or qty <= 0:
            return func.HttpResponse(json.dumps({"error": "Invalid items"}), status_code=400, mimetype="application/json")

        try:
            meal = meals_table.get_entity(partition_key=area, row_key=meal_id)
        except Exception:
            return func.HttpResponse(json.dumps({"error": f"Meal not found: {meal_id}"}), status_code=400, mimetype="application/json")

        price = float(meal.get("Price", 0.0))
        pt = int(meal.get("PrepTimeMinutes", 0))
        total += price * qty
        prep_times.append(pt)

        resolved.append({
            "mealId": meal_id,
            "qty": qty,
            "price": price,
            "prepTimeMinutes": pt,
            "name": meal.get("DishName") or meal.get("Name"),
        })

    eta = sum(prep_times) + 5 + 15  # per project brief

    order_id = str(uuid.uuid4())
    now = datetime.datetime.utcnow().isoformat() + "Z"

    orders_table.upsert_entity({
        "PartitionKey": area,
        "RowKey": order_id,
        "CreatedAt": now,
        "Total": total,
        "EtaMinutes": eta,
        "ItemsJson": json.dumps(resolved),
    })

    return func.HttpResponse(
        json.dumps({"orderId": order_id, "total": round(total, 2), "etaMinutes": eta}),
        status_code=200,
        mimetype="application/json",
    )
