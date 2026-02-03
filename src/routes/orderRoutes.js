const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const razorpayWebhookController = require('../controllers/razorpayWebhookController');
const { authenticateCartSession } = require('../middleware/customerAuth');

// Webhook route (no authentication needed)
router.post('/webhook', razorpayWebhookController.handleWebhook);

// Get Razorpay key (public)
router.get('/razorpay-key', orderController.getRazorpayKey);

// Protected routes (require cart session)
router.use(authenticateCartSession);

// Order management routes
router.post('/create', orderController.createOrder);
router.post('/verify', orderController.verifyPayment);
router.get('/:order_id', orderController.getOrder);
router.get('/customer/orders', orderController.getCustomerOrders);
router.put('/:order_id/cancel', orderController.cancelOrder);








module.exports = router;