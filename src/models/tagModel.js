const { pool } = require('../config/database');

class TagModel {
  
  // Create UHF RFID tag
  async createUHF(uhfData) {
    const { uhf_uid, product_id = null, qr_code_data = null, status = 'available' } = uhfData;

    // Check if UHF UID already exists
    const existingTag = await pool.query(
      'SELECT id FROM tags WHERE uhf_uid = $1',
      [uhf_uid]
    );
    
    if (existingTag.rows.length > 0) {
      throw new Error(`UHF RFID tag with UID ${uhf_uid} already exists`);
    }

    const result = await pool.query(
      `INSERT INTO tags (uhf_uid, product_id, qr_code_data, status) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [uhf_uid, product_id, qr_code_data, status]
    );

    return result.rows[0];
  }

  // Create multiple UHF tags in bulk
  async createBulkUHFTags(uhfUids) {
    const values = uhfUids.map((uid, index) => 
      `($${index + 1}, 'available')`
    ).join(', ');

    const query = `
      INSERT INTO tags (uhf_uid, status) 
      VALUES ${values}
      ON CONFLICT (uhf_uid) DO NOTHING
      RETURNING *
    `;

    const result = await pool.query(query, uhfUids);
    return result.rows;
  }

  // Get all UHF tags with filters
  async getAllTags(filters = {}) {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      product_id,
      unassigned_only = false
    } = filters;

    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        t.*,
        p.name as product_name,
        p.sku as product_sku,
        p.price as product_price,
        p.qr_code_data as product_qr_code
      FROM tags t
      LEFT JOIN products p ON t.product_id = p.id
      WHERE 1=1
    `;
    
    let countQuery = `SELECT COUNT(*) FROM tags t WHERE 1=1`;
    const queryParams = [];
    let paramCount = 0;

    // Apply filters
    if (status) {
      paramCount++;
      query += ` AND t.status = $${paramCount}`;
      countQuery += ` AND t.status = $${paramCount}`;
      queryParams.push(status);
    }

    if (product_id) {
      paramCount++;
      query += ` AND t.product_id = $${paramCount}`;
      countQuery += ` AND t.product_id = $${paramCount}`;
      queryParams.push(product_id);
    }

    if (unassigned_only) {
      query += ` AND t.product_id IS NULL`;
      countQuery += ` AND t.product_id IS NULL`;
    }

    // Add sorting and pagination
    query += ` ORDER BY t.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(limit, offset);

    // Execute queries
    const [tagsResult, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, queryParams.slice(0, -2))
    ]);

    return {
      tags: tagsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      }
    };
  }

  // Get tag by UHF UID
  async getTagByUid(uhfUid) {
    const result = await pool.query(
      `SELECT 
        t.*,
        p.name as product_name,
        p.sku as product_sku,
        p.price as product_price,
        p.description as product_description,
        p.qr_code_data as product_qr_code
       FROM tags t
       LEFT JOIN products p ON t.product_id = p.id
       WHERE t.uhf_uid = $1`,
      [uhfUid]
    );
    return result.rows[0];
  }

  // Get tag by ID
  async getTagById(id) {
    const result = await pool.query(
      `SELECT 
        t.*,
        p.name as product_name,
        p.sku as product_sku,
        p.price as product_price
       FROM tags t
       LEFT JOIN products p ON t.product_id = p.id
       WHERE t.id = $1`,
      [id]
    );
    return result.rows[0];
  }

  // Assign UHF tag to product
  async assignTagToProduct(uhfUid, productId, qrCodeData = null) {
    // Check if product exists and is active
    const product = await pool.query(
      'SELECT id FROM products WHERE id = $1 AND is_active = true',
      [productId]
    );

    if (product.rows.length === 0) {
      throw new Error('Product not found or inactive');
    }

    // Check if tag exists
    const tag = await pool.query(
      'SELECT id, status FROM tags WHERE uhf_uid = $1',
      [uhfUid]
    );

    if (tag.rows.length === 0) {
      throw new Error('UHF tag not found');
    }

    // Update tag assignment
    const result = await pool.query(
      `UPDATE tags 
       SET product_id = $1, qr_code_data = $2, status = 'assigned', last_scanned_at = CURRENT_TIMESTAMP
       WHERE uhf_uid = $3 
       RETURNING *`,
      [productId, qrCodeData, uhfUid]
    );

    return result.rows[0];
  }

  // Unassign tag from product
  async unassignTag(uhfUid) {
    const result = await pool.query(
      `UPDATE tags 
       SET product_id = NULL, qr_code_data = NULL, status = 'available', last_scanned_at = CURRENT_TIMESTAMP
       WHERE uhf_uid = $1 
       RETURNING *`,
      [uhfUid]
    );

    return result.rows[0];
  }

  // Update tag status
  async updateTagStatus(uhfUid, status) {
    const validStatuses = ['available', 'assigned', 'in_cart', 'paid', 'deactivated'];
    
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid tag status');
    }

    const result = await pool.query(
      `UPDATE tags 
       SET status = $1, last_scanned_at = CURRENT_TIMESTAMP
       WHERE uhf_uid = $2 
       RETURNING *`,
      [status, uhfUid]
    );

    return result.rows[0];
  }

  // Get tags by product ID
  async getTagsByProduct(productId) {
    const result = await pool.query(
      `SELECT t.* FROM tags t
       WHERE t.product_id = $1
       ORDER BY t.created_at DESC`,
      [productId]
    );
    return result.rows;
  }

  // Get available (unassigned) tags
  async getAvailableTags() {
    const result = await pool.query(
      `SELECT * FROM tags 
       WHERE product_id IS NULL AND status = 'available'
       ORDER BY created_at DESC`
    );
    return result.rows;
  }

  // Get product by UHF tag
  async getProductByUHFTag(uhfUid) {
    const result = await pool.query(
      `SELECT 
        p.*,
        t.uhf_uid,
        t.status as tag_status
       FROM tags t
       JOIN products p ON t.product_id = p.id
       WHERE t.uhf_uid = $1 AND p.is_active = true`,
      [uhfUid]
    );
    return result.rows[0];
  }

  // Check if product is paid via UHF tag
  async isProductPaidByUHFTag(uhfUid, withinHours = 1) {
    // Get product from UHF tag
    const product = await this.getProductByUHFTag(uhfUid);
    
    if (!product) {
      return { 
        isPaid: false, 
        reason: 'Product not found for this UHF tag',
        product_id: null,
        product_name: null
      };
    }

    // Check for paid orders
    const result = await pool.query(
      `SELECT o.id, o.status, o.created_at
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       WHERE oi.product_id = $1 
         AND o.status = 'paid'
         AND o.created_at > NOW() - INTERVAL '${withinHours} hours'
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [product.id]
    );

    return {
      isPaid: result.rows.length > 0,
      product_id: product.id,
      product_name: product.name,
      order: result.rows[0],
      reason: result.rows.length > 0 ? 'Paid' : 'No paid order found'
    };
  }

