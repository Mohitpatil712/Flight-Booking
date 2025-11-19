require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const fs = require('fs');
const db = require('./db/sqlite');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_production';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

db.initializeDatabase().catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});

// JWT middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Access token required' });
  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// ===== AUTH =====
app.post('/api/register', async (req, res) => {
  const { username, email, password, firstName, lastName, phone } = req.body;
  try {
    const exists = await db.getAsync('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
    if (exists) return res.status(400).json({ error: 'User already exists' });

    const hashed = await bcrypt.hash(password, 10);
    await db.runAsync(
      'INSERT INTO users (username, email, password, first_name, last_name, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [username, email, hashed, firstName, lastName, phone]
    );
    res.status(201).json({ message: 'Registered' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await db.getAsync('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, firstName: user.first_name, lastName: user.last_name }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== FLIGHTS =====
app.get('/api/flights/search', async (req, res) => {
  const { departure, arrival, date, passengers } = req.query;
  try {
    if (!departure || !arrival || !date) return res.status(400).json({ error: 'Missing required search fields' });

    const searchDate = new Date(date).toISOString().split('T')[0];
    const passengerCount = parseInt(passengers) || 1;

    const flights = await db.allAsync(
      `
      SELECT
        f.id, f.flight_number, f.airline, f.departure_city, f.arrival_city,
        f.departure_time, f.arrival_time, f.price, f.total_seats, f.available_seats,
        COUNT(CASE WHEN s.is_available = 1 THEN 1 END) AS available_seats_count
      FROM flights f
      LEFT JOIN seats s ON f.id = s.flight_id
      WHERE LOWER(f.departure_city) = LOWER(?)
        AND LOWER(f.arrival_city) = LOWER(?)
      GROUP BY f.id
      ORDER BY f.departure_time ASC
      `,
      [departure.trim(), arrival.trim()]
    );

    const availableFlights = flights.filter(f => (f.available_seats_count || 0) >= passengerCount);
    res.json(availableFlights);
  } catch (err) {
    console.error('Flight search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/flights/:id', async (req, res) => {
  const flightId = req.params.id;
  try {
    const flight = await db.getAsync('SELECT id, flight_number, airline, departure_city, arrival_city, departure_time, arrival_time, price, total_seats, available_seats FROM flights WHERE id = ?', [flightId]);
    if (!flight) return res.status(404).json({ error: 'Flight not found' });

    const seats = await db.allAsync('SELECT id, seat_number, class, is_available, price_multiplier FROM seats WHERE flight_id = ? ORDER BY id ASC', [flightId]);
    res.json({ flight, seats });
  } catch (err) {
    console.error('Flight details error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== BOOKINGS =====
app.post('/api/bookings', authenticateToken, async (req, res) => {
  const { flightId, seatId, passengerName, passengerEmail, passengerPhone } = req.body;
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    await db.beginTransaction();

    const seat = await db.getAsync('SELECT * FROM seats WHERE id = ? AND is_available = 1', [seatId]);
    if (!seat) {
      await db.rollback();
      return res.status(400).json({ error: 'Seat not available' });
    }

    const flight = await db.getAsync('SELECT * FROM flights WHERE id = ?', [flightId]);
    if (!flight) {
      await db.rollback();
      return res.status(404).json({ error: 'Flight not found' });
    }

    const totalAmount = flight.price * seat.price_multiplier;
    const bookingReference = 'BK' + Date.now();

    const insertResult = await db.runAsync(
      `INSERT INTO bookings (user_id, flight_id, seat_id, booking_reference, total_amount, passenger_name, passenger_email, passenger_phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, flightId, seatId, bookingReference, totalAmount, passengerName, passengerEmail, passengerPhone]
    );

    await db.runAsync('UPDATE seats SET is_available = 0 WHERE id = ?', [seatId]);
    await db.runAsync('UPDATE flights SET available_seats = available_seats - 1 WHERE id = ?', [flightId]);

    await db.commit();

    res.status(201).json({
      bookingId: insertResult.lastID,
      bookingReference,
      totalAmount
    });
  } catch (err) {
    await db.rollback();
    console.error('Booking error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/bookings/:id/cancel', authenticateToken, async (req, res) => {
  try {
    await db.beginTransaction();
    const booking = await db.getAsync('SELECT * FROM bookings WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!booking) {
      await db.rollback();
      return res.status(404).json({ error: 'Booking not found' });
    }

    await db.runAsync('UPDATE bookings SET status = ? WHERE id = ?', ['cancelled', req.params.id]);
    await db.runAsync('UPDATE seats SET is_available = 1 WHERE id = ?', [booking.seat_id]);
    await db.runAsync('UPDATE flights SET available_seats = available_seats + 1 WHERE id = ?', [booking.flight_id]);

    await db.commit();
    res.json({ message: 'Booking cancelled successfully' });
  } catch (err) {
    await db.rollback();
    console.error('Cancellation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== PAYMENTS =====
app.post('/api/payments', authenticateToken, async (req, res) => {
  const { bookingId, paymentMethod } = req.body;
  try {
    const transactionId = 'TXN' + Date.now();
    await db.runAsync(
      `INSERT INTO payments (booking_id, payment_method, payment_status, transaction_id, amount)
       SELECT ?, ?, 'completed', ?, total_amount FROM bookings WHERE id = ?`,
      [bookingId, paymentMethod, transactionId, bookingId]
    );

    const booking = await db.getAsync(
      `SELECT b.*, f.flight_number, f.departure_city, f.arrival_city, f.departure_time, f.arrival_time
       FROM bookings b JOIN flights f ON b.flight_id = f.id WHERE b.id = ?`,
      [bookingId]
    );
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const pdfDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir);
    const pdfPath = path.join(pdfDir, `booking_${booking.booking_reference}.pdf`);

    const doc = new PDFDocument();
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);
    doc.fontSize(18).text('Flight Booking Confirmation', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Booking Ref: ${booking.booking_reference}`);
    doc.text(`Passenger: ${booking.passenger_name}`);
    doc.text(`Flight: ${booking.flight_number}`);
    doc.text(`From: ${booking.departure_city}`);
    doc.text(`To: ${booking.arrival_city}`);
    doc.text(`Departure: ${booking.departure_time}`);
    doc.text(`Arrival: ${booking.arrival_time}`);
    doc.text(`Amount: ₹${booking.total_amount}`);
    doc.text(`Transaction: ${transactionId}`);
    doc.end();

    stream.on('finish', async () => {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: booking.passenger_email,
        subject: 'Booking Confirmation',
        text: `Dear ${booking.passenger_name},\nBooking Ref: ${booking.booking_reference}\nTransaction ID: ${transactionId}`,
        attachments: [{ filename: 'BookingConfirmation.pdf', path: pdfPath }]
      };

      try {
        await transporter.sendMail(mailOptions);
        fs.unlinkSync(pdfPath);
        res.json({ message: 'Payment successful and email sent', transactionId });
      } catch (mailErr) {
        console.error('Email error:', mailErr);
        res.json({ message: 'Payment successful (email failed)', transactionId });
      }
    });

    stream.on('error', (err) => {
      console.error('PDF stream error:', err);
      res.status(500).json({ error: 'Failed to generate PDF' });
    });
  } catch (err) {
    console.error('Payment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== USER BOOKINGS =====
app.get('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const bookings = await db.allAsync(
      `SELECT b.*, f.flight_number, f.airline, f.departure_city, f.arrival_city, f.departure_time, f.arrival_time, s.seat_number, s.class, p.payment_status, p.transaction_id
       FROM bookings b
       JOIN flights f ON b.flight_id = f.id
       JOIN seats s ON b.seat_id = s.id
       LEFT JOIN payments p ON b.id = p.booking_id
       WHERE b.user_id = ?
       ORDER BY b.booking_date DESC`,
      [req.user.id]
    );
    res.json(bookings);
  } catch (err) {
    console.error('Bookings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
