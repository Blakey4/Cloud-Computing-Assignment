from azure.data.tables import TableServiceClient
import uuid
# For external file reading
import csv
from pathlib import Path
import os

# -----------------------------------------
# CSV Files Paths
# -----------------------------------------
root_dir = Path(__file__).resolve().parent.parent
restaurants_csv_path = root_dir / "data" / "restaurants.csv"
meals_csv_path = root_dir / "data" / "meals.csv"

# -----------------------------------------
# CONFIG
# -----------------------------------------
STORAGE_ACCOUNT_NAME = "group4cc"
STORAGE_ACCOUNT_URL = f"https://{STORAGE_ACCOUNT_NAME}.table.core.windows.net"

CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
if not CONNECTION_STRING:
    raise RuntimeError("Missing AZURE_STORAGE_CONNECTION_STRING environment variable")
RESTAURANT_TABLE = "Restaurants"
MEALS_TABLE = "Meals"

# -----------------------------------------
# Initialise Client
# -----------------------------------------
service = TableServiceClient.from_connection_string(conn_str=CONNECTION_STRING)
restaurants_client = service.get_table_client(table_name=RESTAURANT_TABLE)
meals_client = service.get_table_client(table_name=MEALS_TABLE)

# -----------------------------------------
# Helper Functions
# -----------------------------------------
# Generate a unique ID
def generate_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:6]}"

# Load Meals from CSV
def load_meals():
    meals = []
    with open(meals_csv_path, mode='r', encoding='utf-8') as file:
        reader = csv.DictReader(file) # using DictReader as it easily makes dicts for each row
        for row in reader:
            meals.append(row)
    return meals

# Load Restaurants from CSV
def load_restaurants():
    restaurants = []
    with open(restaurants_csv_path, mode='r', encoding='utf-8') as file:
        reader = csv.DictReader(file) # using DictReader as it easily makes dicts for each row
        for row in reader:
            restaurants.append(row)
    return restaurants

def insert_restaurant(area, restaurant_id, name, address, phone="", image_url=""):
    entity = {
        "PartitionKey": area,
        "RowKey": restaurant_id,
        "Name": name,
        "Address": address,
        "Area": area,
        "Phone": phone,
        "ImageUrl": image_url
    }
    restaurants_client.upsert_entity(entity)
    print(f"Inserted restaurant: {name} ({restaurant_id})")


def insert_meal(area, meal_id, restaurant_id, restaurant_name,
                dish_name, description, prep_minutes, price, image_url=""):
    entity = {
        "PartitionKey": area,
        "RowKey": meal_id,
        "RestaurantId": restaurant_id,
        "RestaurantName": restaurant_name,
        "DishName": dish_name,
        "Description": description,
        "PrepTimeMinutes": prep_minutes,
        "Price": price,
        "Area": area,
        "ImageUrl": image_url
    }
    meals_client.upsert_entity(entity)
    print(f"  → Added meal: {dish_name} ({meal_id})")

# -----------------------------------------
# MAIN SEEDING LOGIC
# -----------------------------------------

def seed():
    print("Starting script...\n")

    # Load and insert restaurants
    restaurants = load_restaurants()

    for row in restaurants:
        # Creates an Azure Table Entity matching Azure Table structure
        newEntity = {
            "PartitionKey": row["Area"], # PartitionKey by area
            "RowKey": row["RestaurantId"], # Unique RowKey
            "Name": row["Name"],
            "Address": row["Address"],
            "Area": row["Area"],
            "Phone": row["Phone"],
            "ImageUrl": row["ImageUrl"]
        }

        restaurants_client.upsert_entity(newEntity) #Insert into Azure Table
        print(f'Inserted restaurant: {row["Name"]}') # For debugging

    # Load and insert meals
    meals = load_meals()

    for meal in meals:
        newEntity = {
            "PartitionKey": meal["Area"], # PartitionKey by area
            "RowKey": meal["MealId"], # Unique RowKey
            "RestaurantId": meal["RestaurantId"],
            "RestaurantName": meal["RestaurantName"],
            "DishName": meal["DishName"],
            "Description": meal["Description"],
            "PrepTimeMinutes": int(meal["PrepTimeMinutes"]),
            "Price": float(meal["Price"]),
            "Area": meal["Area"],
            "ImageUrl": meal["ImageUrl"]
        }

        meals_client.upsert_entity(newEntity) #Insert into Azure Table
        print(f'  → Added meal: {meal["DishName"]}') # For debugging

    # # EXAMPLE RESTAURANT (DELETE LATER)
    # area = "MadridCentral"
    # rest_id = generate_id("REST")
    # insert_restaurant(
    #     area=area,
    #     restaurant_id=rest_id,
    #     name="Example Restaurant",
    #     address="Example Street 123, Madrid",
    #     phone="+34 600 000 000"
    # )

    # # EXAMPLE MEAL (DELETE LATER)
    # meal_id = generate_id("MEAL")
    # insert_meal(
    #     area=area,
    #     meal_id=meal_id,
    #     restaurant_id=rest_id,
    #     restaurant_name="Example Restaurant",
    #     dish_name="Example Dish",
    #     description="This is placeholder data.",
    #     prep_minutes=20,
    #     price=12.50
    # )


if __name__ == "__main__":
    seed()
    print("\nDone.")