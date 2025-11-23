const { pool } = require('../config/database');
const { hashPassword, verifyPassword } = require('../utils/helpers');
const { ROLES } = require('../utils/constants');

class AdminModel {
  
  // Create new admin (without created_by)
  async createAdmin(adminData) {
    const { username, email, password, role = 'super_admin' } = adminData;
    
    // Check if admin already exists
    const existingAdmin = await pool.query(
      'SELECT id FROM admins WHERE email = $1 OR username = $2',
      [email, username]
    );
    
    if (existingAdmin.rows.length > 0) {
      throw new Error('Admin with this email or username already exists');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create admin
    const result = await pool.query(
      `INSERT INTO admins (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, username, email, role, is_active, created_at`,
      [username, email, passwordHash, role]
    );

    return result.rows[0];
  }

  // Find admin by email
  async findAdminByEmail(email) {
    const result = await pool.query(
      `SELECT id, username, email, password_hash, role, is_active, login_attempts, locked_until
       FROM admins WHERE email = $1`,
      [email]
    );
    return result.rows[0];
  }

  // Find admin by ID
  async findAdminById(id) {
    const result = await pool.query(
      `SELECT id, username, email, role, is_active, last_login, created_at
       FROM admins WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  }

  // Update admin login details
  async updateLoginSuccess(adminId) {
    await pool.query(
      `UPDATE admins 
       SET last_login = CURRENT_TIMESTAMP, login_attempts = 0, locked_until = NULL 
       WHERE id = $1`,
      [adminId]
    );
  }

  // Update failed login attempts
  async updateLoginFailure(adminId, attempts) {
    let lockedUntil = null;
    if (attempts >= 5) {
      lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
    }

    await pool.query(
      `UPDATE admins SET login_attempts = $1, locked_until = $2 WHERE id = $3`,
      [attempts, lockedUntil, adminId]
    );
  }

  // Get all admins
  async getAllAdmins() {
    const result = await pool.query(
      `SELECT id, username, email, role, is_active, last_login, created_at
       FROM admins ORDER BY created_at DESC`
    );
    return result.rows;
  }

  // Update admin status
  async updateAdminStatus(adminId, isActive) {
    const result = await pool.query(
      `UPDATE admins SET is_active = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING id, username, email, role, is_active`,
      [isActive, adminId]
    );
    return result.rows[0];
  }

  // Check if any admin exists (for first-time setup)
  async isFirstAdmin() {
    const result = await pool.query('SELECT COUNT(*) FROM admins');
    return parseInt(result.rows[0].count) === 0;
  }
}

module.exports = new AdminModel();