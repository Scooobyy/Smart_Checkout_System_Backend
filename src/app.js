const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Import routes
const adminRoutes = require('./routes/adminRoutes');
const productRoutes = require('./routes/productRoutes');
const tagRoutes = require('./routes/tagRoutes');
const customerRoutes = require('./routes/customerRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const exitGateRoutes = require('./routes/exitGateRoutes'); // ADD THIS
const qrRoutes = require('./routes/qrRoutes');
// Import middleware
const errorHandler = require('./middleware/errorHandler');

const app = express();

/* ======================
   SECURITY MIDDLEWARE
====================== */
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));

/* ======================
   BODY PARSING
====================== */
// Webhook needs raw body (important: keep this BEFORE express.json)
app.use('/api/orders/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* ======================
   HEALTH CHECK
====================== */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running healthy',
    timestamp: new Date().toISOString(),
  });
});

/* ======================
   API ROUTES
====================== */
app.use('/api/admin', adminRoutes);
app.use('/api/products', productRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/exit-gate', exitGateRoutes); // ADD THIS
app.use('/api/qr', qrRoutes);

/* ======================
   404 HANDLER (FIXED)
====================== */
// ❌ DO NOT use '' or '*' in Express 5
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found`,
  });
});

/* ======================
   GLOBAL ERROR HANDLER
====================== */
app.use(errorHandler);

module.exports = app;
