const express = require('express');
const router = express.Router();
const tagController = require('../controllers/tagController');
const { authenticateAdmin, requireRole } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

// Public routes (for scanning)
router.get('/scan/:uhf_uid', tagController.scanTag);
router.get('/:uhf_uid', tagController.getTagByUid);
router.get('/product/:uhf_uid', tagController.getProductByUHFTag);

// Protected admin routes
router.post('/uhf', authenticateAdmin, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER]), tagController.createUHF);
router.post('/uhf/bulk', authenticateAdmin, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN]), tagController.createBulkUHFTags);
router.get('/', authenticateAdmin, tagController.getAllTags);
router.get('/available/list', authenticateAdmin, tagController.getAvailableTags);
router.get('/product-tags/:product_id', authenticateAdmin, tagController.getTagsByProduct);
router.put('/:uhf_uid/assign', authenticateAdmin, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER]), tagController.assignTagToProduct);
router.put('/:uhf_uid/unassign', authenticateAdmin, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER]), tagController.unassignTag);

module.exports = router;