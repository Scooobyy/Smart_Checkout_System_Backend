const { verifyToken } = require('../utils/helpers');
const { errorResponse } = require('../utils/helpers');
const customerModel = require('../models/customerModel');

// Authenticate registered customer
const authenticateCustomer = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(
        errorResponse('Access token required')
      );
    }

    const token = authHeader.substring(7);
    
    // Verify token
    const decoded = verifyToken(token);
    
    if (decoded.type !== 'customer') {
      return res.status(401).json(
        errorResponse('Invalid token type')
      );
    }

    // Check if customer exists and is active
    const customer = await customerModel.findCustomerById(decoded.id);
    if (!customer || !customer.is_active) {
      return res.status(401).json(
        errorResponse('Invalid or expired token')
      );
    }

    // Add customer to request
    req.customer = {
      id: customer.id,
      email: customer.email,
      is_guest: customer.is_guest
    };

    next();
  } catch (error) {
    return res.status(401).json(
      errorResponse('Invalid or expired token')
    );
  }
};

// Authenticate cart session (for both registered and guest customers)
const authenticateCartSession = async (req, res, next) => {
  try {
    const sessionHeader = req.headers['x-cart-session'];
    
    if (!sessionHeader) {
      return res.status(401).json(
        errorResponse('Cart session token required')
      );
    }

    // Verify session token
    const decoded = verifyToken(sessionHeader);
    
    if (decoded.type !== 'cart_session') {
      return res.status(401).json(
        errorResponse('Invalid cart session token')
      );
    }

    // Get cart session
    const cartSession = await customerModel.getCartSessionByToken(sessionHeader);
    if (!cartSession) {
      return res.status(401).json(
        errorResponse('Invalid or expired cart session')
      );
    }

    // Add cart session to request
    req.cart_session = {
      id: cartSession.id,
      customer_id: cartSession.customer_id,
      token: cartSession.session_token
    };

    next();
  } catch (error) {
    return res.status(401).json(
      errorResponse('Invalid or expired cart session token')
    );
  }
};

module.exports = {
  authenticateCustomer,
  authenticateCartSession
};