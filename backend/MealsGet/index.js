const { getMealsTableClient } = require("../shared/storage");
const { withCorsHeaders, preflightResponse } = require("../shared/cors");

module.exports = async function (context, req) {
  if (req.method === "OPTIONS") {
    context.res = preflightResponse();
    return;
  }

  const area = (req.query.area || "").trim();
  if (!area) {
    context.res = withCorsHeaders({
      status: 400,
      jsonBody: { error: "Missing required query param: area" }
    });
    return;
  }

  const mealsTable = getMealsTableClient();
  await mealsTable.createTable();

  const safeArea = area.replace(/'/g, "''");
  const filter = `PartitionKey eq '${safeArea}'`;

  const meals = [];
  for await (const entity of mealsTable.listEntities({ queryOptions: { filter } })) {
    meals.push({
      mealId: entity.rowKey,
      area: entity.partitionKey,
      dishName: entity.dishName,
      description: entity.description,
      prepMinutes: Number(entity.prepMinutes),
      price: Number(entity.price),
      restaurantName: entity.restaurantName || "",
      imageUrl: entity.imageUrl || ""
    });
  }

  context.res = withCorsHeaders({
    status: 200,
    jsonBody: { area, count: meals.length, meals }
  });
};
