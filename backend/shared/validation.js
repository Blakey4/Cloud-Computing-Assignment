function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function validateUpsertMeal(body) {
  const errors = [];

  if (!isNonEmptyString(body.area)) errors.push("Missing or invalid 'area'.");
  if (!isNonEmptyString(body.dishName)) errors.push("Missing or invalid 'dishName'.");
  if (!isNonEmptyString(body.description)) errors.push("Missing or invalid 'description'.");

  if (!isFiniteNumber(body.prepMinutes) || body.prepMinutes <= 0) {
    errors.push("Missing or invalid 'prepMinutes' (must be > 0).");
  }

  if (!isFiniteNumber(body.price) || body.price <= 0) {
    errors.push("Missing or invalid 'price' (must be > 0).");
  }

  return errors;
}

function validateCreateOrder(body) {
  const errors = [];

  if (!isNonEmptyString(body.area)) errors.push("Missing or invalid 'area'.");
  if (!isNonEmptyString(body.address)) errors.push("Missing or invalid 'address'.");

  if (!Array.isArray(body.items) || body.items.length === 0) {
    errors.push("Missing or invalid 'items' (must be a non-empty array).");
    return errors;
  }

  for (let index = 0; index < body.items.length; index++) {
    const item = body.items[index];

    if (!item || typeof item !== "object") {
      errors.push(`Item ${index}: invalid item object.`);
      continue;
    }

    if (!isNonEmptyString(item.mealId)) errors.push(`Item ${index}: missing/invalid 'mealId'.`);

    if (typeof item.quantity !== "number" || !Number.isInteger(item.quantity) || item.quantity <= 0) {
      errors.push(`Item ${index}: missing/invalid 'quantity' (must be integer > 0).`);
    }
  }

  return errors;
}

module.exports = {
  validateUpsertMeal,
  validateCreateOrder
};
