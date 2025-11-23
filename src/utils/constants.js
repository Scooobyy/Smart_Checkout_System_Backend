module.exports = {
  ROLES: {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin', 
    MANAGER: 'manager',
    STAFF: 'staff'
  },
  
  PERMISSIONS: {
    // Super Admin can do everything
    MANAGE_ADMINS: 'manage_admins',
    MANAGE_PRODUCTS: 'manage_products',
    MANAGE_INVENTORY: 'manage_inventory',
    VIEW_ANALYTICS: 'view_analytics',
    MANAGE_SETTINGS: 'manage_settings'
  },
  
  TAG_STATUS: {
    AVAILABLE: 'available',
    ASSIGNED: 'assigned', 
    IN_CART: 'in_cart',
    PAID: 'paid',
    DEACTIVATED: 'deactivated'
  },
  
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    SERVER_ERROR: 500
  }
};