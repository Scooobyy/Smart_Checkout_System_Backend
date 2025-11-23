const { pool } = require('../config/database');

class CartModel {
  
  // Add item to cart
  async addToCart(cartSessionId, productId, quantity = 1) {
    // Get product price
    const productResult = await pool.query(
      'SELECT price, stock_quantity, name FROM products WHERE id = $1 AND is_active = true',
      [productId]
    );

    if (productResult.rows.length === 0) {
      throw new Error('Product not found or inactive');
    }

    const product = productResult.rows[0];

    // Check stock availability
    if (product.stock_quantity < quantity) {
      throw new Error(`Insufficient stock. Only ${product.stock_quantity} items available`);
    }

    // Add or update cart item
    const result = await pool.query(
      `INSERT INTO cart_items (cart_session_id, product_id, quantity, price_at_add)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (cart_session_id, product_id) 
       DO UPDATE SET 
         quantity = cart_items.quantity + $3,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [cartSessionId, productId, quantity, product.price]
    );

    return result.rows[0];
  }

  // Get cart items with product details
  async getCartItems(cartSessionId) {
    const result = await pool.query(
      `SELECT 
        ci.id,
        ci.quantity,
        ci.price_at_add,
        ci.created_at,
        p.id as product_id,
        p.name,
        p.description,
        p.image_url,
        p.sku,
        p.stock_quantity
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_session_id = $1
       ORDER BY ci.created_at DESC`,
      [cartSessionId]
    );

    return result.rows;
  }

  // Update cart item quantity
  async updateCartItemQuantity(cartItemId, quantity) {
    if (quantity <= 0) {
      // Remove item if quantity is 0 or negative
      return await this.removeFromCart(cartItemId);
    }

    // Check product stock
    const cartItem = await pool.query(
      `SELECT ci.product_id, p.stock_quantity 
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.id = $1`,
      [cartItemId]
    );

    if (cartItem.rows.length === 0) {
      throw new Error('Cart item not found');
    }

    if (cartItem.rows[0].stock_quantity < quantity) {
      throw new Error(`Insufficient stock. Only ${cartItem.rows[0].stock_quantity} items available`);
    }

    const result = await pool.query(
      `UPDATE cart_items 
       SET quantity = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [quantity, cartItemId]
    );

    return result.rows[0];
  }

  // Remove item from cart
  async removeFromCart(cartItemId) {
    const result = await pool.query(
      'DELETE FROM cart_items WHERE id = $1 RETURNING id',
      [cartItemId]
    );
    return result.rows[0];
  }

  // Clear entire cart
  async clearCart(cartSessionId) {
    await pool.query(
      'DELETE FROM cart_items WHERE cart_session_id = $1',
      [cartSessionId]
    );
  }

  // Get cart summary
  async getCartSummary(cartSessionId) {
    const result = await pool.query(
      `SELECT 
         COUNT(*) as total_items,
         SUM(quantity) as total_quantity,
         SUM(quantity * price_at_add) as total_amount
       FROM cart_items 
       WHERE cart_session_id = $1`,
      [cartSessionId]
    );

    return result.rows[0] || { total_items: 0, total_quantity: 0, total_amount: 0 };
  }

  // Check if product is in cart
  async isProductInCart(cartSessionId, productId) {
    const result = await pool.query(
      'SELECT id, quantity FROM cart_items WHERE cart_session_id = $1 AND product_id = $2',
      [cartSessionId, productId]
    );
    return result.rows[0];
  }
}

module.exports = new CartModel();