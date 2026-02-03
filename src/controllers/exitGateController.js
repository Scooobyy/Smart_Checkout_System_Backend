const exitGateModel = require('../models/exitGateModel');
const tagModel = require('../models/tagModel');
const { successResponse, errorResponse, validateRequiredFields } = require('../utils/helpers');

class ExitGateController {
  
  // Initialize exit session
  async initializeExitSession(req, res, next) {
    try {
      const { customer_id } = req.body;
      
      // Generate unique session ID
      const sessionId = `exit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const exitSession = await exitGateModel.createExitSession(sessionId, customer_id);

      res.status(201).json(
        successResponse('Exit session initialized', {
          session_id: exitSession.session_id,
          status: exitSession.status,
          created_at: exitSession.created_at
        })
      );

    } catch (error) {
      next(error);
    }
  }

  // Scan UHF tag at exit gate - FIXED
  async scanUHF(req, res, next) {
    try {
      const { session_id } = req.params;
      const { uhf_uid } = req.body;

      validateRequiredFields(req.body, ['uhf_uid']);

      // Get exit session
      const exitSession = await exitGateModel.getExitSession(session_id);
      if (!exitSession) {
        return res.status(404).json(
          errorResponse('Exit session not found')
        );
      }

      // Check if session is active
      if (exitSession.status !== 'pending' && exitSession.status !== 'processing') {
        return res.status(400).json(
          errorResponse('Exit session is not active')
        );
      }

      // Check if product is paid via UHF tag
      const paymentStatus = await tagModel.isProductPaidByUHFTag(uhf_uid);
      
      let productId = null;
      let orderId = null;
      
      if (paymentStatus.isPaid && paymentStatus.order) {
        productId = paymentStatus.product_id;
        orderId = paymentStatus.order.id;
      }

      // Add scanned tag to session
      const scannedItem = await exitGateModel.addScannedUHF(
        exitSession.id,
        uhf_uid,
        productId,
        orderId,
        paymentStatus.isPaid
      );

      // Update session to processing
      await exitGateModel.updateExitSession(session_id, { 
        status: 'processing',
        alert_triggered: false,
        alert_reason: null
      });

      res.json(
        successResponse('UHF tag scanned successfully', {
          uhf_uid: uhf_uid,
          is_paid: paymentStatus.isPaid,
          product_id: productId,
          order_id: orderId,
          reason: paymentStatus.reason,
          session_status: 'processing'
        })
      );

    } catch (error) {
      next(error);
    }
  }

  // Complete exit session (customer leaving) - FIXED VERSION 1
  async completeExitSession(req, res, next) {
    try {
      const { session_id } = req.params;

      // Get exit session
      const exitSession = await exitGateModel.getExitSession(session_id);
      if (!exitSession) {
        return res.status(404).json(
          errorResponse('Exit session not found')
        );
      }

      // Get session summary
      const summary = await exitGateModel.getExitSessionSummary(exitSession.id);
      
      // Ensure we have valid numbers
      const totalScanned = parseInt(summary.total_scanned) || 0;
      const paidCount = parseInt(summary.paid_count) || 0;
      const unpaidCount = parseInt(summary.unpaid_count) || 0;

      console.log('Session summary:', { totalScanned, paidCount, unpaidCount });

      let alertTriggered = false;
      let alertReason = null;
      let finalStatus = 'completed';

      // Check for unpaid items
      if (unpaidCount > 0) {
        alertTriggered = true;
        alertReason = `${unpaidCount} unpaid item(s) detected`;
        finalStatus = 'alert';
      }

      // Update session status with explicit type casting
      const updatedSession = await exitGateModel.updateExitSession(
        session_id,
        {
          status: finalStatus,
          alert_triggered: alertTriggered,
          alert_reason: alertReason,
          total_scanned_tags: totalScanned,
          unpaid_tags_count: unpaidCount
        }
      );

      if (!updatedSession) {
        throw new Error('Failed to update exit session');
      }

      res.json(
        successResponse('Exit session completed', {
          session_id: updatedSession.session_id,
          status: updatedSession.status,
          alert_triggered: updatedSession.alert_triggered,
          alert_reason: updatedSession.alert_reason,
          total_scanned: totalScanned,
          paid_count: paidCount,
          unpaid_count: unpaidCount,
          completed_at: updatedSession.completed_at
        })
      );

    } catch (error) {
      console.error('Error in completeExitSession:', error);
      next(error);
    }
  }

  // Alternative simple completion method - USE THIS FOR TESTING
  async completeExitSessionSimple(req, res, next) {
    try {
      const { session_id } = req.params;

      const updatedSession = await exitGateModel.completeExitSessionSimple(session_id);

      // Get summary for response
      const summary = await exitGateModel.getExitSessionSummary(updatedSession.id);

      res.json(
        successResponse('Exit session completed (simple method)', {
          session_id: updatedSession.session_id,
          status: updatedSession.status,
          alert_triggered: updatedSession.alert_triggered,
          alert_reason: updatedSession.alert_reason,
          total_scanned: summary.total_scanned || 0,
          paid_count: summary.paid_count || 0,
          unpaid_count: summary.unpaid_count || 0,
          completed_at: updatedSession.completed_at
        })
      );

    } catch (error) {
      console.error('Error in completeExitSessionSimple:', error);
      res.status(500).json(
        errorResponse(error.message)
      );
    }
  }

  // Get exit session status
  async getExitSessionStatus(req, res, next) {
    try {
      const { session_id } = req.params;

      const exitSession = await exitGateModel.getExitSessionDetails(session_id);
      if (!exitSession) {
        return res.status(404).json(
          errorResponse('Exit session not found')
        );
      }

      res.json(
        successResponse('Exit session details retrieved', {
          session: exitSession
        })
      );

    } catch (error) {
      next(error);
    }
  }

  // Get all exit sessions (admin)
  async getAllExitSessions(req, res, next) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        status,
        date_from,
        date_to 
      } = req.query;

      const filters = {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        date_from,
        date_to
      };

      const result = await exitGateModel.getAllExitSessions(filters);

      res.json(
        successResponse('Exit sessions retrieved successfully', result)
      );

    } catch (error) {
      next(error);
    }
  }

  // Validate multiple UHF tags in real-time (for hardware integration)
  async validateUHFTags(req, res, next) {
    try {
      const { uhf_uids } = req.body;

      validateRequiredFields(req.body, ['uhf_uids']);

      if (!Array.isArray(uhf_uids) || uhf_uids.length === 0) {
        return res.status(400).json(
          errorResponse('uhf_uids must be a non-empty array')
        );
      }

      const validationResult = await tagModel.validateExitUHFTags(uhf_uids);

      res.json(
        successResponse('UHF tags validated successfully', validationResult)
      );

    } catch (error) {
      next(error);
    }
  }

  // Check single UHF tag status
  async checkUHFTagStatus(req, res, next) {
    try {
      const { uhf_uid } = req.params;

      const paymentStatus = await tagModel.isProductPaidByUHFTag(uhf_uid);

      res.json(
        successResponse('UHF tag status checked', {
          uhf_uid,
          ...paymentStatus
        })
      );

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ExitGateController();