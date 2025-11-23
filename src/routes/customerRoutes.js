const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticateCustomer } = require('../middleware/customerAuth');

// Public routes
router.post('/register', customerController.register);
router.post('/login', customerController.login);
router.post('/guest', customerController.createGuest);

// Protected customer routes
router.get('/profile', authenticateCustomer, customerController.getProfile);

module.exports = router;