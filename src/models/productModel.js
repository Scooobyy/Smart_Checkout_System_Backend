const { pool } = require('../config/database');

class ProductModel {
  
  // Create new product
  async createProduct(productData) {
    const { 
      name, 
      description, 
      price, 
      sku, 
      category, 
      image_url, 
      stock_quantity = 0, 
      low_stock_threshold = 5 
    } = productData;

    // Check if SKU already exists
    if (sku) {
      const existingSku = await pool.query(
        'SELECT id FROM products WHERE sku = $1',
        [sku]
      );
      if (existingSku.rows.length > 0) {
        throw new Error('Product with this SKU already exists');
      }
    }

    const result = await pool.query(
      `INSERT INTO products (
        name, description, price, sku, category, image_url, 
        stock_quantity, low_stock_threshold
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [name, description, price, sku, category, image_url, stock_quantity, low_stock_threshold]
    );

    return result.rows[0];
  }

  // Get all products with pagination and filters
  async getAllProducts(filters = {}) {
    const { 
      page = 1, 
      limit = 10, 
      category, 
      search, 
      in_stock_only = false 
    } = filters;

    const offset = (page - 1) * limit;
    
    let query = `
      SELECT * FROM products 
      WHERE is_active = true
    `;
    let countQuery = `
      SELECT COUNT(*) FROM products 
      WHERE is_active = true
    `;
    const queryParams = [];
    let paramCount = 0;

    // Apply filters
    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      countQuery += ` AND category = $${paramCount}`;
      queryParams.push(category);
    }

    if (search) {
      paramCount++;
      query += ` AND (name ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      countQuery += ` AND (name ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    if (in_stock_only) {
      query += ` AND stock_quantity > 0`;
      countQuery += ` AND stock_quantity > 0`;
    }

    // Add sorting and pagination
    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(limit, offset);

    // Execute queries
    const [productsResult, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, queryParams.slice(0, -2)) // Remove limit/offset for count
    ]);

    return {
      products: productsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      }
    };
  }

  // Get product by ID
  async getProductById(id) {
    const result = await pool.query(
      'SELECT * FROM products WHERE id = $1 AND is_active = true',
      [id]
    );
    return result.rows[0];
  }

  // Get product by SKU
  async getProductBySku(sku) {
    const result = await pool.query(
      'SELECT * FROM products WHERE sku = $1 AND is_active = true',
      [sku]
    );
    return result.rows[0];
  }

  // Update product - FIXED VERSION
  async updateProduct(id, updateData) {
    const allowedFields = [
      'name', 'description', 'price', 'sku', 'category', 
      'image_url', 'stock_quantity', 'low_stock_threshold', 'is_active'
    ];
    
    const updateFields = [];
    const queryParams = [];
    let paramCount = 0;

    // Build dynamic update query with explicit type casting
    Object.keys(updateData).forEach(field => {
      if (allowedFields.includes(field) && updateData[field] !== undefined) {
        paramCount++;
        
        // Handle different data types explicitly
        if (field === 'price') {
          updateFields.push(`${field} = $${paramCount}::DECIMAL`);
        } else if (field === 'stock_quantity' || field === 'low_stock_threshold') {
          updateFields.push(`${field} = $${paramCount}::INTEGER`);
        } else if (field === 'is_active') {
          updateFields.push(`${field} = $${paramCount}::BOOLEAN`);
        } else {
          updateFields.push(`${field} = $${paramCount}`);
        }
        
        queryParams.push(updateData[field]);
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    // Add updated_at timestamp
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    
    // Add ID parameter
    paramCount++;
    queryParams.push(id);

    const query = `
      UPDATE products 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramCount} 
      RETURNING *
    `;

    console.log('Update Query:', query); // Debug log
    console.log('Query Params:', queryParams); // Debug log

    const result = await pool.query(query, queryParams);
    return result.rows[0];
  }

  // Delete product (soft delete)
  async deleteProduct(id) {
    const result = await pool.query(
      'UPDATE products SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows[0];
  }

  // Update stock quantity
  async updateStock(productId, newQuantity) {
    const result = await pool.query(
      `UPDATE products 
       SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING id, name, stock_quantity`,
      [newQuantity, productId]
    );
    return result.rows[0];
  }

  // Get low stock products
  async getLowStockProducts() {
    const result = await pool.query(
      `SELECT * FROM products 
       WHERE stock_quantity <= low_stock_threshold 
       AND is_active = true 
       ORDER BY stock_quantity ASC`
    );
    return result.rows;
  }
}

module.exports = new ProductModel();