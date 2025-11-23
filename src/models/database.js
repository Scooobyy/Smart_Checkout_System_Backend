const { pool } = require('../config/database');

const initDatabase = async () => {
  try {
    await pool.query(`
      -- Admins Table (Simplified - without created_by for now)
      CREATE TABLE IF NOT EXISTS admins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'super_admin' CHECK (role IN ('super_admin', 'admin', 'manager', 'staff')),
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Products Table
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
        sku VARCHAR(100) UNIQUE,
        category VARCHAR(100),
        image_url VARCHAR(500),
        stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
        low_stock_threshold INTEGER DEFAULT 5,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- NFC Tags Table
      CREATE TABLE IF NOT EXISTS tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tag_uid VARCHAR(100) UNIQUE NOT NULL,
        product_id UUID REFERENCES products(id) ON DELETE SET NULL,
        status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'in_cart', 'paid', 'deactivated')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_scanned_at TIMESTAMP
      );

      -- Admin Invitations Table (for future use)
      CREATE TABLE IF NOT EXISTS admin_invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) DEFAULT 'staff',
        invited_by UUID REFERENCES admins(id),
        expires_at TIMESTAMP NOT NULL,
        is_used BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

  -- Customers Table
      CREATE TABLE IF NOT EXISTS customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        password_hash VARCHAR(255),
        is_guest BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Cart Sessions Table
      CREATE TABLE IF NOT EXISTS cart_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
        session_token VARCHAR(255) UNIQUE,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'abandoned', 'completed')),
        total_amount DECIMAL(10,2) DEFAULT 0,
        item_count INTEGER DEFAULT 0,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Cart Items Table
      CREATE TABLE IF NOT EXISTS cart_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cart_session_id UUID REFERENCES cart_sessions(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        price_at_add DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(cart_session_id, product_id)
      );

      -- Orders Table
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID REFERENCES customers(id),
        cart_session_id UUID REFERENCES cart_sessions(id),
        total_amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
        payment_method VARCHAR(50),
        payment_status VARCHAR(50),
        payment_intent_id VARCHAR(255),
        shipping_address JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Order Items Table
      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id),
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

    `);

 console.log('✅ Customer & Cart tables checked/created successfully');
    await createCustomerIndexes();

    console.log('✅ Database tables checked/created successfully');

    // Create indexes (only if they don't exist)
    await createIndexes();
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};


const createCustomerIndexes = async () => {
  try {
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
      CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
      CREATE INDEX IF NOT EXISTS idx_cart_sessions_customer_id ON cart_sessions(customer_id);
      CREATE INDEX IF NOT EXISTS idx_cart_sessions_token ON cart_sessions(session_token);
      CREATE INDEX IF NOT EXISTS idx_cart_items_session_id ON cart_items(cart_session_id);
      CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);
      CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
    `);
    console.log('✅ Customer & Cart indexes checked/created successfully');
  } catch (error) {
    console.error('❌ Customer index creation failed:', error);
  }
}

// Separate function for indexes
const createIndexes = async () => {
  try {
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
      CREATE INDEX IF NOT EXISTS idx_admins_role ON admins(role);
      CREATE INDEX IF NOT EXISTS idx_admin_invitations_token ON admin_invitations(token);
      CREATE INDEX IF NOT EXISTS idx_admin_invitations_email ON admin_invitations(email);
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
      CREATE INDEX IF NOT EXISTS idx_tags_tag_uid ON tags(tag_uid);
      CREATE INDEX IF NOT EXISTS idx_tags_product_id ON tags(product_id);
      CREATE INDEX IF NOT EXISTS idx_tags_status ON tags(status);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    `);
    console.log('✅ Database indexes checked/created successfully');
  } catch (error) {
    console.error('❌ Index creation failed:', error);
  }
};

module.exports = { initDatabase };