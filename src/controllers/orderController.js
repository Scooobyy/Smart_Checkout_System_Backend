const orderModel = require('../models/orderModel');
const cartModel = require('../models/cartModel');
const customerModel = require('../models/customerModel');
const paymentService = require('../services/paymentService');
const { successResponse, errorResponse, validateRequiredFields } = require('../utils/helpers');

class OrderController {
  
  // Create order and payment
 async createOrder(req, res, next) {
  try {
    console.log('=== CREATE ORDER DEBUG ===');
    const { shipping_address, payment_method = 'razorpay' } = req.body;
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
      payment_method: payment_method,
      shipping_address: shipping_address
    };

    const order = await orderModel.createOrder(orderData);
    console.log('Order created:', order.id);

    // Create order items
    await orderModel.createOrderItems(order.id, cartSessionId);
    console.log('Order items created');

    // Generate a short receipt (max 40 chars)
    // Remove hyphens from UUID and take first 30 chars, then add prefix
    const shortId = order.id.replace(/-/g, '').substring(0, 30);
    const receipt = `ORD_${shortId}`; // Total length: 4 + 30 = 34 chars
    console.log('Receipt generated:', receipt, `Length: ${receipt.length}`);

    // Create Razorpay order
    const razorpayOrder = await paymentService.createOrder(
      order.total_amount,
      process.env.PAYMENT_CURRENCY || 'INR',
      receipt,  // Use shortened receipt
      {
        order_id: order.id,
        customer_id: customerId,
        cart_session_id: cartSessionId
      }
    );
    console.log('Razorpay order created:', razorpayOrder.order_id);

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
          currency: razorpayOrder.currency
        },
        payment: {
          razorpay_order_id: razorpayOrder.order_id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          key_id: process.env.RAZORPAY_KEY_ID,
          callback_url: `${process.env.FRONTEND_URL}/payment-callback`,
          notes: {
            order_id: order.id,
            customer_id: customerId
          }
        }
      })
    );

  } catch (error) {
    console.error('Create order error:', error);
    console.error('Error stack:', error.stack);
    next(error);
  }
}

  // Verify payment and update order
 // Verify payment and update order
// Verify payment and update order
// Verify payment and update order
async verifyPayment(req, res, next) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    
    console.log('=== VERIFY PAYMENT DEBUG ===');
    console.log('Razorpay Order ID:', razorpay_order_id);
    console.log('Razorpay Payment ID:', razorpay_payment_id);
    console.log('Razorpay Signature:', razorpay_signature);
    
    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json(
        errorResponse('Missing required payment verification fields')
      );
    }

    // Verify payment signature
    const isValidSignature = paymentService.verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    console.log('Signature verification result:', isValidSignature);

    if (!isValidSignature) {
      console.error('Payment signature verification failed');
      return res.status(400).json(
        errorResponse('Payment verification failed - invalid signature')
      );
    }

    // Find order by Razorpay order ID (payment_intent_id)
    console.log('Looking for order with payment_intent_id:', razorpay_order_id);
    
    const order = await orderModel.getOrderByRazorpayOrderId(razorpay_order_id);
    console.log('Order found:', order ? order.id : 'NOT FOUND');
    
    if (!order) {
      return res.status(404).json(
        errorResponse(`Order not found for payment_intent_id: ${razorpay_order_id}`)
      );
    }

    console.log('Order details:', {
      id: order.id,
      status: order.status,
      payment_intent_id: order.payment_intent_id,
      cart_session_id: order.cart_session_id
    });

    // Check if already processed
    if (order.status === 'paid') {
      console.log('Order already paid, skipping update');
      return res.json(
        successResponse('Payment already processed', { order })
      );
    }

    // Update order status to paid
    console.log('Updating order status to paid...');
    const updatedOrder = await orderModel.updateOrderStatus(
      order.id, 
      'paid', 
      razorpay_payment_id  // Store the payment ID, not order ID
    );
    
    if (!updatedOrder) {
      console.error('Failed to update order status - no order returned');
      return res.status(500).json(
        errorResponse('Failed to update order status')
      );
    }
    
    console.log('Order status updated successfully');
    console.log('Updated order:', {
      id: updatedOrder.id,
      status: updatedOrder.status,
      payment_intent_id: updatedOrder.payment_intent_id,
      payment_status: updatedOrder.payment_status
    });

    // Update product stock
    try {
      await orderModel.updateProductStock(order.id);
      console.log('Product stock updated successfully');
    } catch (error) {
      console.error('Failed to update stock:', error);
      // Don't fail the payment if stock update fails
    }

    // Mark cart session as completed
    try {
      await orderModel.completeCartSession(order.cart_session_id);
      console.log('Cart session completed successfully');
    } catch (error) {
      console.error('Failed to complete cart session:', error);
    }

    res.json(
      successResponse('Payment verified successfully', { 
        order: updatedOrder
      })
    );

  } catch (error) {
    console.error('Payment verification error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json(errorResponse(error.message || 'Payment verification failed'));
  }
}

  // Test payment (for development)
  async testPayment(req, res, next) {
    try {
      const { order_id } = req.params;
      const customerId = req.cart_session.customer_id;

      // Get order
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

      // Generate test payment data
      const testPayment = paymentService.generateTestPaymentData(order.payment_intent_id);

      // Verify with test data
      const isValid = paymentService.verifyPaymentSignature(
        testPayment.order_id,
        testPayment.payment_id,
        testPayment.signature
      );

      if (!isValid) {
        return res.status(400).json(
          errorResponse('Test payment verification failed')
        );
      }

      // Update order as paid
      const updatedOrder = await orderModel.updateOrderStatus(
        order.id, 
        'paid', 
        testPayment.payment_id
      );

      // Update product stock
      await orderModel.updateProductStock(order.id);

      // Mark cart session as completed
      await orderModel.completeCartSession(order.cart_session_id);

      res.json(
        successResponse('Test payment completed successfully', { 
          order: updatedOrder,
          payment: testPayment,
          note: 'This is a test payment. In production, use real Razorpay payments.'
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

  // Check payment status
  async checkPaymentStatus(req, res, next) {
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

      // If payment_intent_id exists, fetch from Razorpay
      let razorpayStatus = null;
      if (order.payment_intent_id && order.status === 'pending') {
        try {
          const razorpayOrder = await paymentService.fetchOrder(order.payment_intent_id);
          razorpayStatus = razorpayOrder.status;
        } catch (error) {
          console.error('Failed to fetch Razorpay status:', error);
        }
      }

      res.json(
        successResponse('Payment status retrieved', {
          order_id: order.id,
          status: order.status,
          payment_intent_id: order.payment_intent_id,
          razorpay_status: razorpayStatus,
          total_amount: order.total_amount,
          created_at: order.created_at
        })
      );

    } catch (error) {
      next(error);
    }
  }

  // Get all orders (for admin)
  async getAllOrders(req, res, next) {
    try {
      const { page = 1, limit = 10, status, customer_id, start_date, end_date } = req.query;

      const filters = {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        customer_id,
        start_date,
        end_date
      };

      const result = await orderModel.getAllOrders(filters);

      res.json(
        successResponse('All orders retrieved successfully', result)
      );

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OrderController();