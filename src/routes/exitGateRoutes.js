const express = require('express');
const router = express.Router();
const exitGateController = require('../controllers/exitGateController');
const { authenticateAdmin, requireRole } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');
const securityLogModel = require('../models/securityLogModel');

// Public routes (for hardware/RFID reader)
router.post('/session/initialize', exitGateController.initializeExitSession);
router.post('/session/:session_id/scan', exitGateController.scanUHF);
router.post('/session/:session_id/complete', exitGateController.completeExitSession);
router.post('/session/:session_id/complete-simple', exitGateController.completeExitSessionSimple); // ADD THIS
router.get('/session/:session_id/status', exitGateController.getExitSessionStatus);
router.post('/validate', exitGateController.validateUHFTags);
router.get('/check/:uhf_uid', exitGateController.checkUHFTagStatus);

router.get('/security/summary', authenticateAdmin, async (req, res) => {
  try {
    const summary = await securityLogModel.getSecuritySummary();
    const recentAlerts = await securityLogModel.getRecentAlerts(10);
    res.json(successResponse('Security summary', { summary, recentAlerts }));
  } catch (error) {
    res.status(500).json(errorResponse(error.message));
  }
});

// Admin routes
router.get('/sessions', authenticateAdmin, requireRole([ROLES.SUPER_ADMIN, ROLES.ADMIN]), exitGateController.getAllExitSessions);

module.exports = router;