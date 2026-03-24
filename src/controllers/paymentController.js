const orderModel = require('../models/orderModel');
const cartModel = require('../models/cartModel');
const customerModel = require('../models/customerModel');
const razorpayService = require('../services/razorpayService');
const { successResponse, errorResponse, validateRequiredFields } = require('../utils/helpers');

class PaymentController {
  
  // Create Razorpay order for cart
  async createPaymentOrder(req, res, next) {
    try {
      const cartSessionId = req.cart_session.id;
      const customerId = req.cart_session.customer_id;

      // Get cart summary
      const cartSummary = await cartModel.getCartSummary(cartSessionId);
      const cartItems = await cartModel.getCartItems(cartSessionId);

      if (cartItems.length === 0) {
        return res.status(400).json(
          errorResponse('Cart is empty')
        );
      }

      // Validate stock
      for (const item of cartItems) {
        if (item.quantity > item.stock_quantity) {
          return res.status(400).json(
            errorResponse(`Insufficient stock for ${item.name}. Only ${item.stock_quantity} available`)
          );
        }
      }

      // Create order in database
      const orderData = {
        customer_id: customerId,
        cart_session_id: cartSessionId,
        total_amount: parseFloat(cartSummary.total_amount),
        payment_method: 'razorpay',
        shipping_address: req.body.shipping_address || null
      };

      const order = await orderModel.createOrder(orderData);
      
      // Create order items
      await orderModel.createOrderItems(order.id, cartSessionId);

      // Create Razorpay order
      const razorpayOrder = await razorpayService.createOrder(
        order.total_amount,
        process.env.PAYMENT_CURRENCY || 'INR',
        `order_${order.id}`,
        {
          order_id: order.id,
          customer_id: customerId,
          cart_session_id: cartSessionId,
          items_count: cartItems.length
        }
      );

      // Update order with Razorpay order ID
      await orderModel.updatePaymentDetails(order.id, {
        payment_intent_id: razorpayOrder.order_id,
        payment_status: 'created'
      });

      res.status(201).json(
        successResponse('Payment order created successfully', {
          order: {
            id: order.id,
            total_amount: order.total_amount,
            status: order.status,
            currency: razorpayOrder.currency
          },
          payment: {
            razorpay_order_id: razorpayOrder.order_id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            key_id: process.env.RAZORPAY_KEY_ID,
            notes: razorpayOrder.notes
          },
          cart_summary: {
            items_count: cartItems.length,
            total_amount: cartSummary.total_amount
          }
        })
      );

    } catch (error) {
      next(error);
    }
  }

  // Verify payment and update order
  async verifyPayment(req, res, next) {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      
      validateRequiredFields(req.body, [
        'razorpay_order_id', 
        'razorpay_payment_id', 
        'razorpay_signature'
      ]);

      console.log('Verifying payment:', { razorpay_order_id, razorpay_payment_id });

      // Verify payment signature
      const isValidSignature = razorpayService.verifyPaymentSignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );

      if (!isValidSignature) {
        return res.status(400).json(
          errorResponse('Payment verification failed - Invalid signature')
        );
      }

      // Find order by Razorpay order ID
      const orderResult = await orderModel.pool.query(
        'SELECT * FROM orders WHERE payment_intent_id = $1',
        [razorpay_order_id]
      );

      if (orderResult.rows.length === 0) {
        return res.status(404).json(
          errorResponse('Order not found')
        );
      }

      const order = orderResult.rows[0];

      // Check if already processed
      if (order.status === 'paid') {
        return res.json(
          successResponse('Payment already processed', { 
            order,
            payment_status: 'already_paid'
          })
        );
      }

      // Fetch payment details from Razorpay
      const paymentDetails = await razorpayService.fetchPayment(razorpay_payment_id);

      console.log('Payment details:', {
        status: paymentDetails.status,
        method: paymentDetails.method,
        amount: paymentDetails.amount / 100
      });

      if (paymentDetails.status !== 'captured' && paymentDetails.status !== 'authorized') {
        return res.status(400).json(
          errorResponse(`Payment not completed. Status: ${paymentDetails.status}`)
        );
      }

      // Update order status to paid
      const updatedOrder = await orderModel.updateOrderStatus(
        order.id, 
        'paid', 
        razorpay_payment_id
      );

