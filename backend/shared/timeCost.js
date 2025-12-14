function calculateTotals({ mealIdToMeal, items, pickupMinutes, deliveryMinutes }) {
  let totalCost = 0;
  let preparationSum = 0;

  for (const item of items) {
    const meal = mealIdToMeal.get(item.mealId);
    if (!meal) continue;

    const quantity = item.quantity;
    const price = Number(meal.price) || 0;
    const prepMinutes = Number(meal.prepMinutes) || 0;

    totalCost += price * quantity;
    preparationSum += prepMinutes * quantity;
  }

  const estimatedMinutes = preparationSum + pickupMinutes + deliveryMinutes;

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    estimatedMinutes,
    breakdown: {
      preparationSum,
      pickupMinutes,
      deliveryMinutes
    }
  };
}

module.exports = { calculateTotals };
