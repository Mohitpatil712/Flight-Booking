console.log("SkyBook frontend loaded ✅");

class FlightBookingSystem {
  constructor() {
    this.currentUser = null;
    this.token = null;
    this.selectedFlight = null;
    this.selectedSeat = null;
    this.currentBooking = null;
    this.initializeEventListeners();
    this.checkAuthStatus();
  }

  initializeEventListeners() {
    // Auth
    document.getElementById("loginBtn").addEventListener("click", () => this.showModal("loginModal"));
    document.getElementById("registerBtn").addEventListener("click", () => this.showModal("registerModal"));
    document.getElementById("logoutBtn").addEventListener("click", () => this.logout());

    // Close modals
    document.querySelectorAll(".close").forEach(btn =>
      btn.addEventListener("click", e => e.target.closest(".modal").classList.add("hidden"))
    );

    // Forms
    document.getElementById("searchForm").addEventListener("submit", e => this.searchFlights(e));
    document.getElementById("loginForm")?.addEventListener("submit", e => this.login(e));
    document.getElementById("registerForm")?.addEventListener("submit", e => this.register(e));
    document.getElementById("passengerForm")?.addEventListener("submit", e => this.createBooking(e));
    document.getElementById("paymentForm")?.addEventListener("submit", e => this.processPayment(e));

    // Passenger count
    document.addEventListener("click", e => {
      if (e.target.matches(".passenger-btn")) {
        e.preventDefault();
        const type = e.target.dataset.type;
        const action = e.target.dataset.action;
        this.updatePassengerCount(type, action);
      }
    });

    // Tabs
    document.querySelectorAll(".tab-btn").forEach(tab => {
      tab.addEventListener("click", e => {
        document.querySelectorAll(".tab-btn").forEach(t => t.classList.remove("active"));
        e.currentTarget.classList.add("active");
        const returnGroup = document.querySelector(".return-date-group");
        if (e.currentTarget.dataset.type === "oneway") {
          returnGroup.style.display = "none";
        } else {
          returnGroup.style.display = "block";
        }
      });
    });

    // Proceed button
    const proceedBtn = document.getElementById("proceedToBooking");
    if (proceedBtn) {
      proceedBtn.addEventListener("click", () => this.proceedToBooking());
    }

    // Return date validation
    document.getElementById("departureDate").addEventListener("change", () => this.updateReturnDateMin());
    document.getElementById("returnDate").addEventListener("change", () => this.validateReturnDate());
  }

  checkAuthStatus() {
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");
    if (token && user) {
      this.token = token;
      this.currentUser = JSON.parse(user);
      this.updateUI();
    }
  }

  updateUI() {
    const authButtons = document.querySelector(".auth-buttons");
    const userMenu = document.querySelector(".user-menu");
    if (this.currentUser) {
      authButtons.classList.add("hidden");
      userMenu.classList.remove("hidden");
      document.getElementById("userName").textContent =
        this.currentUser.firstName || this.currentUser.username;
    } else {
      authButtons.classList.remove("hidden");
      userMenu.classList.add("hidden");
    }
  }

  showModal(id) {
    document.getElementById(id).classList.remove("hidden");
  }

