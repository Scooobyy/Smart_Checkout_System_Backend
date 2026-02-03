const orderModel = require('../models/orderModel');
const cartModel = require('../models/cartModel');
const customerModel = require('../models/customerModel');
const razorpayService = require('../services/razorpayService');
const { successResponse, errorResponse, validateRequiredFields } = require('../utils/helpers');

class OrderController {
  
  // Create order and Razorpay order
  async createOrder(req, res, next) {
    try {
      const { shipping_address, payment_method = 'razorpay' } = req.body;
      const cartSessionId = req.cart_session.id;
      const customerId = req.cart_session.customer_id;

      // Get cart summary to calculate total
      const cartSummary = await cartModel.getCartSummary(cartSessionId);
      const cartItems = await cartModel.getCartItems(cartSessionId);

      if (cartItems.length === 0) {
        return res.status(400).json(
          errorResponse('Cart is empty')
        );
      }

      // Validate stock availability
      for (const item of cartItems) {
        if (item.quantity > item.stock_quantity) {
          return res.status(400).json(
            errorResponse(`Insufficient stock for ${item.name}. Only ${item.stock_quantity} available`)
          );
        }
      }

      // Create order in our database
      const orderData = {
        customer_id: customerId,
        cart_session_id: cartSessionId,
        total_amount: parseFloat(cartSummary.total_amount),
        payment_method: payment_method,
        shipping_address: shipping_address
      };

      const order = await orderModel.createOrder(orderData);

      // Create order items
      await orderModel.createOrderItems(order.id, cartSessionId);

      // Create Razorpay order
      const razorpayOrder = await razorpayService.createOrder(
        order.total_amount,
        'INR',
        `order_${order.id}`,
        {
          order_id: order.id,
          customer_id: customerId,
          cart_session_id: cartSessionId
        }
      );

      // Update order with Razorpay order ID
      await orderModel.updatePaymentDetails(order.id, {
        payment_intent_id: razorpayOrder.order_id,
        payment_status: 'created'
      });

      res.status(201).json(
        successResponse('Order created successfully', {
          order: {
            id: order.id,
            total_amount: order.total_amount,
            status: order.status,
            currency: 'INR'
          },
          payment: {
            razorpay_order_id: razorpayOrder.order_id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            key_id: process.env.RAZORPAY_KEY_ID,
            callback_url: `${process.env.FRONTEND_URL}/payment-callback`
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

      // Verify payment signature
      const isValidSignature = razorpayService.verifyPaymentSignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );

      if (!isValidSignature) {
        return res.status(400).json(
          errorResponse('Payment verification failed')
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
          successResponse('Payment already processed', { order })
        );
      }

      // Fetch payment details from Razorpay
      const paymentDetails = await razorpayService.fetchPayment(razorpay_payment_id);

      if (paymentDetails.status !== 'captured' && paymentDetails.status !== 'authorized') {
        return res.status(400).json(
          errorResponse('Payment not completed')
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

      res.json(
        successResponse('Payment verified successfully', { 
          order: updatedOrder,
          payment: {
            id: razorpay_payment_id,
            status: paymentDetails.status,
            method: paymentDetails.method
          }
        })
      );

    } catch (error) {
      next(error);
    }
  }

  // Get order details
  async getOrder(req, res, next) {
    try {
      const { order_id } = req.params;
      const customerId = req.cart_session.customer_id;

      const order = await orderModel.getOrderById(order_id);

      if (!order) {
        return res.status(404).json(
          errorResponse('Order not found')
        );
      }

      // Check if order belongs to customer
      if (order.customer_id !== customerId) {
        return res.status(403).json(
          errorResponse('Access denied')
        );
      }

      res.json(
        successResponse('Order retrieved successfully', { order })
      );

    } catch (error) {
      next(error);
    }
  }

  // Get customer orders
  async getCustomerOrders(req, res, next) {
    try {
      const customerId = req.cart_session.customer_id;
      const { page = 1, limit = 10 } = req.query;

      const result = await orderModel.getOrdersByCustomer(
        customerId, 
        parseInt(page), 
        parseInt(limit)
      );

      res.json(
        successResponse('Orders retrieved successfully', result)
      );

    } catch (error) {
      next(error);
    }
  }

  // Cancel order
  async cancelOrder(req, res, next) {
    try {
      const { order_id } = req.params;
      const customerId = req.cart_session.customer_id;

      const order = await orderModel.getOrderById(order_id);

      if (!order) {
        return res.status(404).json(
          errorResponse('Order not found')
        );
      }

      // Check if order belongs to customer and is pending
      if (order.customer_id !== customerId) {
        return res.status(403).json(
          errorResponse('Access denied')
        );
      }

      if (order.status !== 'pending') {
        return res.status(400).json(
          errorResponse('Only pending orders can be cancelled')
        );
      }

      const updatedOrder = await orderModel.updateOrderStatus(order_id, 'cancelled');

      res.json(
        successResponse('Order cancelled successfully', { 
          order: updatedOrder 
        })
      );

    } catch (error) {
      next(error);
    }
  }

  // Get Razorpay key (for frontend)
  async getRazorpayKey(req, res, next) {
    try {
      res.json(
        successResponse('Razorpay key retrieved', {
          key_id: process.env.RAZORPAY_KEY_ID,
          currency: 'INR'
        })
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OrderController();