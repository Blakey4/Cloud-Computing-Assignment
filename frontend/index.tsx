
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";

// --- Types ---
type View = "landing" | "restaurant" | "customer" | "confirmation";

interface Meal {
  id: string;
  name: string;
  description: string;
  price: number;
  prepTime: number;
  restaurantName: string;
  area: string;
  imageUrl?: string;
}

interface CartItem extends Meal {
  cartId: string;
}

interface Order {
  id: string;
  items: CartItem[];
  total: number;
  address: string;
  estimatedTime: number;
  status: "pending" | "confirmed";
}

// --- Mock Data & "Backend" Functions ---
// in a real app, these would be API calls to Azure Functions

const INITIAL_MEALS: Meal[] = [
  {
    id: "1",
    name: "Classic Burger",
    description: "Juicy beef patty with cheddar, lettuce, and tomato.",
    price: 12.99,
    prepTime: 20,
    restaurantName: "Burger Joint",
    area: "Central",
    imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=500&q=60"
  },
  {
    id: "2",
    name: "Veggie Pizza",
    description: "Fresh bell peppers, onions, mushrooms, and olives.",
    price: 15.50,
    prepTime: 30,
    restaurantName: "Pizza Palace",
    area: "North",
    imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=500&q=60"
  },
  {
    id: "3",
    name: "Chicken Burrito",
    description: "Rice, beans, grilled chicken, and fresh salsa.",
    price: 11.00,
    prepTime: 15,
    restaurantName: "Taco Town",
    area: "South",
    imageUrl: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=500&q=60"
  },
  {
    id: "4",
    name: "Spicy Ramen",
    description: "Rich broth with pork belly and soft egg.",
    price: 14.00,
    prepTime: 25,
    restaurantName: "Noodle House",
    area: "Central",
    imageUrl: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=500&q=60"
  }
];

// --- Styles ---
const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "20px",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 0",
    borderBottom: "1px solid #eee",
    marginBottom: "40px",
  },
  logo: {
    fontSize: "24px",
    fontWeight: "bold",
    color: "#06C167", // Uber Eats green-ish
    cursor: "pointer",
  },
  button: {
    backgroundColor: "#06C167",
    color: "white",
    border: "none",
    padding: "12px 24px",
    borderRadius: "30px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  secondaryButton: {
    backgroundColor: "#eee",
    color: "#333",
    border: "none",
    padding: "12px 24px",
    borderRadius: "30px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    marginRight: "10px",
  },
  hero: {
    textAlign: "center",
    padding: "80px 20px",
    backgroundColor: "white",
    borderRadius: "20px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
  },
  heroTitle: {
    fontSize: "48px",
    marginBottom: "20px",
    color: "#333",
  },
  heroSubtitle: {
    fontSize: "20px",
    color: "#666",
    marginBottom: "40px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "24px",
  },
  card: {
    backgroundColor: "white",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    display: "flex",
    flexDirection: "column",
    transition: "transform 0.2s",
  },
  cardImage: {
    width: "100%",
    height: "200px",
    objectFit: "cover",
    backgroundColor: "#ddd",
  },
  cardContent: {
    padding: "16px",
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  cardTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    marginBottom: "8px",
  },
  cardMeta: {
    fontSize: "14px",
    color: "#666",
    marginBottom: "4px",
  },
  cardPrice: {
    fontSize: "16px",
    fontWeight: "bold",
    marginTop: "auto",
    color: "#333",
  },
  form: {
    maxWidth: "600px",
    margin: "0 auto",
    backgroundColor: "white",
    padding: "40px",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
  },
  inputGroup: {
    marginBottom: "20px",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    fontWeight: "600",
    color: "#333",
  },
  input: {
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #ddd",
    fontSize: "16px",
  },
  select: {
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #ddd",
    fontSize: "16px",
    backgroundColor: "white",
  },
  cart: {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    width: "350px",
    backgroundColor: "white",
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
    padding: "20px",
    zIndex: 1000,
    animation: "slideIn 0.3s ease-out",
  },
  cartItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
    borderBottom: "1px solid #eee",
    paddingBottom: "12px",
  },
  checkoutSummary: {
    marginTop: "20px",
    paddingTop: "20px",
    borderTop: "2px solid #eee",
  },
};

// --- Components ---

