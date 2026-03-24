const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const paymentWebhookController = require('../controllers/paymentWebhookController');
const { authenticateCartSession, authenticateCustomer } = require('../middleware/customerAuth');
const { authenticateAdmin, requireRole } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');
const { successResponse, errorResponse } = require('../utils/helpers');
const orderModel = require('../models/orderModel');
const { pool } = require('../config/database');

// Webhook route (no authentication needed - Razorpay calls this)
router.post('/webhook', express.raw({ type: 'application/json' }), paymentWebhookController.handleWebhook);
router.post('/webhook/test', paymentWebhookController.testWebhook);

// Public routes (no authentication)
router.get('/razorpay-key', orderController.getRazorpayKey);

// Payment verification route (no cart session needed)
router.post('/verify', orderController.verifyPayment);

// Debug route (no cart session needed)
router.post('/debug/check-order', async (req, res) => {
  try {
    const { razorpay_order_id } = req.body;
    console.log('Debug check for:', razorpay_order_id);
    
    const order = await orderModel.getOrderByRazorpayOrderId(razorpay_order_id);
    
    // Also get all recent orders
    const recentOrders = await pool.query(
      'SELECT id, payment_intent_id, status FROM orders ORDER BY created_at DESC LIMIT 5'
    );
    
    res.json({
      found_order: order || null,
      recent_orders: recentOrders.rows,
      searched_for: razorpay_order_id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin routes (require admin authentication) - PLACE BEFORE CART SESSION MIDDLEWARE
router.get(
  '/admin/all',
  authenticateAdmin,
  requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN]),
  orderController.getAllOrders
);

// Protected customer routes (require cart session)
router.use(authenticateCartSession);

// Order management routes
router.post('/create', orderController.createOrder);
router.get('/:order_id', orderController.getOrder);
router.get('/customer/orders', orderController.getCustomerOrders);
router.put('/:order_id/cancel', orderController.cancelOrder);
router.get('/:order_id/payment-status', orderController.checkPaymentStatus);
router.post('/:order_id/test-payment', orderController.testPayment); // For development only

module.exports = router;