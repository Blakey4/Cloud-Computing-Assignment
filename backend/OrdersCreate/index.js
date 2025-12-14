const { v4: uuidv4 } = require("uuid");
const { getMealsTableClient, getOrdersTableClient, getInvalidQueueClient } = require("../shared/storage");
const { validateCreateOrder } = require("../shared/validation");
const { calculateTotals } = require("../shared/timeCost");
const { withCorsHeaders, preflightResponse } = require("../shared/cors");

async function logInvalidRequest({ reason, errors, payload, extra }) {
  const queueClient = await getInvalidQueueClient();
  const message = {
    reason,
    errors,
    extra,
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
    area: body.area ? String(body.area).trim() : "",
    address: body.address ? String(body.address).trim() : "",
    items: Array.isArray(body.items)
      ? body.items.map((item) => ({
          mealId: item && item.mealId ? String(item.mealId).trim() : "",
          quantity: Number(item && item.quantity)
        }))
      : []
  };

  const errors = validateCreateOrder(normalized);
  if (errors.length > 0) {
    await logInvalidRequest({ reason: "Invalid order create", errors, payload: normalized });

    context.res = withCorsHeaders({
      status: 400,
      jsonBody: { error: "Invalid request", errors }
    });
    return;
  }

  const pickupMinutes = Number(process.env.PICKUP_MINUTES || 10);
  const deliveryMinutes = Number(process.env.DELIVERY_MINUTES || 15);

  const mealsTable = getMealsTableClient();
  await mealsTable.createTable();

  const safeArea = normalized.area.replace(/'/g, "''");
  const filter = `PartitionKey eq '${safeArea}'`;

  const mealIdToMeal = new Map();
  for await (const entity of mealsTable.listEntities({ queryOptions: { filter } })) {
    mealIdToMeal.set(entity.rowKey, entity);
  }

  const missingMealIds = normalized.items
    .filter((item) => !mealIdToMeal.has(item.mealId))
    .map((item) => item.mealId);

  if (missingMealIds.length > 0) {
    await logInvalidRequest({
      reason: "Order references missing meals",
      errors: ["One or more mealIds are not available in this area."],
      payload: normalized,
      extra: { missingMealIds }
    });

    context.res = withCorsHeaders({
      status: 400,
      jsonBody: { error: "Some meals are not available in this area", missingMealIds }
    });
    return;
  }

  const totals = calculateTotals({
    mealIdToMeal,
    items: normalized.items,
    pickupMinutes,
    deliveryMinutes
  });

  const orderId = uuidv4();
  const ordersTable = getOrdersTableClient();
  await ordersTable.createTable();

  await ordersTable.createEntity({
    partitionKey: normalized.area,
    rowKey: orderId,
    address: normalized.address,
    itemsJson: JSON.stringify(normalized.items),
    totalCost: totals.totalCost,
    estimatedMinutes: totals.estimatedMinutes,
    createdAt: new Date().toISOString()
  });

  context.res = withCorsHeaders({
    status: 200,
    jsonBody: {
      message: "Order confirmed",
      orderId,
      area: normalized.area,
      totalCost: totals.totalCost,
      estimatedMinutes: totals.estimatedMinutes,
      breakdown: totals.breakdown
    }
  });
};
