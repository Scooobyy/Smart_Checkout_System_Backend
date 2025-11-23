const express = require('express');
const router = express.Router();
const tagController = require('../controllers/tagController');
const { authenticateAdmin, requireRole } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');

// Public routes (for scanning)
router.get('/scan/:tag_uid', tagController.scanTag);
router.get('/:tag_uid', tagController.getTagByUid);

// Protected admin routes
router.post('/', authenticateAdmin, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER]), tagController.createTag);
router.post('/bulk', authenticateAdmin, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN]), tagController.createBulkTags);
router.get('/', authenticateAdmin, tagController.getAllTags);
router.get('/available/list', authenticateAdmin, tagController.getAvailableTags);
router.get('/product/:product_id', authenticateAdmin, tagController.getTagsByProduct);
router.put('/:tag_id/assign', authenticateAdmin, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER]), tagController.assignTagToProduct);
router.put('/:tag_id/unassign', authenticateAdmin, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER]), tagController.unassignTag);

module.exports = router;