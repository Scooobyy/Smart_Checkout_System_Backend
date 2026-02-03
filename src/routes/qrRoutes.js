const express = require('express');
const router = express.Router();
const qrController = require('../controllers/qrController');
const { authenticateAdmin, requireRole } = require('../middleware/auth');
const { authenticateCartSession } = require('../middleware/customerAuth');
const { ROLES } = require('../utils/constants');

// Public routes
router.get('/product/:qr_data', qrController.getProductByQRCode);

// Protected customer routes (require cart session)
router.use(authenticateCartSession);
router.post('/scan', qrController.scanQRCode);
router.post('/scan/sku', qrController.scanSKU);

// Admin routes
router.post('/generate/:product_id', authenticateAdmin, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN]), qrController.generateQRCode);

module.exports = router;