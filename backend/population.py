import argparse
import uuid
from datetime import datetime, timezone
from typing import Dict, List

from azure.data.tables import TableServiceClient


def utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def make_meals(area: str, restaurant_name: str) -> List[Dict]:
    return [
        {
            "PartitionKey": area,
            "RowKey": str(uuid.uuid4()),
            "restaurantName": restaurant_name,
            "dishName": "Classic Burger",
            "description": "Beef patty, cheese, pickles, house sauce.",
            "prepMinutes": 12,
            "price": 9.99,
            "imageUrl": "",
            "updatedAt": utc_iso()
        },
        {
            "PartitionKey": area,
            "RowKey": str(uuid.uuid4()),
            "restaurantName": restaurant_name,
            "dishName": "Chicken Rice Bowl",
            "description": "Grilled chicken, rice, veggies, spicy mayo.",
            "prepMinutes": 14,
            "price": 10.50,
            "imageUrl": "",
            "updatedAt": utc_iso()
        },
        {
            "PartitionKey": area,
            "RowKey": str(uuid.uuid4()),
            "restaurantName": restaurant_name,
            "dishName": "Margherita Pizza Slice",
            "description": "Tomato, mozzarella, basil.",
            "prepMinutes": 10,
            "price": 4.25,
            "imageUrl": "",
            "updatedAt": utc_iso()
        }
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--conn", required=True, help="Storage connection string for group4cc")
    parser.add_argument("--meals", default="Meals", help="Meals table name")
    parser.add_argument("--restaurants", default="Restaurants", help="Restaurants table name")
    args = parser.parse_args()

    service = TableServiceClient.from_connection_string(conn_str=args.conn)
    meals_table = service.get_table_client(table_name=args.meals)
    restaurants_table = service.get_table_client(table_name=args.restaurants)

    areas = ["Central", "North", "South"]

    for area in areas:
        for i in range(1, 11):
            restaurant_name = f"{area} Kitchen {i:02d}"
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

            for meal in make_meals(area, restaurant_name):
                meals_table.upsert_entity(meal)

    print("Seeded Restaurants and Meals (3 areas, 10 restaurants per area, 3 meals each).")


if __name__ == "__main__":
    main()
