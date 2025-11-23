const { pool } = require('../config/database');

class TagModel {
  
  // Create a new NFC tag
  async createTag(tagData) {
    const { tag_uid, product_id = null, status = 'available' } = tagData;

    // Check if tag UID already exists
    const existingTag = await pool.query(
      'SELECT id FROM tags WHERE tag_uid = $1',
      [tag_uid]
    );
    
    if (existingTag.rows.length > 0) {
      throw new Error('NFC tag with this UID already exists');
    }

    const result = await pool.query(
      `INSERT INTO tags (tag_uid, product_id, status) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [tag_uid, product_id, status]
    );

    return result.rows[0];
  }

  // Create multiple tags in bulk
  async createBulkTags(tagUids) {
    const values = tagUids.map((uid, index) => 
      `($${index * 1 + 1}, 'available')`
    ).join(', ');

    const query = `
      INSERT INTO tags (tag_uid, status) 
      VALUES ${values}
      ON CONFLICT (tag_uid) DO NOTHING
      RETURNING *
    `;

    const result = await pool.query(query, tagUids);
    return result.rows;
  }

  // Get all tags with optional filters
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
        p.price as product_price
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

  // Get tag by UID
  async getTagByUid(tagUid) {
    const result = await pool.query(
      `SELECT 
        t.*,
        p.name as product_name,
        p.sku as product_sku,
        p.price as product_price,
        p.description as product_description
       FROM tags t
       LEFT JOIN products p ON t.product_id = p.id
       WHERE t.tag_uid = $1`,
      [tagUid]
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

  // Assign tag to product
  async assignTagToProduct(tagId, productId) {
    // Check if product exists and is active
    const product = await pool.query(
      'SELECT id FROM products WHERE id = $1 AND is_active = true',
      [productId]
    );

    if (product.rows.length === 0) {
      throw new Error('Product not found or inactive');
    }

    // Check if tag exists and is available
    const tag = await pool.query(
      'SELECT id, status FROM tags WHERE id = $1',
      [tagId]
    );

    if (tag.rows.length === 0) {
      throw new Error('Tag not found');
    }

    if (tag.rows[0].status !== 'available') {
      throw new Error('Tag is not available for assignment');
    }

    // Update tag assignment
    const result = await pool.query(
      `UPDATE tags 
       SET product_id = $1, status = 'assigned', last_scanned_at = CURRENT_TIMESTAMP
       WHERE id = $2 
       RETURNING *`,
      [productId, tagId]
    );

    return result.rows[0];
  }

  // Unassign tag from product
  async unassignTag(tagId) {
    const result = await pool.query(
      `UPDATE tags 
       SET product_id = NULL, status = 'available', last_scanned_at = CURRENT_TIMESTAMP
       WHERE id = $1 
       RETURNING *`,
      [tagId]
    );

    return result.rows[0];
  }

  // Update tag status
  async updateTagStatus(tagId, status) {
    const validStatuses = ['available', 'assigned', 'in_cart', 'paid', 'deactivated'];
    
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid tag status');
    }

    const result = await pool.query(
      `UPDATE tags 
       SET status = $1, last_scanned_at = CURRENT_TIMESTAMP
       WHERE id = $2 
       RETURNING *`,
      [status, tagId]
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

  // Scan tag (update last_scanned_at)
  async scanTag(tagUid) {
    const result = await pool.query(
      `UPDATE tags 
       SET last_scanned_at = CURRENT_TIMESTAMP 
       WHERE tag_uid = $1 
       RETURNING *`,
      [tagUid]
    );

    if (result.rows.length === 0) {
      throw new Error('Tag not found');
    }

    return result.rows[0];
  }
}

module.exports = new TagModel();