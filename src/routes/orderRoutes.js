const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const paymentWebhookController = require('../controllers/paymentWebhookController');
const { authenticateCartSession, authenticateCustomer } = require('../middleware/customerAuth');
const { authenticateAdmin, requireRole } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

// Webhook route (no authentication needed - Razorpay calls this)
router.post('/webhook', express.raw({ type: 'application/json' }), paymentWebhookController.handleWebhook);
router.post('/webhook/test', paymentWebhookController.testWebhook);

// Public routes
router.get('/razorpay-key', orderController.getRazorpayKey);

// Add this route before the protected routes section
router.get('/admin/all', authenticateAdmin, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN]), async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const filters = {
      page: parseInt(page),
      limit: parseInt(limit),
      status
    };
    const result = await orderModel.getAllOrders(filters);
    res.json(successResponse('Orders retrieved successfully', result));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
});



// Protected customer routes (require cart session)
router.use(authenticateCartSession);

// Order management routes
router.post('/create', orderController.createOrder);
router.post('/verify', orderController.verifyPayment);
router.get('/:order_id', orderController.getOrder);
router.get('/customer/orders', orderController.getCustomerOrders);
router.put('/:order_id/cancel', orderController.cancelOrder);
router.get('/:order_id/payment-status', orderController.checkPaymentStatus);
router.post('/:order_id/test-payment', orderController.testPayment); // For development only

// Admin routes
router.get('/admin/all', authenticateAdmin, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN]), orderController.getAllOrders);

module.exports = router;