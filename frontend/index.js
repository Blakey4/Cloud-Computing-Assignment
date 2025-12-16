// ===============================
// Azure Functions configuration
// ===============================
const FUNCTION_BASE = "https://group4cc-functions.azurewebsites.net/api";

const GET_MEALS_URL = FUNCTION_BASE + "/GetMealsByArea";
const SUBMIT_ORDER_URL = FUNCTION_BASE + "/SubmitOrder"; // note the capital OR

// ===============================
// App state
// ===============================
let meals = [];      // will be loaded from Azure based on area
let cart = [];
let currentOrder = null;

// ===============================
// View helpers
// ===============================
function showView(id) {
  ["view-landing", "view-restaurant", "view-customer", "view-confirmation"].forEach(
    (v) => {
      const el = document.getElementById(v);
      if (el) el.classList.add("hidden");
    }
  );
  const toShow = document.getElementById(id);
  if (toShow) toShow.classList.remove("hidden");
}

function formatMoney(n) {
  return "$" + n.toFixed(2);
}

// ===============================
// Load meals from Azure for an area
// ===============================
async function loadMealsFromAzure() {
  const area = document.getElementById("customer-area").value;
  const grid = document.getElementById("meal-grid");

  grid.innerHTML = '<p style="color:#666;">Loading meals...</p>';
  meals = [];

  if (!area) {
    grid.innerHTML = '<p style="color:#666;">Please select an area.</p>';
    return;
  }

  const url = `${GET_MEALS_URL}?area=${encodeURIComponent(area)}`;

  try {
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text();
      console.error("GetMealsByArea error:", res.status, text);
      grid.innerHTML =
        '<p style="color:#c00;">Error loading meals from server.</p>';
      return;
    }

    const data = await res.json();

    meals = (Array.isArray(data) ? data : []).map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      price: Number(m.price),
      prepTime: Number(m.prepTime),
      restaurantName: m.restaurantName || m.restaurant || "Unknown restaurant",
      area: area,
      imageUrl: m.imageUrl || ""
    }));

    renderMeals();
  } catch (err) {
    console.error("GetMealsByArea fetch failed:", err);
    grid.innerHTML =
      '<p style="color:#c00;">Network error while loading meals.</p>';
  }
}

