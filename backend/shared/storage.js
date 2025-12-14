const { TableClient } = require("@azure/data-tables");
const { QueueClient } = require("@azure/storage-queue");

function getTablesConnectionString() {
  return process.env.TABLES_CONNECTION_STRING || process.env.AzureWebJobsStorage;
}

function getQueueConnectionString() {
  return process.env.AzureWebJobsStorage;
}

function getMealsTableClient() {
  const connectionString = getTablesConnectionString();
  const tableName = process.env.MEALS_TABLE_NAME || "Meals";
  return TableClient.fromConnectionString(connectionString, tableName);
}

function getOrdersTableClient() {
  const connectionString = getTablesConnectionString();
  const tableName = process.env.ORDERS_TABLE_NAME || "Orders";
  return TableClient.fromConnectionString(connectionString, tableName);
}

async function getInvalidQueueClient() {
  const connectionString = getQueueConnectionString();
  const queueName = process.env.INVALID_QUEUE_NAME || "invalid-requests";
  const queueClient = QueueClient.fromConnectionString(connectionString, queueName);
  await queueClient.createIfNotExists();
  return queueClient;
}

module.exports = {
  getMealsTableClient,
  getOrdersTableClient,
  getInvalidQueueClient
};