const App = () => {
  const [view, setView] = useState<View>("landing");
  const [meals, setMeals] = useState<Meal[]>(INITIAL_MEALS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [selectedArea, setSelectedArea] = useState<string>("Central");

  // "API" Call: Register Meal
  const handleRegisterMeal = (newMeal: Omit<Meal, "id">) => {
    // Simulate server latency
    setTimeout(() => {
      const meal = { ...newMeal, id: Math.random().toString(36).substr(2, 9) };
      setMeals([...meals, meal]);
      alert("Meal registered successfully!");
      setView("landing");
    }, 800);
  };

  // "API" Call: Place Order
  const handlePlaceOrder = (address: string) => {
    if (cart.length === 0) return;

    // Logic for estimated time: Max prep time of items + 15 min delivery
    const maxPrep = Math.max(...cart.map((i) => i.prepTime));
    const estimatedTime = maxPrep + 15;
    const total = cart.reduce((sum, item) => sum + item.price, 0);

    const newOrder: Order = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      items: [...cart],
      total,
      address,
      estimatedTime,
      status: "confirmed",
    };

    setOrder(newOrder);
    setCart([]);
    setView("confirmation");
  };

  const addToCart = (meal: Meal) => {
    setCart([...cart, { ...meal, cartId: Math.random().toString(36) }]);
  };

  const removeFromCart = (cartId: string) => {
    setCart(cart.filter((i) => i.cartId !== cartId));
  };

  const renderView = () => {
    switch (view) {
      case "landing":
        return <Landing setView={setView} />;
      case "restaurant":
        return <RestaurantPortal onRegister={handleRegisterMeal} onBack={() => setView("landing")} />;
      case "customer":
        return (
          <CustomerPortal
            meals={meals}
            cart={cart}
            selectedArea={selectedArea}
            setSelectedArea={setSelectedArea}
            addToCart={addToCart}
            removeFromCart={removeFromCart}
            onCheckout={handlePlaceOrder}
            onBack={() => setView("landing")}
          />
        );
      case "confirmation":
        return <ConfirmationPage order={order} onHome={() => setView("landing")} />;
      default:
        return <Landing setView={setView} />;
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.logo} onClick={() => setView("landing")}>
          Campus Eats
        </div>
        {view === "landing" && (
          <nav>
            <span style={{ color: "#666", fontSize: "14px" }}>
              Simplified Uber Eats on Azure
            </span>
          </nav>
        )}
      </header>
      {renderView()}
    </div>
  );
};

const Landing = ({ setView }: { setView: (v: View) => void }) => (
  <div style={styles.hero}>
    <h1 style={styles.heroTitle}>Hungry? We got you.</h1>
    <p style={styles.heroSubtitle}>
      Connecting students with the best local food. <br />
      Powered by serverless tech.
    </p>
    <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
      <button
        style={styles.button}
        onClick={() => setView("customer")}
      >
        I'm a Customer
      </button>
      <button
        style={{ ...styles.secondaryButton, backgroundColor: "#333", color: "white" }}
        onClick={() => setView("restaurant")}
      >
        I'm a Restaurant
      </button>
    </div>
  </div>
);

const RestaurantPortal = ({
  onRegister,
  onBack,
}: {
  onRegister: (m: Omit<Meal, "id">) => void;
  onBack: () => void;
}) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    prepTime: "",
    restaurantName: "",
    area: "Central",
    imageUrl: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRegister({
      name: formData.name,
      description: formData.description,
      price: parseFloat(formData.price),
      prepTime: parseInt(formData.prepTime),
      restaurantName: formData.restaurantName,
      area: formData.area,
      imageUrl: formData.imageUrl || undefined,
    });
  };

  return (
    <div>
      <div style={{ marginBottom: "20px", display: "flex", alignItems: "center" }}>
        <button style={{ ...styles.secondaryButton, padding: "8px 16px" }} onClick={onBack}>
          ← Back
        </button>
        <h2 style={{ margin: 0 }}>Restaurant Portal</h2>
      </div>
      <form style={styles.form} onSubmit={handleSubmit}>
        <h3 style={{ marginTop: 0 }}>Register New Meal</h3>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Restaurant Name</label>
          <input
            style={styles.input}
            required
            value={formData.restaurantName}
            onChange={(e) => setFormData({ ...formData, restaurantName: e.target.value })}
            placeholder="e.g. Joe's Burgers"
          />
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Meal Name</label>
          <input
            style={styles.input}
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Spicy Chicken"
          />
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Description</label>
          <textarea
            style={{ ...styles.input, minHeight: "80px" }}
            required
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Ingredients, taste, etc."
          />
        </div>
        <div style={{ display: "flex", gap: "20px" }}>
          <div style={{ ...styles.inputGroup, flex: 1 }}>
            <label style={styles.label}>Price ($)</label>
            <input
              style={styles.input}
              type="number"
              step="0.01"
              required
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            />
          </div>
          <div style={{ ...styles.inputGroup, flex: 1 }}>
            <label style={styles.label}>Prep Time (mins)</label>
            <input
              style={styles.input}
              type="number"
              required
              value={formData.prepTime}
              onChange={(e) => setFormData({ ...formData, prepTime: e.target.value })}
            />
          </div>
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Delivery Area</label>
          <select
            style={styles.select}
            value={formData.area}
            onChange={(e) => setFormData({ ...formData, area: e.target.value })}
          >
            <option value="Central">Central Campus</option>
            <option value="North">North Campus</option>
            <option value="South">South Campus</option>
            <option value="Downtown">Downtown</option>
          </select>
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Image URL (Optional)</label>
          <input
             style={styles.input}
             value={formData.imageUrl}
             onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
             placeholder="https://..."
          />
        </div>
        <button type="submit" style={{ ...styles.button, width: "100%" }}>
          Register Meal
        </button>
      </form>
    </div>
  );
};