// ===============================
// Render meals list
// ===============================
function renderMeals() {
  const area = document.getElementById("customer-area").value;
  const term = document
    .getElementById("search-term")
    .value.toLowerCase()
    .trim();
  const grid = document.getElementById("meal-grid");
  grid.innerHTML = "";

  const filtered = meals.filter((m) => {
    const matchesArea = m.area === area;
    const matchesText =
      m.name.toLowerCase().includes(term) ||
      (m.description || "").toLowerCase().includes(term);
    return matchesArea && matchesText;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<p style="color:#666;">No meals found in this area.</p>';
    return;
  }

  filtered.forEach((meal) => {
    const card = document.createElement("div");
    card.className = "meal-card";

    const img = document.createElement("img");
    img.src = meal.imageUrl || "";
    img.alt = meal.name;
    card.appendChild(img);

    const body = document.createElement("div");
    body.className = "meal-body";

    const name = document.createElement("div");
    name.className = "meal-name";
    name.textContent = meal.name;
    body.appendChild(name);

    const meta = document.createElement("div");
    meta.className = "meal-meta";
    meta.textContent = `${meal.restaurantName} • ${meal.prepTime} mins`;
    body.appendChild(meta);

    const desc = document.createElement("div");
    desc.style.fontSize = "13px";
    desc.style.color = "#555";
    desc.style.marginBottom = "8px";
    desc.textContent = meal.description || "";
    body.appendChild(desc);

    const priceRow = document.createElement("div");
    priceRow.className = "meal-price-row";

    const price = document.createElement("div");
    price.className = "price";
    price.textContent = formatMoney(meal.price);
    priceRow.appendChild(price);

    const btn = document.createElement("button");
    btn.className = "btn-primary";
    btn.style.fontSize = "12px";
    btn.textContent = "Add +";
    btn.onclick = () => addToCart(meal);
    priceRow.appendChild(btn);

    body.appendChild(priceRow);
    card.appendChild(body);
    grid.appendChild(card);
  });
}

// ===============================
// Cart functions
// ===============================
function addToCart(meal) {
  cart.push(meal);
  renderCart();
}

function removeFromCart(index) {
  cart.splice(index, 1);
  renderCart();
}

function renderCart() {
  const container = document.getElementById("cart-items");
  const totalEl = document.getElementById("cart-total");
  container.innerHTML = "";

  if (cart.length === 0) {
    container.innerHTML =
      '<p style="color:#666;font-size:13px;">Your cart is empty.</p>';
    totalEl.textContent = "$0.00";
    return;
  }

  let total = 0;
  cart.forEach((item, idx) => {
    total += item.price;
    const row = document.createElement("div");
    row.className = "cart-item";

    const left = document.createElement("div");
    left.innerHTML =
      "<strong>" +
      item.name +
      "</strong><br/><span style='font-size:12px;color:#666;'>" +
      formatMoney(item.price) +
      "</span>";

    const btn = document.createElement("button");
    btn.className = "btn-secondary";
    btn.style.fontSize = "11px";
    btn.textContent = "Remove";
    btn.onclick = () => removeFromCart(idx);

    row.appendChild(left);
    row.appendChild(btn);
    container.appendChild(row);
  });

  totalEl.textContent = formatMoney(total);
}

// ===============================
// Submit order to Azure
// ===============================
async function handleOrderForm(e) {
  e.preventDefault();
  const name = document.getElementById("cust-name").value.trim();
  const address = document.getElementById("cust-address").value.trim();
  const area = document.getElementById("customer-area").value;
  const msg = document.getElementById("order-message");

  if (!name || !address) {
    msg.textContent = "Please fill in your name and address.";
    return;
  }
  if (cart.length === 0) {
    msg.textContent = "Add at least one meal to your cart.";
    return;
  }

  msg.textContent = "Submitting order...";

  const items = cart.map((m) => ({
    name: m.name,
    price: m.price,
    prepTime: m.prepTime,
    quantity: 1
  }));

  const payload = { customerName: name, address, area, items };

  try {
    const res = await fetch(SUBMIT_ORDER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      msg.textContent = data.error || "Order failed.";
      return;
    }

    currentOrder = {
      name,
      address,
      area,
      total: data.totalCost,
      eta: data.estimatedMinutes,
      items: cart.slice(),
      orderId: data.orderId
    };

    cart = [];
    renderCart();
    msg.textContent = "";
    showConfirmation();
  } catch (err) {
    console.error("Submit order failed:", err);
    msg.textContent = "Network error submitting order.";
  }
}

// ===============================
// Confirmation
// ===============================
function showConfirmation() {
  showView("view-confirmation");
  const summary = document.getElementById("confirm-summary");
  const time = document.getElementById("confirm-time");

  summary.textContent =
    `Thanks ${currentOrder.name}! Your order of ${currentOrder.items.length} item(s) to ${currentOrder.address} in ${currentOrder.area} totals ` +
    formatMoney(currentOrder.total) +
    `. Your order ID is ${currentOrder.orderId}.`;

  time.textContent = `Estimated delivery: ${currentOrder.eta} minutes`;
}

// ===============================
// Page setup
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logo").onclick = () => showView("view-landing");
  document.getElementById("btn-im-customer").onclick = () => {
    showView("view-customer");
    loadMealsFromAzure();
    renderCart();
  };
  document.getElementById("btn-im-restaurant").onclick = () =>
    showView("view-restaurant");
  document.getElementById("btn-new-order").onclick = () => {
    showView("view-customer");
    loadMealsFromAzure();
    renderCart();
  };

  document.getElementById("customer-area").onchange = loadMealsFromAzure;
  document.getElementById("search-term").oninput = renderMeals;

  document
    .getElementById("order-form")
    .addEventListener("submit", handleOrderForm);

  showView("view-landing");
});
