const { pool } = require('../config/database');
const { hashPassword, verifyPassword } = require('../utils/helpers');

class CustomerModel {
  
  // Create new customer (registered or guest)
  async createCustomer(customerData) {
    const { 
      email, 
      phone, 
      first_name, 
      last_name, 
      password, 
      is_guest = false 
    } = customerData;

    // For registered customers, check if email exists
    if (!is_guest) {
      const existingCustomer = await pool.query(
        'SELECT id FROM customers WHERE email = $1 AND is_guest = false',
        [email]
      );
      
      if (existingCustomer.rows.length > 0) {
        throw new Error('Customer with this email already exists');
      }
    }

    let passwordHash = null;
    if (password && !is_guest) {
      passwordHash = await hashPassword(password);
    }

    const result = await pool.query(
      `INSERT INTO customers (
        email, phone, first_name, last_name, password_hash, is_guest
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, phone, first_name, last_name, is_guest, created_at`,
      [email, phone, first_name, last_name, passwordHash, is_guest]
    );

    return result.rows[0];
  }

  // Find customer by email
  async findCustomerByEmail(email) {
    const result = await pool.query(
      `SELECT id, email, phone, first_name, last_name, password_hash, is_guest, is_active
       FROM customers WHERE email = $1 AND is_guest = false`,
      [email]
    );
    return result.rows[0];
  }

  // Find customer by ID
  async findCustomerById(id) {
    const result = await pool.query(
      `SELECT id, email, phone, first_name, last_name, is_guest, is_active, created_at
       FROM customers WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  }

  // Create guest customer
  async createGuestCustomer() {
    const guestEmail = `guest_${Date.now()}@temp.com`;
    
    const result = await pool.query(
      `INSERT INTO customers (email, is_guest, is_active)
       VALUES ($1, true, true)
       RETURNING id, email, is_guest, created_at`,
      [guestEmail]
    );

    return result.rows[0];
  }

  // Update customer login time
  async updateCustomerLogin(customerId) {
    await pool.query(
      'UPDATE customers SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [customerId]
    );
  }

  // Create cart session
  async createCartSession(customerId, sessionToken) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    const result = await pool.query(
      `INSERT INTO cart_sessions (customer_id, session_token, expires_at)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [customerId, sessionToken, expiresAt]
    );

    return result.rows[0];
  }

  // Get active cart session
  async getActiveCartSession(customerId) {
    const result = await pool.query(
      `SELECT * FROM cart_sessions 
       WHERE customer_id = $1 AND status = 'active' AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC LIMIT 1`,
      [customerId]
    );
    return result.rows[0];
  }

  // Get cart session by token
  async getCartSessionByToken(sessionToken) {
    const result = await pool.query(
      `SELECT cs.*, c.email, c.first_name, c.last_name
       FROM cart_sessions cs
       JOIN customers c ON cs.customer_id = c.id
       WHERE cs.session_token = $1 AND cs.status = 'active' AND cs.expires_at > CURRENT_TIMESTAMP`,
      [sessionToken]
    );
    return result.rows[0];
  }

  // Update cart session totals
  async updateCartSessionTotals(cartSessionId) {
    const result = await pool.query(
      `UPDATE cart_sessions 
       SET 
         item_count = (SELECT COALESCE(SUM(quantity), 0) FROM cart_items WHERE cart_session_id = $1),
         total_amount = (SELECT COALESCE(SUM(quantity * price_at_add), 0) FROM cart_items WHERE cart_session_id = $1),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [cartSessionId, cartSessionId]
    );
    return result.rows[0];
  }
}

module.exports = new CustomerModel();