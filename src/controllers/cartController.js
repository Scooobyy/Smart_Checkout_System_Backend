const cartModel = require('../models/cartModel');
const customerModel = require('../models/customerModel');
const { successResponse, errorResponse, validateRequiredFields } = require('../utils/helpers');

class CartController {
  
  // Add item to cart
  async addToCart(req, res, next) {
    try {
      const { product_id, quantity = 1 } = req.body;
      const cartSessionId = req.cart_session.id;

      validateRequiredFields(req.body, ['product_id']);

      const cartItem = await cartModel.addToCart(cartSessionId, product_id, parseInt(quantity));

      // Update cart session totals
      await customerModel.updateCartSessionTotals(cartSessionId);
      const updatedCart = await customerModel.getActiveCartSession(req.cart_session.customer_id);

      res.json(
        successResponse('Item added to cart successfully', {
          cart_item: cartItem,
          cart_summary: {
            item_count: updatedCart.item_count,
            total_amount: updatedCart.total_amount
          }
        })
      );

    } catch (error) {
      next(error);
    }
  }

  // Get cart items
  async getCart(req, res, next) {
    try {
      const cartSessionId = req.cart_session.id;

      const cartItems = await cartModel.getCartItems(cartSessionId);
      const cartSummary = await cartModel.getCartSummary(cartSessionId);

      res.json(
        successResponse('Cart retrieved successfully', {
          items: cartItems,
          summary: cartSummary
        })
      );

    } catch (error) {
      next(error);
    }
  }

  // Update cart item quantity
  async updateCartItem(req, res, next) {
    try {
      const { cart_item_id } = req.params;
      const { quantity } = req.body;

      validateRequiredFields(req.body, ['quantity']);

      const updatedItem = await cartModel.updateCartItemQuantity(cart_item_id, parseInt(quantity));

      // Update cart session totals
      await customerModel.updateCartSessionTotals(req.cart_session.id);
      const updatedCart = await customerModel.getActiveCartSession(req.cart_session.customer_id);

      res.json(
        successResponse('Cart item updated successfully', {
          cart_item: updatedItem,
          cart_summary: {
            item_count: updatedCart.item_count,
            total_amount: updatedCart.total_amount
          }
        })
      );

    } catch (error) {
      next(error);
    }
  }

  // Remove item from cart
  async removeFromCart(req, res, next) {
    try {
      const { cart_item_id } = req.params;

      const removedItem = await cartModel.removeFromCart(cart_item_id);

      // Update cart session totals
      await customerModel.updateCartSessionTotals(req.cart_session.id);
      const updatedCart = await customerModel.getActiveCartSession(req.cart_session.customer_id);

      res.json(
        successResponse('Item removed from cart successfully', {
          removed_item: removedItem,
          cart_summary: {
            item_count: updatedCart.item_count,
            total_amount: updatedCart.total_amount
          }
        })
      );

    } catch (error) {
      next(error);
    }
  }

  // Clear entire cart
  async clearCart(req, res, next) {
    try {
      const cartSessionId = req.cart_session.id;

      await cartModel.clearCart(cartSessionId);

      // Update cart session totals
      await customerModel.updateCartSessionTotals(cartSessionId);

      res.json(
        successResponse('Cart cleared successfully')
      );

    } catch (error) {
      next(error);
    }
  }

  // Get cart summary
  async getCartSummary(req, res, next) {
    try {
      const cartSessionId = req.cart_session.id;

      const cartSummary = await cartModel.getCartSummary(cartSessionId);
      const cartItems = await cartModel.getCartItems(cartSessionId);

      res.json(
        successResponse('Cart summary retrieved successfully', {
          summary: cartSummary,
          items: cartItems
        })
      );

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CartController();