  // Validate multiple UHF tags at exit
  async validateExitUHFTags(uhfUids) {
    const validationResults = [];
    let allPaid = true;
    const unpaidItems = [];

    for (const uhfUid of uhfUids) {
      const paymentStatus = await this.isProductPaidByUHFTag(uhfUid);
      
      validationResults.push({
        uhf_uid: uhfUid,
        ...paymentStatus
      });

      if (!paymentStatus.isPaid) {
        allPaid = false;
        unpaidItems.push({
          uhf_uid: uhfUid,
          product_id: paymentStatus.product_id,
          product_name: paymentStatus.product_name,
          reason: paymentStatus.reason
        });
      }
    }

    return {
      all_paid: allPaid,
      total_tags: uhfUids.length,
      paid_count: validationResults.filter(r => r.isPaid).length,
      unpaid_count: validationResults.filter(r => !r.isPaid).length,
      unpaid_items: unpaidItems,
      validation_results: validationResults
    };
  }

  // Scan tag (update last_scanned_at)
  async scanTag(uhfUid) {
    const result = await pool.query(
      `UPDATE tags 
       SET last_scanned_at = CURRENT_TIMESTAMP 
       WHERE uhf_uid = $1 
       RETURNING *`,
      [uhfUid]
    );

    if (result.rows.length === 0) {
      throw new Error('UHF tag not found');
    }

    return result.rows[0];
  }
}

module.exports = new TagModel();