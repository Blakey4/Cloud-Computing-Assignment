import os
import json
import azure.functions as func
from azure.data.tables import TableServiceClient

# Load the connection string from environment settings
CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
if not CONNECTION_STRING:
    raise RuntimeError("Missing AZURE_STORAGE_CONNECTION_STRING")

# Initialize table clients
table_service = TableServiceClient.from_connection_string(CONNECTION_STRING)
meals_table = table_service.get_table_client("Meals")

VALID_AREAS = {"Central", "North", "East"}

def main(req: func.HttpRequest) -> func.HttpResponse:
    area = req.params.get("area")

    if area not in VALID_AREAS:
        return func.HttpResponse(
            json.dumps({"error": "Invalid or missing area"}),
            status_code=400,
            mimetype="application/json"
        )

    # Query Meals by area (PartitionKey)
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

    return func.HttpResponse(
        json.dumps(out),
        status_code=200,
        mimetype="application/json"
    )
