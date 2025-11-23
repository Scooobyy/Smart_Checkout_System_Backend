const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { authenticateCartSession, authenticateCustomer } = require('../middleware/customerAuth');

// All cart routes require cart session authentication
router.use(authenticateCartSession);

// Cart management routes
router.get('/', cartController.getCart);
router.get('/summary', cartController.getCartSummary);
router.post('/items', cartController.addToCart);
router.put('/items/:cart_item_id', cartController.updateCartItem);
router.delete('/items/:cart_item_id', cartController.removeFromCart);
router.delete('/clear', cartController.clearCart);

module.exports = router;