  async register(e) {
    e.preventDefault();
    const body = {
      username: document.getElementById("regUsername").value,
      email: document.getElementById("regEmail").value,
      password: document.getElementById("regPassword").value,
      firstName: document.getElementById("regFirstName").value,
      lastName: document.getElementById("regLastName").value,
      phone: document.getElementById("regPhone").value
    };

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        alert("Registration successful! Please login.");
        document.getElementById("registerModal").classList.add("hidden");
      } else {
        alert(data.error || "Registration failed");
      }
    } catch (err) {
      console.error("Register error:", err);
      alert("Error during registration.");
    }
  }

  async login(e) {
    e.preventDefault();
    const body = {
      email: document.getElementById("loginEmail").value,
      password: document.getElementById("loginPassword").value
    };

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        this.token = data.token;
        this.currentUser = data.user;
        localStorage.setItem("token", this.token);
        localStorage.setItem("user", JSON.stringify(this.currentUser));
        this.updateUI();
        document.getElementById("loginModal").classList.add("hidden");
        alert("Login successful!");
      } else {
        alert(data.error || "Invalid credentials");
      }
    } catch (err) {
      console.error("Login error:", err);
      alert("Login failed.");
    }
  }

  logout() {
    localStorage.clear();
    this.currentUser = null;
    this.token = null;
    this.updateUI();
    alert("Logged out successfully!");
  }

  updatePassengerCount(type, action) {
    const el = document.getElementById("adultsCount");
    let count = parseInt(el.textContent);
    if (action === "increase" && count < 9) count++;
    if (action === "decrease" && count > 1) count--;
    el.textContent = count;
  }

  updateReturnDateMin() {
    const dep = document.getElementById("departureDate").value;
    const ret = document.getElementById("returnDate");
    if (dep) ret.min = dep;
  }

  validateReturnDate() {
    const dep = document.getElementById("departureDate").value;
    const ret = document.getElementById("returnDate").value;
    if (dep && ret && ret < dep) {
      alert("Return date cannot be before departure date.");
      document.getElementById("returnDate").value = dep;
    }
  }

  async searchFlights(e) {
    e.preventDefault();
    const formData = {
      departure: document.getElementById("departure").value,
      arrival: document.getElementById("arrival").value,
      date: document.getElementById("departureDate").value,
      passengers: document.getElementById("adultsCount").textContent
    };

    try {
      document.getElementById("flightResults").classList.remove("hidden");
      document.getElementById("resultsList").innerHTML = "<p>Loading...</p>";
      const params = new URLSearchParams(formData);
      const res = await fetch(`/api/flights/search?${params}`);
      const flights = await res.json();

      if (!res.ok) throw new Error(flights.error || "Search failed");
      this.displayFlights(flights);
    } catch (err) {
      console.error("Search error:", err);
      document.getElementById("resultsList").innerHTML =
        "<p>No flights found.</p>";
    }
  }

  displayFlights(flights) {
    const list = document.getElementById("resultsList");
    if (!flights.length) {
      list.innerHTML = "<p>No flights found.</p>";
      return;
    }

    list.innerHTML = flights
      .map(
        f => `
      <div class="flight-card">
        <div class="flight-info">
          <div>
            <div class="time">${this.formatTime(f.departure_time)}</div>
            <div class="city">${f.departure_city}</div>
          </div>
          <div style="min-width:220px">
            <div class="airline">${f.airline} • ${f.flight_number}</div>
            <div class="route">${f.departure_city} → ${f.arrival_city}</div>
            <div class="seats">Available: ${f.available_seats_count}</div>
          </div>
        </div>
        <div style="text-align:right">
          <div class="price">₹${f.price}</div>
          <button class="btn-primary select-flight" data-flight-id="${f.id}">
            Select
          </button>
        </div>
      </div>`
      )
      .join("");

    document.querySelectorAll(".select-flight").forEach(btn =>
      btn.addEventListener("click", e => {
        const id = e.currentTarget.dataset.flightId;
        this.selectFlight(id);
      })
    );
  }

  async selectFlight(id) {
    try {
      const res = await fetch(`/api/flights/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load flight");

      this.selectedFlight = data.flight;
      this.renderSeatMap(data.seats);

      document.getElementById("flightResults").classList.add("hidden");
      document.getElementById("seatSelection").classList.remove("hidden");
      this.updateBookingSummary(this.selectedFlight, null);
    } catch (err) {
      console.error("Select flight error:", err);
      alert("Could not load seat map.");
    }
  }

  renderSeatMap(seats) {
    const seatMap = document.getElementById("seatMap");
    seatMap.innerHTML = "";

    seats.forEach(seat => {
      const el = document.createElement("div");
      el.className = `seat ${seat.is_available ? "available" : "occupied"}`;
      el.textContent = seat.seat_number;
      el.dataset.seatId = seat.id;
      el.dataset.priceMultiplier = seat.price_multiplier;
      el.dataset.class = seat.class;

      if (seat.is_available) {
        el.addEventListener("click", () => this.selectSeat(el, seat));
      }

      seatMap.appendChild(el);
    });
  }

  selectSeat(el, seat) {
    document.querySelectorAll(".seat.selected").forEach(s => s.classList.remove("selected"));
    el.classList.add("selected");
    this.selectedSeat = seat;
    this.updateBookingSummary(this.selectedFlight, seat);
    const btn = document.getElementById("proceedToBooking");
    if (btn) btn.disabled = false;
  }

  updateBookingSummary(flight, seat = null) {
    const summary = document.getElementById("bookingSummary");
    const base = flight.price;
    const multi = seat ? seat.price_multiplier : 1;
    const total = (base * multi).toFixed(2);

    summary.innerHTML = `
      <div><strong>Flight:</strong> ${flight.airline} ${flight.flight_number}</div>
      <div><strong>Route:</strong> ${flight.departure_city} → ${flight.arrival_city}</div>
      <div><strong>Date:</strong> ${this.formatDate(flight.departure_time)}</div>
      ${seat
        ? `<div><strong>Seat:</strong> ${seat.seat_number} (${seat.class})</div>
             <div><strong>Base Price:</strong> ₹${base}</div>
             <div><strong>Seat Multiplier:</strong> ${multi}x</div>
             <div class="summary-total"><strong>Total:</strong> ₹${total}</div>`
        : `<div>Please select a seat</div>`}
    `;
  }

  proceedToBooking() {
    if (!this.selectedSeat) return alert("Select a seat first!");
    if (!this.token) return this.showModal("loginModal");

    document.getElementById("seatSelection").classList.add("hidden");
    document.getElementById("bookingForm").classList.remove("hidden");

    if (this.currentUser) {
      document.getElementById("passengerName").value =
        `${this.currentUser.firstName || ""} ${this.currentUser.lastName || ""}`.trim();
      document.getElementById("passengerEmail").value = this.currentUser.email;
    }
  }

  async createBooking(e) {
    e.preventDefault();

    const payload = {
      flightId: this.selectedFlight.id,
      seatId: this.selectedSeat.id,
      passengerName: document.getElementById("passengerName").value,
      passengerEmail: document.getElementById("passengerEmail").value,
      passengerPhone: document.getElementById("passengerPhone").value
    };

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Booking failed");

      this.currentBooking = data;
      document.getElementById("bookingForm").classList.add("hidden");
      document.getElementById("paymentSection").classList.remove("hidden");
    } catch (err) {
      console.error("Booking error:", err);
      alert("Booking failed.");
    }
  }

  async processPayment(e) {
    e.preventDefault();
    if (!this.currentBooking) return alert("No booking data found");

    const methodEl = document.querySelector(".payment-method.active");
    const paymentMethod = methodEl ? methodEl.dataset.method : "card";

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`
        },
        body: JSON.stringify({
          bookingId: this.currentBooking.bookingId,
          paymentMethod
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment failed");

      alert("Payment successful! Confirmation sent to your email.");
      this.resetFlow();
    } catch (err) {
      console.error("Payment error:", err);
      alert("Payment failed.");
    }
  }

  resetFlow() {
    this.selectedFlight = null;
    this.selectedSeat = null;
    this.currentBooking = null;
    document.querySelectorAll("section").forEach(s => s.classList.add("hidden"));
    document.getElementById("searchForm").reset();
    document.getElementById("flightResults").classList.remove("hidden");
  }

  formatTime(t) {
    return new Date(t).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  formatDate(d) {
    return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }
}

document.addEventListener("DOMContentLoaded", () => new FlightBookingSystem());
