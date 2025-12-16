import json
import os
import uuid
from datetime import datetime, timezone

import azure.functions as func
from azure.data.tables import TableServiceClient
from azure.core.exceptions import ResourceNotFoundError


def _cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }


def _get_conn_str():
    # Common names used in Azure Functions / labs
    return (
        os.getenv("AzureWebJobsStorage")
        or os.getenv("AZURE_STORAGE_CONNECTION_STRING")
        or os.getenv("STORAGE_CONNECTION_STRING")
    )


def main(req: func.HttpRequest) -> func.HttpResponse:
    # CORS preflight
    if req.method == "OPTIONS":
        return func.HttpResponse("", status_code=204, headers=_cors_headers())

    conn_str = _get_conn_str()
    if not conn_str:
        return func.HttpResponse(
            json.dumps({"error": "Missing storage connection string env var."}),
            status_code=500,
            mimetype="application/json",
            headers=_cors_headers(),
        )

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({"error": "Invalid JSON body."}),
            status_code=400,
            mimetype="application/json",
            headers=_cors_headers(),
        )

    # Required fields from frontend
    restaurant_name = (body.get("restaurantName") or "").strip()
    area = (body.get("area") or "").strip()

    meal_name = (body.get("name") or "").strip()
    description = (body.get("description") or "").strip()
    image_url = (body.get("imageUrl") or "").strip()

    price = body.get("price")
    prep_time = body.get("prepTimeMinutes")

    # Basic validation
    if not restaurant_name or not area or not meal_name:
        return func.HttpResponse(
            json.dumps({"error": "restaurantName, area, and name are required."}),
            status_code=400,
            mimetype="application/json",
            headers=_cors_headers(),
        )

    try:
        price = float(price)
        prep_time = int(prep_time)
    except (TypeError, ValueError):
        return func.HttpResponse(
            json.dumps({"error": "price must be a number and prepTimeMinutes must be an integer."}),
            status_code=400,
            mimetype="application/json",
            headers=_cors_headers(),
        )

    # Table clients
    svc = TableServiceClient.from_connection_string(conn_str)
    restaurants_table = svc.get_table_client("Restaurants")
    meals_table = svc.get_table_client("Meals")

    # 1) Find restaurant by (PartitionKey=area AND Name=restaurant_name)
    # If found -> use its RowKey as restauran
