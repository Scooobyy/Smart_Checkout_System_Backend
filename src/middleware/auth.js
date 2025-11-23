const { verifyToken } = require('../utils/helpers');
const { errorResponse } = require('../utils/helpers');
const adminModel = require('../models/adminModel');

const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(
        errorResponse('Access token required')
      );
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    
    // Verify token
    const decoded = verifyToken(token);
    
    // Check if admin still exists and is active
    const admin = await adminModel.findAdminById(decoded.id);
    if (!admin || !admin.is_active) {
      return res.status(401).json(
        errorResponse('Invalid or expired token')
      );
    }

    // Add admin to request
    req.admin = {
      id: admin.id,
      email: admin.email,
      role: admin.role
    };

    next();
  } catch (error) {
    return res.status(401).json(
      errorResponse('Invalid or expired token')
    );
  }
};

// Role-based authorization middleware
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.admin.role)) {
      return res.status(403).json(
        errorResponse('Insufficient permissions')
      );
    }
    next();
  };
};

module.exports = {
  authenticateAdmin,
  requireRole
};