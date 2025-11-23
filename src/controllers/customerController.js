const customerModel = require('../models/customerModel');
const { generateToken, verifyPassword, successResponse, errorResponse, validateRequiredFields } = require('../utils/helpers');

class CustomerController {
  
  // Customer registration
  async register(req, res, next) {
    try {
      const { email, password, first_name, last_name, phone } = req.body;

      validateRequiredFields(req.body, ['email', 'password', 'first_name']);

      // Password strength check
      if (password.length < 6) {
        return res.status(400).json(
          errorResponse('Password must be at least 6 characters long')
        );
      }

      const customerData = {
        email,
        password,
        first_name,
        last_name,
        phone,
        is_guest: false
      };

      const customer = await customerModel.createCustomer(customerData);

      // Generate JWT token
      const token = generateToken({
        id: customer.id,
        email: customer.email,
        type: 'customer'
      });

      res.status(201).json(
        successResponse('Customer registered successfully', {
          customer: {
            id: customer.id,
            email: customer.email,
            first_name: customer.first_name,
            last_name: customer.last_name,
            phone: customer.phone
          },
          token
        })
      );

    } catch (error) {
      next(error);
    }
  }

  // Customer login
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      validateRequiredFields(req.body, ['email', 'password']);

      // Find customer
      const customer = await customerModel.findCustomerByEmail(email);
      if (!customer) {
        return res.status(401).json(
          errorResponse('Invalid credentials')
        );
      }

      // Check if customer is active
      if (!customer.is_active) {
        return res.status(403).json(
          errorResponse('Account is deactivated')
        );
      }

      // Verify password
      const isPasswordValid = await verifyPassword(password, customer.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json(
          errorResponse('Invalid credentials')
        );
      }

      // Update last login
      await customerModel.updateCustomerLogin(customer.id);

      // Generate session token for cart
      const sessionToken = generateToken({ 
        customer_id: customer.id,
        type: 'cart_session'
      }, '24h');

      // Create or get cart session
      let cartSession = await customerModel.getActiveCartSession(customer.id);
      if (!cartSession) {
        cartSession = await customerModel.createCartSession(customer.id, sessionToken);
      }

      // Generate auth token
      const authToken = generateToken({
        id: customer.id,
        email: customer.email,
        type: 'customer'
      });

      res.json(
        successResponse('Login successful', {
          customer: {
            id: customer.id,
            email: customer.email,
            first_name: customer.first_name,
            last_name: customer.last_name,
            phone: customer.phone
          },
          cart_session: {
            id: cartSession.id,
            token: cartSession.session_token
          },
          token: authToken
        })
      );

    } catch (error) {
      next(error);
    }
  }

  // Create guest customer
  async createGuest(req, res, next) {
    try {
      const guestCustomer = await customerModel.createGuestCustomer();

      // Generate session token for cart
      const sessionToken = generateToken({ 
        customer_id: guestCustomer.id,
        type: 'cart_session'
      }, '24h');

      // Create cart session for guest
      const cartSession = await customerModel.createCartSession(guestCustomer.id, sessionToken);

      res.status(201).json(
        successResponse('Guest session created', {
          customer: {
            id: guestCustomer.id,
            email: guestCustomer.email,
            is_guest: true
          },
          cart_session: {
            id: cartSession.id,
            token: cartSession.session_token
          }
        })
      );

    } catch (error) {
      next(error);
    }
  }

  // Get customer profile
  async getProfile(req, res, next) {
    try {
      const customer = await customerModel.findCustomerById(req.customer.id);

      if (!customer) {
        return res.status(404).json(
          errorResponse('Customer not found')
        );
      }

      res.json(
        successResponse('Profile retrieved successfully', { customer })
      );

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CustomerController();