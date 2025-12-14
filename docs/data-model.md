# Data Model – Cloud Food Ordering Platform

## Delivery Areas

We will use three delivery areas (also used as PartitionKeys in some tables):

- MadridCentral
- MadridNorth
- MadridEast

---

## Azure Table: Restaurants

**Table name:** `Restaurants`  

**Purpose:** Stores basic information about each restaurant.

**Keys:**
- `PartitionKey` – the delivery area (e.g. `MadridCentral`)
- `RowKey` – a unique RestaurantId (e.g. a GUID or short string)

**Suggested properties:**
- `Name` – restaurant name (string)
- `Address` – simple address or description (string)
- `Area` – duplicate of delivery area for convenience (string)
- `ImageUrl` – optional, URL to restaurant image in Blob Storage (string)
- `Phone` – optional contact (string)

---

## Azure Table: Meals

**Table name:** `Meals`  

**Purpose:** Stores individual dishes offered by restaurants.

**Keys:**
- `PartitionKey` – the delivery area (e.g. `MadridCentral`)
- `RowKey` – a unique MealId (e.g. a GUID or short string)

**Suggested properties:**
- `RestaurantId` – RowKey of the restaurant in `Restaurants` table (string)
- `RestaurantName` – denormalised restaurant name for easy display (string)
- `DishName` – name of the meal (string)
- `Description` – description of the meal (string)
- `PrepTimeMinutes` – estimated preparation time in minutes (int)
- `Price` – meal price (decimal/float)
- `Area` – duplicate of delivery area (string)
- `ImageUrl` – optional, URL to dish photo in Blob Storage (string)

---

## Azure Table: Orders

**Table name:** Orders

**Purpose:** Stores customer orders, including selected meals, cost, and estimated delivery time.

**Keys:**
- PartitionKey – the delivery area (e.g. MadridCentral)
- RowKey – a unique OrderId (GUID string)

**Suggested properties:**
- CustomerAddress – address typed by the user
- CustomerName – optional, if included in the form
- SelectedMeals – comma-separated list of MealIds (string)
- SelectedMealNames – comma-separated list of meal names (string)
- TotalCost – decimal number
- TotalPrepTime – sum of prep times (int)
- EstimatedDeliveryTime – prep sum + fixed time (int)
- Timestamp – automatically added by Azure Tables

