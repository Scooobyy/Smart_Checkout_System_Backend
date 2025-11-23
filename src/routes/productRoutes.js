const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateAdmin, requireRole } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

// Public routes (for future customer app)
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);

// Protected admin routes
router.post('/', authenticateAdmin, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER]), productController.createProduct);
router.put('/:id', authenticateAdmin, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER]), productController.updateProduct);
router.delete('/:id', authenticateAdmin, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN]), productController.deleteProduct);
router.get('/inventory/low-stock', authenticateAdmin, productController.getLowStockProducts);

module.exports = router;