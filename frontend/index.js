const meals = [
  {
    id: "1",
    name: "Campus Burger",
    description: "Juicy beef burger with cheddar and fries.",
    price: 9.5,
    prepTime: 15,
    restaurantName: "Grill Station",
    area: "Central",
    imageUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=500&q=60"
  },
  {
    id: "2",
    name: "Margherita Pizza",
    description: "Wood-fired pizza with fresh mozzarella and basil.",
    price: 11.0,
    prepTime: 20,
    restaurantName: "Campus Pizza",
    area: "Central",
    imageUrl: "https://images.unsplash.com/photo-1548369937-47519962c11a?auto=format&fit=crop&w=500&q=60"
  },
  {
    id: "3",
    name: "Sushi Box",
    description: "Assorted sushi rolls with soy and wasabi.",
    price: 14.5,
    prepTime: 25,
    restaurantName: "Sakura Express",
    area: "North",
    imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=60"
  },
  {
    id: "4",
    name: "Veggie Bowl",
    description: "Roasted veggies, quinoa, and tahini sauce.",
    price: 10.0,
    prepTime: 12,
    restaurantName: "Green Hub",
    area: "South",
    imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=500&q=60"
  }
];

let cart = [];
let currentOrder = null;

// View helpers
function showView(id) {
  ["view-landing","view-restaurant","view-customer","view-confirmation"].forEach(v => {
    const el = document.getElementById(v);
    if (el) el.classList.add("hidden");
  });
  const toShow = document.getElementById(id);
  if (toShow) toShow.classList.remove("hidden");
}

function formatMoney(n) {
  return "$" + n.toFixed(2);
}

// Render meals list
function renderMeals() {
  const area = document.getElementById("customer-area").value;
  const term = document.getElementById("search-term").value.toLowerCase();
  const grid = document.getElementById("meal-grid");
  grid.innerHTML = "";

  const filtered = meals.filter(m => {
    return m.area === area && (m.name.toLowerCase().includes(term) || m.description.toLowerCase().includes(term));
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<p style="color:#666;">No meals found in this area.</p>';
    return;
  }

  filtered.forEach(meal => {
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
    meta.textContent = meal.restaurantName + " • " + meal.prepTime + " mins";
    body.appendChild(meta);

    const desc = document.createElement("div");
    desc.style.fontSize = "13px";
    desc.style.color = "#555";
    desc.style.marginBottom = "8px";
    desc.textContent = meal.description;
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

// Cart logic
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
    container.innerHTML = '<p style="color:#666;font-size:13px;">Your cart is empty.</p>';
    totalEl.textContent = "$0.00";
    return;
  }

  let total = 0;
  cart.forEach((item, idx) => {
    total += item.price;
    const row = document.createElement("div");
    row.className = "cart-item";

    const left = document.createElement("div");
    left.innerHTML = "<strong>" + item.name + "</strong><br/><span style='font-size:12px;color:#666;'>" + formatMoney(item.price) + "</span>";

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

// Restaurant form: add new meal locally
function handleRestaurantForm(e) {
  e.preventDefault();
  const restName = document.getElementById("rest-name").value.trim();
  const restArea = document.getElementById("rest-area").value;
  const dishName = document.getElementById("dish-name").value.trim();
  const price = parseFloat(document.getElementById("dish-price").value);
  const prep = parseInt(document.getElementById("dish-prep").value, 10);
  const desc = document.getElementById("dish-desc").value.trim();
  const img = document.getElementById("dish-img").value.trim();

  if (!restName || !dishName || !desc || isNaN(price) || isNaN(prep)) {
    document.getElementById("rest-message").textContent = "Please fill in all required fields.";
    return;
  }

  meals.push({
    id: String(meals.length + 1),
    name: dishName,
    description: desc,
    price,
    prepTime: prep,
    restaurantName: restName,
    area: restArea,
    imageUrl: img || undefined
  });

  document.getElementById("restaurant-form").reset();
  document.getElementById("rest-message").textContent = "Meal saved locally! (Will later go to Azure Table Storage.)";
}

// Order form
function handleOrderForm(e) {
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
  msg.textContent = "";

  // Simple estimated time: sum(prepTime) + pickup 10 + delivery 20
  let sumPrep = 0;
  let total = 0;
  cart.forEach(m => {
    sumPrep += m.prepTime;
    total += m.price;
  });
  const eta = sumPrep + 10 + 20;

  currentOrder = {
    name,
    address,
    area,
    total,
    eta,
    items: cart.slice()
  };

  // Here later you will call Azure Function to submit order.
  cart = [];
  renderCart();
  showConfirmation();
}

function showConfirmation() {
  if (!currentOrder) return;
  showView("view-confirmation");
  const summary = document.getElementById("confirm-summary");
  const time = document.getElementById("confirm-time");

  summary.textContent =
    `Thanks ${currentOrder.name}! Your order of ${currentOrder.items.length} item(s) to ${currentOrder.address} ` +
    `in ${currentOrder.area} totals ${formatMoney(currentOrder.total)}.`;
  time.textContent = `Estimated delivery: ${currentOrder.eta} minutes`;
}

document.addEventListener("DOMContentLoaded", () => {
  // Navigation
  document.getElementById("logo").onclick = () => showView("view-landing");
  document.getElementById("btn-im-customer").onclick = () => {
    showView("view-customer");
    renderMeals();
    renderCart();
  };
  document.getElementById("btn-im-restaurant").onclick = () => showView("view-restaurant");
  document.getElementById("btn-new-order").onclick = () => {
    showView("view-customer");
    renderMeals();
    renderCart();
  };

  // Filters
  document.getElementById("customer-area").onchange = renderMeals;
  document.getElementById("search-term").oninput = renderMeals;

  // Forms
  document.getElementById("restaurant-form").addEventListener("submit", handleRestaurantForm);
  document.getElementById("order-form").addEventListener("submit", handleOrderForm);

  // Initial view
  showView("view-landing");
});
EOF
