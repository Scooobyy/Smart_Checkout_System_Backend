const { pool } = require('../config/database');

class ExitGateModel {
  
  // Create new exit session
  async createExitSession(sessionId, customerId = null) {
    const result = await pool.query(
      `INSERT INTO exit_logs (session_id, customer_id) 
       VALUES ($1, $2) 
       RETURNING *`,
      [sessionId, customerId]
    );

    return result.rows[0];
  }

  // Get exit session by ID
  async getExitSession(sessionId) {
    const result = await pool.query(
      `SELECT * FROM exit_logs WHERE session_id = $1`,
      [sessionId]
    );
    return result.rows[0];
  }

  // Add scanned UHF tag to exit session - FIXED with type casting
  async addScannedUHF(exitLogId, uhfUid, productId = null, orderId = null, isPaid = false) {
    console.log('Adding scanned UHF:', { exitLogId, uhfUid, productId, orderId, isPaid });
    
    const result = await pool.query(
      `INSERT INTO exit_scanned_items (exit_log_id, uhf_uid, product_id, order_id, is_paid)
       VALUES ($1::UUID, $2, $3::UUID, $4::UUID, $5::BOOLEAN)
       ON CONFLICT (exit_log_id, uhf_uid) DO NOTHING
       RETURNING *`,
      [exitLogId, uhfUid, productId, orderId, Boolean(isPaid)]
    );

    return result.rows[0];
  }

  // Update exit session status - FIXED with explicit type casting
  async updateExitSession(sessionId, updateData) {
    console.log('Updating exit session:', sessionId, updateData);
    
    const { status, alert_triggered = false, alert_reason = null, total_scanned_tags = null, unpaid_tags_count = null } = updateData;
    
    const updates = [];
    const params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      updates.push(`status = $${paramCount}`);
      params.push(status);
    }

    if (alert_triggered !== undefined) {
      paramCount++;
      updates.push(`alert_triggered = $${paramCount}::BOOLEAN`);
      params.push(Boolean(alert_triggered));
    }

    if (alert_reason !== undefined) {
      paramCount++;
      updates.push(`alert_reason = $${paramCount}`);
      params.push(alert_reason);
    }

    if (total_scanned_tags !== undefined) {
      paramCount++;
      updates.push(`total_scanned_tags = $${paramCount}::INTEGER`);
      params.push(parseInt(total_scanned_tags) || 0);
    }

    if (unpaid_tags_count !== undefined) {
      paramCount++;
      updates.push(`unpaid_tags_count = $${paramCount}::INTEGER`);
      params.push(parseInt(unpaid_tags_count) || 0);
    }

    if (status === 'completed' || status === 'alert') {
      updates.push(`completed_at = CURRENT_TIMESTAMP`);
    }

    if (updates.length === 0) {
      throw new Error('No updates provided');
    }

    paramCount++;
    params.push(sessionId);

    const query = `
      UPDATE exit_logs 
      SET ${updates.join(', ')} 
      WHERE session_id = $${paramCount}
      RETURNING *
    `;

    console.log('Executing query:', query);
    console.log('With params:', params);

