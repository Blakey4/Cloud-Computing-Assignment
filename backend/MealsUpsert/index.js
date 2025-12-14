const { v4: uuidv4 } = require("uuid");
const { getMealsTableClient, getInvalidQueueClient } = require("../shared/storage");
const { validateUpsertMeal } = require("../shared/validation");
const { withCorsHeaders, preflightResponse } = require("../shared/cors");

async function logInvalidRequest({ reason, errors, payload }) {
  const queueClient = await getInvalidQueueClient();
  const message = {
    reason,
    errors,
    payload,
    at: new Date().toISOString()
  };

  const encoded = Buffer.from(JSON.stringify(message)).toString("base64");
  await queueClient.sendMessage(encoded);
}

module.exports = async function (context, req) {
  if (req.method === "OPTIONS") {
    context.res = preflightResponse();
    return;
  }

  const body = req.body || {};
  const normalized = {
    mealId: body.mealId ? String(body.mealId).trim() : "",
    area: body.area ? String(body.area).trim() : "",
    dishName: body.dishName ? String(body.dishName).trim() : "",
    description: body.description ? String(body.description).trim() : "",
    prepMinutes: Number(body.prepMinutes),
    price: Number(body.price),
    restaurantName: body.restaurantName ? String(body.restaurantName).trim() : "",
    imageUrl: body.imageUrl ? String(body.imageUrl).trim() : ""
  };

  const errors = validateUpsertMeal(normalized);
  if (errors.length > 0) {
    await logInvalidRequest({ reason: "Invalid meal upsert", errors, payload: normalized });

    context.res = withCorsHeaders({
      status: 400,
      jsonBody: { error: "Invalid request", errors }
    });
    return;
  }

  const mealsTable = getMealsTableClient();
  await mealsTable.createTable();

  const mealId = normalized.mealId || uuidv4();

  const entity = {
    partitionKey: normalized.area,
    rowKey: mealId,
    dishName: normalized.dishName,
    description: normalized.description,
    prepMinutes: normalized.prepMinutes,
    price: normalized.price,
    restaurantName: normalized.restaurantName,
    imageUrl: normalized.imageUrl
  };

  await mealsTable.upsertEntity(entity, "Merge");

  context.res = withCorsHeaders({
    status: 200,
    jsonBody: { message: "Meal saved", mealId, area: normalized.area }
  });
};
