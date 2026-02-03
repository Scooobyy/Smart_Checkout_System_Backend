const productModel = require('../models/productModel');
const cartModel = require('../models/cartModel');
const customerModel = require('../models/customerModel');
const { successResponse, errorResponse, validateRequiredFields } = require('../utils/helpers');

class QRController {
  
  // Scan QR code and add to cart
  async scanQRCode(req, res, next) {
    try {
      const { qr_data } = req.body;
      const cartSessionId = req.cart_session.id;

      validateRequiredFields(req.body, ['qr_data']);

      // Get product by QR code
      const product = await productModel.getProductByQRCode(qr_data);
      
      if (!product) {
        return res.status(404).json(
          errorResponse('Product not found for this QR code')
        );
      }

      // Check stock
      if (product.stock_quantity < 1) {
        return res.status(400).json(
          errorResponse('Product out of stock')
        );
      }

      // Add to cart
      const cartItem = await cartModel.addToCart(
        cartSessionId, 
        product.id, 
        1  // Default quantity
      );

      // Update cart session totals
      await customerModel.updateCartSessionTotals(cartSessionId);
      const updatedCart = await customerModel.getActiveCartSession(req.cart_session.customer_id);

      res.json(
        successResponse('Product added to cart successfully', {
          cart_item: cartItem,
          product: {
            id: product.id,
            name: product.name,
            price: product.price,
            sku: product.sku,
            stock_quantity: product.stock_quantity,
            qr_code_data: product.qr_code_data
          },
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

  // Get product info by QR code (for display before adding)
  async getProductByQRCode(req, res, next) {
    try {
      const { qr_data } = req.params;

      const product = await productModel.getProductByQRCode(qr_data);
      
      if (!product) {
        return res.status(404).json(
          errorResponse('Product not found')
        );
      }

      res.json(
        successResponse('Product retrieved successfully', { product })
      );

    } catch (error) {
      next(error);
    }
  }

  // Scan by SKU (alternative method)
  async scanSKU(req, res, next) {
    try {
      const { sku, quantity = 1 } = req.body;
      const cartSessionId = req.cart_session.id;

      validateRequiredFields(req.body, ['sku']);

      const product = await productModel.getProductBySku(sku);
      
      if (!product) {
        return res.status(404).json(
          errorResponse('Product not found for this SKU')
        );
      }

      // Check stock
      if (product.stock_quantity < quantity) {
        return res.status(400).json(
          errorResponse(`Only ${product.stock_quantity} items in stock`)
        );
      }

      // Add to cart
      const cartItem = await cartModel.addToCart(cartSessionId, product.id, parseInt(quantity));

      await customerModel.updateCartSessionTotals(cartSessionId);
      const updatedCart = await customerModel.getActiveCartSession(req.cart_session.customer_id);

      res.json(
        successResponse('Product added to cart successfully', {
          cart_item: cartItem,
          product: {
            id: product.id,
            name: product.name,
            price: product.price,
            sku: product.sku
          },
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

  // Generate QR code for product (admin only)
  async generateQRCode(req, res, next) {
    try {
      const { product_id } = req.params;

      const qrData = await productModel.generateQRCodeForProduct(product_id);

      res.json(
        successResponse('QR code generated successfully', qrData)
      );

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new QRController();