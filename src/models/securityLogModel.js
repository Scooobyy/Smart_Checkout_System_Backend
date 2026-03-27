const { pool } = require('../config/database');

class SecurityLogModel {
  
  // Log security events
  async logSecurityEvent(eventData) {
    const {
      event_type,
      severity,
      uhf_uids,
      details,
      gate_action
    } = eventData;

    const result = await pool.query(
      `INSERT INTO security_logs (
        event_type, severity, uhf_uids, details, gate_action, created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING *`,
      [event_type, severity, JSON.stringify(uhf_uids), JSON.stringify(details), gate_action]
    );

    return result.rows[0];
  }

  // Get recent security alerts
  async getRecentAlerts(limit = 50) {
    const result = await pool.query(
      `SELECT * FROM security_logs 
       WHERE severity IN ('high', 'critical')
       ORDER BY created_at DESC 
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  // Get security summary
  async getSecuritySummary() {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high,
        COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium,
        COUNT(CASE WHEN severity = 'low' THEN 1 END) as low
      FROM security_logs 
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);
    return result.rows[0];
  }
}

module.exports = new SecurityLogModel();