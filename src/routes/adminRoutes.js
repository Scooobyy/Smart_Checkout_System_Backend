const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateAdmin, requireRole } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

// Public routes
router.post('/auth/register-first', adminController.registerFirstAdmin);
router.post('/auth/login', adminController.login);

// Protected routes
router.get('/profile', authenticateAdmin, adminController.getProfile);
router.get('/admins', authenticateAdmin, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN]), adminController.getAllAdmins);

module.exports = router;