const CustomerPortal = ({
  meals,
  cart,
  selectedArea,
  setSelectedArea,
  addToCart,
  removeFromCart,
  onCheckout,
  onBack,
}: {
  meals: Meal[];
  cart: CartItem[];
  selectedArea: string;
  setSelectedArea: (a: string) => void;
  addToCart: (m: Meal) => void;
  removeFromCart: (id: string) => void;
  onCheckout: (addr: string) => void;
  onBack: () => void;
}) => {
  const [showCheckout, setShowCheckout] = useState(false);
  const [address, setAddress] = useState("");

  const filteredMeals = meals.filter((m) => m.area === selectedArea);
  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button style={{ ...styles.secondaryButton, padding: "8px 16px" }} onClick={onBack}>
            ← Back
          </button>
          <select
            style={{ ...styles.select, width: "auto", minWidth: "200px" }}
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
          >
            <option value="Central">Central Campus</option>
            <option value="North">North Campus</option>
            <option value="South">South Campus</option>
            <option value="Downtown">Downtown</option>
          </select>
        </div>
        <div>{filteredMeals.length} results near you</div>
      </div>

      <div style={styles.grid}>
        {filteredMeals.map((meal) => (
          <div key={meal.id} style={styles.card}>
            {meal.imageUrl ? (
                <img src={meal.imageUrl} alt={meal.name} style={styles.cardImage} />
            ) : (
                <div style={{...styles.cardImage, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888'}}>
                    No Image
                </div>
            )}
            <div style={styles.cardContent}>
              <div style={styles.cardTitle}>{meal.name}</div>
              <div style={styles.cardMeta}>{meal.restaurantName}</div>
              <div style={styles.cardMeta}>🕒 {meal.prepTime} mins</div>
              <div style={{ fontSize: "14px", color: "#555", margin: "10px 0", flex: 1 }}>
                {meal.description}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
                <span style={styles.cardPrice}>${meal.price.toFixed(2)}</span>
                <button
                  style={{ ...styles.button, padding: "8px 16px", fontSize: "14px" }}
                  onClick={() => addToCart(meal)}
                >
                  Add +
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredMeals.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
          No meals found in this area. Try selecting another area.
        </div>
      )}

      {/* Cart Widget */}
      {cart.length > 0 && (
        <div style={styles.cart}>
          <h3 style={{ marginTop: 0 }}>Your Cart</h3>
          <div style={{ maxHeight: "300px", overflowY: "auto" }}>
            {cart.map((item) => (
              <div key={item.cartId} style={styles.cartItem}>
                <div>
                  <div style={{ fontWeight: "bold" }}>{item.name}</div>
                  <div style={{ fontSize: "12px", color: "#666" }}>${item.price.toFixed(2)}</div>
                </div>
                <button
                  onClick={() => removeFromCart(item.cartId)}
                  style={{ background: "none", border: "none", color: "red", cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div style={styles.checkoutSummary}>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", marginBottom: "15px" }}>
              <span>Total</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>
            {showCheckout ? (
              <div>
                <input
                  style={{ ...styles.input, marginBottom: "10px" }}
                  placeholder="Delivery Address / Room #"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  autoFocus
                />
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    style={{ ...styles.button, width: "100%" }}
                    onClick={() => onCheckout(address)}
                    disabled={!address}
                  >
                    Confirm Order
                  </button>
                  <button
                    style={{ ...styles.secondaryButton, width: "auto" }}
                    onClick={() => setShowCheckout(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button style={{ ...styles.button, width: "100%" }} onClick={() => setShowCheckout(true)}>
                Checkout
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ConfirmationPage = ({ order, onHome }: { order: Order | null; onHome: () => void }) => {
  if (!order) return null;

  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
      <div style={{ ...styles.card, padding: "40px", maxWidth: "500px", width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: "60px", marginBottom: "20px" }}>🎉</div>
        <h2 style={{ color: "#06C167", marginBottom: "10px" }}>Order Confirmed!</h2>
        <p style={{ color: "#666", marginBottom: "30px" }}>
          Order ID: <strong>{order.id}</strong>
        </p>

        <div style={{ textAlign: "left", backgroundColor: "#f9f9f9", padding: "20px", borderRadius: "8px", marginBottom: "20px" }}>
          <h4 style={{ marginTop: 0 }}>Summary</h4>
          {order.items.map((item, idx) => (
            <div key={idx} style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "14px" }}>
              <span>{item.name}</span>
              <span>${item.price.toFixed(2)}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid #ddd", marginTop: "10px", paddingTop: "10px", display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
            <span>Total</span>
            <span>${order.total.toFixed(2)}</span>
          </div>
        </div>

        <div style={{ marginBottom: "30px" }}>
          <div style={{ fontSize: "14px", color: "#666" }}>Estimated Delivery</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#333" }}>{order.estimatedTime} mins</div>
          <div style={{ fontSize: "14px", color: "#666", marginTop: "5px" }}>to {order.address}</div>
        </div>

        <button style={styles.button} onClick={onHome}>
          Place Another Order
        </button>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