    const result = await pool.query(query, params);
    return result.rows[0];
  }

  // Get exit session summary - FIXED
  async getExitSessionSummary(exitLogId) {
    const result = await pool.query(
      `SELECT 
         COUNT(*)::INTEGER as total_scanned,
         SUM(CASE WHEN is_paid = true THEN 1 ELSE 0 END)::INTEGER as paid_count,
         SUM(CASE WHEN is_paid = false THEN 1 ELSE 0 END)::INTEGER as unpaid_count
       FROM exit_scanned_items 
       WHERE exit_log_id = $1::UUID`,
      [exitLogId]
    );

    return result.rows[0] || { total_scanned: 0, paid_count: 0, unpaid_count: 0 };
  }

  // Get all exit sessions (for admin) - FIXED
  async getAllExitSessions(filters = {}) {
    const { 
      page = 1, 
      limit = 10, 
      status,
      date_from,
      date_to 
    } = filters;

    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        el.*,
        c.email as customer_email,
        c.first_name,
        c.last_name,
        COUNT(esi.id)::INTEGER as total_items_scanned
      FROM exit_logs el
      LEFT JOIN customers c ON el.customer_id = c.id
      LEFT JOIN exit_scanned_items esi ON el.id = esi.exit_log_id
      WHERE 1=1
    `;
    
    let countQuery = `SELECT COUNT(*)::INTEGER FROM exit_logs el WHERE 1=1`;
    const queryParams = [];
    let paramCount = 0;

    // Apply filters
    if (status) {
      paramCount++;
      query += ` AND el.status = $${paramCount}`;
      countQuery += ` AND el.status = $${paramCount}`;
      queryParams.push(status);
    }

    if (date_from) {
      paramCount++;
      query += ` AND el.created_at >= $${paramCount}::TIMESTAMP`;
      countQuery += ` AND el.created_at >= $${paramCount}::TIMESTAMP`;
      queryParams.push(date_from);
    }

    if (date_to) {
      paramCount++;
      query += ` AND el.created_at <= $${paramCount}::TIMESTAMP`;
      countQuery += ` AND el.created_at <= $${paramCount}::TIMESTAMP`;
      queryParams.push(date_to);
    }

    // Group by and pagination
    query += ` GROUP BY el.id, c.email, c.first_name, c.last_name 
               ORDER BY el.created_at DESC 
               LIMIT $${paramCount + 1}::INTEGER OFFSET $${paramCount + 2}::INTEGER`;
    queryParams.push(parseInt(limit), parseInt(offset));

    console.log('Get all sessions query:', query);
    console.log('Query params:', queryParams);

    // Execute queries
    const [sessionsResult, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, queryParams.slice(0, -2))
    ]);

    return {
      sessions: sessionsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      }
    };
  }

  // Get exit session details with scanned items - FIXED
  async getExitSessionDetails(sessionId) {
    const sessionResult = await pool.query(
      `SELECT 
         el.*,
         c.email as customer_email,
         c.first_name,
         c.last_name
       FROM exit_logs el
       LEFT JOIN customers c ON el.customer_id = c.id
       WHERE el.session_id = $1`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return null;
    }

    const session = sessionResult.rows[0];

    // Get scanned items
    const itemsResult = await pool.query(
      `SELECT 
         esi.*,
         p.name as product_name,
         p.price as product_price,
         o.id as order_id,
         o.status as order_status
       FROM exit_scanned_items esi
       LEFT JOIN products p ON esi.product_id = p.id
       LEFT JOIN orders o ON esi.order_id = o.id
       WHERE esi.exit_log_id = $1::UUID
       ORDER BY esi.scanned_at DESC`,
      [session.id]
    );

    session.scanned_items = itemsResult.rows;
    return session;
  }

  // Alternative simple completion method
  async completeExitSessionSimple(sessionId) {
    try {
      const session = await this.getExitSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const summary = await this.getExitSessionSummary(session.id);
      
      const alertTriggered = summary.unpaid_count > 0;
      const alertReason = alertTriggered ? `${summary.unpaid_count} unpaid item(s) detected` : null;
      const finalStatus = alertTriggered ? 'alert' : 'completed';

      const result = await pool.query(
        `UPDATE exit_logs 
         SET 
           status = $1,
           alert_triggered = $2::BOOLEAN,
           alert_reason = $3,
           total_scanned_tags = $4::INTEGER,
           unpaid_tags_count = $5::INTEGER,
           completed_at = CURRENT_TIMESTAMP
         WHERE session_id = $6
         RETURNING *`,
        [
          finalStatus,
          alertTriggered,
          alertReason,
          parseInt(summary.total_scanned) || 0,
          parseInt(summary.unpaid_count) || 0,
          sessionId
        ]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error in completeExitSessionSimple:', error);
      throw error;
    }
  }
}

module.exports = new ExitGateModel();