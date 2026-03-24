const { pool } = require('../config/database');

class OrderModel {
  
  // Create new order
  async createOrder(orderData) {
    const { 
      customer_id, 
      cart_session_id, 
      total_amount, 
      payment_method = 'razorpay',
      shipping_address = null 
    } = orderData;

    const result = await pool.query(
      `INSERT INTO orders (
        customer_id, cart_session_id, total_amount, 
        payment_method, shipping_address
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [customer_id, cart_session_id, total_amount, payment_method, shipping_address]
    );

    return result.rows[0];
  }

  // Create order items from cart items
  async createOrderItems(orderId, cartSessionId) {
    const result = await pool.query(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
       SELECT 
         $1 as order_id,
         ci.product_id,
         ci.quantity,
         ci.price_at_add as unit_price,
         ci.quantity * ci.price_at_add as total_price
       FROM cart_items ci
       WHERE ci.cart_session_id = $2
       RETURNING *`,
      [orderId, cartSessionId]
    );

    return result.rows;
  }

  // Get order by ID
  async getOrderById(orderId) {
    const result = await pool.query(
      `SELECT 
         o.*,
         c.email as customer_email,
         c.first_name,
         c.last_name,
         c.phone
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       WHERE o.id = $1`,
      [orderId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const order = result.rows[0];

    // Get order items
    const itemsResult = await pool.query(
      `SELECT 
         oi.*,
         p.name as product_name,
         p.sku as product_sku,
         p.image_url as product_image
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    order.items = itemsResult.rows;
    return order;
  }

  // Get order by Razorpay order ID
  async getOrderByRazorpayOrderId(razorpayOrderId) {
    const result = await pool.query(
      'SELECT * FROM orders WHERE payment_intent_id = $1',
      [razorpayOrderId]
    );
    return result.rows[0];
  }

  // Get orders by customer
  async getOrdersByCustomer(customerId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const [ordersResult, countResult] = await Promise.all([
      pool.query(
        `SELECT * FROM orders 
         WHERE customer_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [customerId, limit, offset]
      ),
      pool.query(
        'SELECT COUNT(*) FROM orders WHERE customer_id = $1',
        [customerId]
      )
    ]);

    return {
      orders: ordersResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      }
    };
  }

  // Update order status
  async updateOrderStatus(orderId, status, paymentIntentId = null) {
    const updates = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const params = [status, orderId];
    let paramCount = 2;

    if (paymentIntentId) {
      paramCount++;
      updates.push(`payment_intent_id = $${paramCount}`);
      params.splice(1, 0, paymentIntentId); // Insert at position 1
    }

    if (status === 'paid') {
      paramCount++;
      updates.push(`payment_status = 'completed'`);
    }

    const result = await pool.query(
      `UPDATE orders 
       SET ${updates.join(', ')} 
       WHERE id = $${paramCount} 
       RETURNING *`,
      params
    );

    return result.rows[0];
  }

  // Update payment details
  async updatePaymentDetails(orderId, paymentData) {
    const { payment_intent_id, payment_status, payment_method } = paymentData;

    const result = await pool.query(
      `UPDATE orders 
       SET 
         payment_intent_id = $1,
         payment_status = $2,
         payment_method = $3,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 
       RETURNING *`,
      [payment_intent_id, payment_status, payment_method, orderId]
    );

    return result.rows[0];
  }

  // Mark cart session as completed
  async completeCartSession(cartSessionId) {
    await pool.query(
      `UPDATE cart_sessions 
       SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [cartSessionId]
    );
  }

  // Update product stock after order
  async updateProductStock(orderId) {
    // Decrease stock for each product in the order
    await pool.query(
      `UPDATE products p
       SET stock_quantity = stock_quantity - oi.quantity,
           updated_at = CURRENT_TIMESTAMP
       FROM order_items oi
       WHERE p.id = oi.product_id AND oi.order_id = $1`,
      [orderId]
    );
  }

  // Get all orders (for admin)
  async getAllOrders(filters = {}) {
    const { 
      page = 1, 
      limit = 10, 
      status,
      start_date,
      end_date 
    } = filters;

    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        o.*,
        c.email as customer_email,
        c.first_name,
        c.last_name
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE 1=1
    `;
    
    let countQuery = `SELECT COUNT(*) FROM orders o WHERE 1=1`;
    const queryParams = [];
    let paramCount = 0;

    // Apply filters
    if (status) {
      paramCount++;
      query += ` AND o.status = $${paramCount}`;
      countQuery += ` AND o.status = $${paramCount}`;
      queryParams.push(status);
    }

    if (start_date) {
      paramCount++;
      query += ` AND o.created_at >= $${paramCount}`;
      countQuery += ` AND o.created_at >= $${paramCount}`;
      queryParams.push(start_date);
    }

    if (end_date) {
      paramCount++;
      query += ` AND o.created_at <= $${paramCount}`;
      countQuery += ` AND o.created_at <= $${paramCount}`;
      queryParams.push(end_date);
    }

    // Add sorting and pagination
    query += ` ORDER BY o.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(limit, offset);

    // Execute queries
    const [ordersResult, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, queryParams.slice(0, -2))
    ]);

    return {
      orders: ordersResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      }
    };
  }

    async getOrderByRazorpayOrderId(razorpayOrderId) {
    const result = await pool.query(
      'SELECT * FROM orders WHERE payment_intent_id = $1',
      [razorpayOrderId]
    );
    return result.rows[0];
  }

   // Get orders by customer with pagination
  async getOrdersByCustomer(customerId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const [ordersResult, countResult] = await Promise.all([
      pool.query(
        `SELECT * FROM orders 
         WHERE customer_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [customerId, limit, offset]
      ),
      pool.query(
        'SELECT COUNT(*) FROM orders WHERE customer_id = $1',
        [customerId]
      )
    ]);

    return {
      orders: ordersResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      }
    };
  }

  // Get all orders for admin
  async getAllOrders(filters = {}) {
    const { 
      page = 1, 
      limit = 10, 
      status,
      start_date,
      end_date 
    } = filters;

    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        o.*,
        c.email as customer_email,
        c.first_name,
        c.last_name
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE 1=1
    `;
    
    let countQuery = `SELECT COUNT(*) FROM orders o WHERE 1=1`;
    const queryParams = [];
    let paramCount = 0;

    // Apply filters
    if (status) {
      paramCount++;
      query += ` AND o.status = $${paramCount}`;
      countQuery += ` AND o.status = $${paramCount}`;
      queryParams.push(status);
    }

    if (start_date) {
      paramCount++;
      query += ` AND o.created_at >= $${paramCount}::TIMESTAMP`;
      countQuery += ` AND o.created_at >= $${paramCount}::TIMESTAMP`;
      queryParams.push(start_date);
    }

    if (end_date) {
      paramCount++;
      query += ` AND o.created_at <= $${paramCount}::TIMESTAMP`;
      countQuery += ` AND o.created_at <= $${paramCount}::TIMESTAMP`;
      queryParams.push(end_date);
    }

    // Add sorting and pagination
    query += ` ORDER BY o.created_at DESC LIMIT $${paramCount + 1}::INTEGER OFFSET $${paramCount + 2}::INTEGER`;
    queryParams.push(limit, offset);

    // Execute queries
    const [ordersResult, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, queryParams.slice(0, -2))
    ]);

    return {
      orders: ordersResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      }
    };
  }

}



module.exports = new OrderModel();