      // Update product stock
      await orderModel.updateProductStock(order.id);

      // Mark cart session as completed
      await orderModel.completeCartSession(order.cart_session_id);

      // Update all product tags to 'paid' status
      await this.updateProductTagsToPaid(order.id);

      res.json(
        successResponse('Payment verified successfully', { 
          order: updatedOrder,
          payment: {
            id: razorpay_payment_id,
            status: paymentDetails.status,
            method: paymentDetails.method,
            amount: paymentDetails.amount / 100,
            currency: paymentDetails.currency
          }
        })
      );

    } catch (error) {
      console.error('Payment verification error:', error);
      next(error);
    }
  }

  // Update product tags to paid status
  async updateProductTagsToPaid(orderId) {
    try {
      // Get all products in this order
      const orderItems = await orderModel.pool.query(
        'SELECT product_id FROM order_items WHERE order_id = $1',
        [orderId]
      );

      for (const item of orderItems.rows) {
        // Update all tags for this product to 'paid' status
        await orderModel.pool.query(
          `UPDATE tags SET status = 'paid', last_scanned_at = CURRENT_TIMESTAMP 
           WHERE product_id = $1 AND status = 'in_cart'`,
          [item.product_id]
        );
      }
    } catch (error) {
      console.error('Error updating tags to paid:', error);
    }
  }

  // Get payment status
  async getPaymentStatus(req, res, next) {
    try {
      const { order_id } = req.params;

      const order = await orderModel.getOrderById(order_id);
      
      if (!order) {
        return res.status(404).json(
          errorResponse('Order not found')
        );
      }

      let paymentDetails = null;
      
      // If payment_intent_id exists, fetch from Razorpay
      if (order.payment_intent_id && order.payment_intent_id.startsWith('order_')) {
        try {
          const razorpayOrder = await razorpayService.fetchOrder(order.payment_intent_id);
          paymentDetails = {
            razorpay_order_id: razorpayOrder.id,
            status: razorpayOrder.status,
            amount: razorpayOrder.amount / 100,
            currency: razorpayOrder.currency
          };
        } catch (error) {
          console.error('Error fetching Razorpay order:', error);
        }
      }

      res.json(
        successResponse('Payment status retrieved', {
          order: {
            id: order.id,
            status: order.status,
            payment_status: order.payment_status,
            total_amount: order.total_amount
          },
          payment: paymentDetails
        })
      );

    } catch (error) {
      next(error);
    }
  }

  // Create refund
  async createRefund(req, res, next) {
    try {
      const { order_id } = req.params;
      const { amount, reason } = req.body;

      const order = await orderModel.getOrderById(order_id);
      
      if (!order) {
        return res.status(404).json(
          errorResponse('Order not found')
        );
      }

      if (order.status !== 'paid') {
        return res.status(400).json(
          errorResponse('Only paid orders can be refunded')
        );
      }

      if (!order.payment_intent_id || !order.payment_intent_id.startsWith('pay_')) {
        return res.status(400).json(
          errorResponse('Payment ID not found for refund')
        );
      }

      const refundAmount = amount || order.total_amount;
      const notes = { reason: reason || 'Refund requested', order_id: order.id };

      const refund = await razorpayService.createRefund(
        order.payment_intent_id,
        refundAmount,
        notes
      );

      // Update order status
      await orderModel.updateOrderStatus(order.id, 'refunded');

      res.json(
        successResponse('Refund initiated successfully', {
          refund: {
            id: refund.id,
            amount: refund.amount / 100,
            status: refund.status,
            currency: refund.currency
          },
          order: {
            id: order.id,
            status: 'refunded',
            refund_amount: refundAmount
          }
        })
      );

    } catch (error) {
      next(error);
    }
  }

  // Get Razorpay key for frontend
  async getRazorpayKey(req, res, next) {
    try {
      res.json(
        successResponse('Razorpay key retrieved', {
          key_id: process.env.RAZORPAY_KEY_ID,
          currency: process.env.PAYMENT_CURRENCY || 'INR',
          name: process.env.STORE_NAME || 'Smart Checkout Store',
          description: process.env.PAYMENT_DESCRIPTION || 'Payment for items purchased'
        })
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PaymentController();