DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS seats;
DROP TABLE IF EXISTS flights;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE flights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    flight_number TEXT UNIQUE NOT NULL,
    airline TEXT NOT NULL,
    departure_city TEXT NOT NULL,
    arrival_city TEXT NOT NULL,
    departure_time DATETIME NOT NULL,
    arrival_time DATETIME NOT NULL,
    price REAL NOT NULL,
    total_seats INTEGER NOT NULL,
    available_seats INTEGER NOT NULL
);

CREATE TABLE seats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    flight_id INTEGER,
    seat_number TEXT NOT NULL,
    class TEXT DEFAULT 'economy' CHECK(class IN ('economy', 'business', 'first')),
    is_available BOOLEAN DEFAULT 1,
    price_multiplier REAL DEFAULT 1.00,
    FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE
);

CREATE TABLE bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    flight_id INTEGER,
    seat_id INTEGER,
    booking_reference TEXT UNIQUE NOT NULL,
    total_amount REAL NOT NULL,
    booking_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'confirmed' CHECK(status IN ('confirmed', 'cancelled', 'pending')),
    passenger_name TEXT NOT NULL,
    passenger_email TEXT NOT NULL,
    passenger_phone TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE,
    FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE CASCADE
);

CREATE TABLE payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER,
    payment_method TEXT NOT NULL,
    payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'completed', 'failed')),
    transaction_id TEXT,
    amount REAL NOT NULL,
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

INSERT INTO flights (flight_number, airline, departure_city, arrival_city, departure_time, arrival_time, price, total_seats, available_seats) VALUES
('AA123', 'American Airlines', 'New York', 'Los Angeles', '2025-11-15 08:00:00', '2025-11-15 11:00:00', 299.99, 180, 180);

INSERT INTO flights (flight_number, airline, departure_city, arrival_city, departure_time, arrival_time, price, total_seats, available_seats) VALUES
('UA456', 'United Airlines', 'Chicago', 'Miami', '2025-11-15 14:30:00', '2025-11-15 17:45:00', 199.99, 180, 180);

INSERT INTO flights (flight_number, airline, departure_city, arrival_city, departure_time, arrival_time, price, total_seats, available_seats) VALUES
('DL789', 'Delta Airlines', 'San Francisco', 'Seattle', '2025-11-15 09:15:00', '2025-11-15 11:30:00', 149.99, 180, 180);

INSERT INTO seats (flight_id, seat_number, class, price_multiplier) VALUES (1, '1A', 'first', 3.0);
INSERT INTO seats (flight_id, seat_number, class, price_multiplier) VALUES (1, '1B', 'first', 3.0);
INSERT INTO seats (flight_id, seat_number, class, price_multiplier) VALUES (1, '1C', 'first', 3.0);
INSERT INTO seats (flight_id, seat_number, class, price_multiplier) VALUES (1, '10A', 'business', 2.0);
INSERT INTO seats (flight_id, seat_number, class, price_multiplier) VALUES (1, '10B', 'business', 2.0);
INSERT INTO seats (flight_id, seat_number, class, price_multiplier) VALUES (1, '10C', 'business', 2.0);
INSERT INTO seats (flight_id, seat_number, class, price_multiplier) VALUES (1, '20A', 'economy', 1.0);
INSERT INTO seats (flight_id, seat_number, class, price_multiplier) VALUES (1, '20B', 'economy', 1.0);
INSERT INTO seats (flight_id, seat_number, class, price_multiplier) VALUES (1, '20C', 'economy', 1.0);
INSERT INTO seats (flight_id, seat_number, class, price_multiplier) VALUES (2, '1A', 'first', 3.0);
INSERT INTO seats (flight_id, seat_number, class, price_multiplier) VALUES (2, '1B', 'first', 3.0);
INSERT INTO seats (flight_id, seat_number, class, price_multiplier) VALUES (2, '10A', 'business', 6.0);
INSERT INTO seats (flight_id, seat_number, class, price_multiplier) VALUES (2, '10B', 'business', 6.0);
INSERT INTO seats (flight_id, seat_number, class, price_multiplier) VALUES (2, '20A', 'economy', 6.0);
INSERT INTO seats (flight_id, seat_number, class, price_multiplier) VALUES (2, '20B', 'economy', .0);
INSERT INTO seats (flight_id, seat_number, class, price_multiplier) VALUES (3, '1A', 'first', 3.0);
INSERT INTO seats (flight_id, seat_number, class, price_multiplier) VALUES (3, '1B', 'first', 3.0);
INSERT INTO seats (flight_id, seat_number, class, price_multiplier) VALUES (3, '10A', 'business', 2.0);
INSERT INTO seats (flight_id, seat_number, class, price_multiplier) VALUES (3, '10B', 'business', 2.0);
INSERT INTO seats (flight_id, seat_number, class, price_multiplier) VALUES (3, '20A', 'economy', 1.0);
INSERT INTO seats (flight_id, seat_number, class, price_multiplier) VALUES (3, '20B', 'economy', 1.0);
