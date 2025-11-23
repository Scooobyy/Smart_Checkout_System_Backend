const adminModel = require('../models/adminModel');
const { 
  verifyPassword, 
  generateToken, 
  successResponse, 
  errorResponse,
  validateRequiredFields 
} = require('../utils/helpers');
const { ROLES } = require('../utils/constants');

class AdminController {
  
  // Register first admin (no authentication required)
  async registerFirstAdmin(req, res, next) {
    try {
      const { username, email, password } = req.body;
      
      // Validate required fields
      validateRequiredFields(req.body, ['username', 'email', 'password']);
      
      // Check if this is the first admin
      const isFirstAdmin = await adminModel.isFirstAdmin();
      if (!isFirstAdmin) {
        return res.status(403).json(
          errorResponse('Initial admin already exists. Use invitation system.')
        );
      }

      // Password strength check
      if (password.length < 6) {
        return res.status(400).json(
          errorResponse('Password must be at least 6 characters long')
        );
      }

      // Create first admin with super_admin role
      const adminData = {
        username,
        email,
        password,
        role: ROLES.SUPER_ADMIN
      };

      const admin = await adminModel.createAdmin(adminData);

      // Generate JWT token
      const token = generateToken({
        id: admin.id,
        email: admin.email,
        role: admin.role
      });

      res.status(201).json(
        successResponse('First admin registered successfully', {
          admin: {
            id: admin.id,
            username: admin.username,
            email: admin.email,
            role: admin.role
          },
          token
        })
      );

    } catch (error) {
      next(error);
    }
  }

  // Admin login
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      
      validateRequiredFields(req.body, ['email', 'password']);

      // Find admin
      const admin = await adminModel.findAdminByEmail(email);
      if (!admin) {
        return res.status(401).json(
          errorResponse('Invalid credentials')
        );
      }

      // Check if admin is active
      if (!admin.is_active) {
        return res.status(403).json(
          errorResponse('Account is deactivated')
        );
      }

      // Check if account is locked
      if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
        return res.status(423).json(
          errorResponse('Account temporarily locked due to too many failed attempts')
        );
      }

      // Verify password
      const isPasswordValid = await verifyPassword(password, admin.password_hash);
      if (!isPasswordValid) {
        // Update failed attempt
        const attempts = admin.login_attempts + 1;
        await adminModel.updateLoginFailure(admin.id, attempts);
        
        return res.status(401).json(
          errorResponse('Invalid credentials')
        );
      }

      // Login successful - update login details
      await adminModel.updateLoginSuccess(admin.id);

      // Generate JWT token
      const token = generateToken({
        id: admin.id,
        email: admin.email,
        role: admin.role
      });

      res.json(
        successResponse('Login successful', {
          admin: {
            id: admin.id,
            username: admin.username,
            email: admin.email,
            role: admin.role
          },
          token
        })
      );

    } catch (error) {
      next(error);
    }
  }

  // Get current admin profile
  async getProfile(req, res, next) {
    try {
      const admin = await adminModel.findAdminById(req.admin.id);
      
      if (!admin) {
        return res.status(404).json(
          errorResponse('Admin not found')
        );
      }

      res.json(
        successResponse('Profile retrieved successfully', { admin })
      );

    } catch (error) {
      next(error);
    }
  }

  // Get all admins (super admin only)
  async getAllAdmins(req, res, next) {
    try {
      const admins = await adminModel.getAllAdmins();
      
      res.json(
        successResponse('Admins retrieved successfully', { admins })
      );

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminController();