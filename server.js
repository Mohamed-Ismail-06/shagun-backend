const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to database
connectDB().catch(err => {
  console.error('Fatal: Could not initialize database:', err);
});

const app = express();

// Middleware
app.use(cors());
app.use('/api/webhooks/razorpay', express.raw({ type: 'application/json' }));
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/weddings', require('./routes/wedding'));
app.use('/api/ceremonies', require('./routes/ceremony'));
app.use('/api/qr-codes', require('./routes/qrCode'));
app.use('/api/payments', require('./routes/payment'));
app.use('/api/webhooks', require('./routes/webhook'));

// Basic route
app.get('/', (req, res) => {
  res.send('API is running...');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Global unhandled rejection handler to aid debugging
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
