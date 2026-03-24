const orderModel = require('../models/orderModel');
const paymentService = require('../services/paymentService');
const { successResponse, errorResponse } = require('../utils/helpers');

class PaymentWebhookController {
  
  // Handle Razorpay webhooks
  async handleWebhook(req, res, next) {
    try {
      const webhookSignature = req.headers['x-razorpay-signature'];
      const webhookBody = req.body;

      console.log('Received webhook:', {
        signature: webhookSignature,
        event: webhookBody.event,
        payload: webhookBody.payload
      });

      // Verify webhook signature
      const isValid = paymentService.verifyWebhookSignature(webhookBody, webhookSignature);
      
      if (!isValid && !paymentService.isMockMode()) {
        console.error('Invalid webhook signature');
        return res.status(400).json(errorResponse('Invalid webhook signature'));
      }

      const event = webhookBody.event;
      console.log(`Processing webhook event: ${event}`);

      // Handle different event types
      switch (event) {
        case 'payment.captured':
          await this.handlePaymentCaptured(webhookBody.payload.payment.entity);
          break;

        case 'payment.failed':
          await this.handlePaymentFailed(webhookBody.payload.payment.entity);
          break;

        case 'order.paid':
          await this.handleOrderPaid(webhookBody.payload.order.entity);
          break;

        case 'refund.created':
          await this.handleRefundCreated(webhookBody.payload.refund.entity);
          break;

        default:
          console.log(`Unhandled webhook event: ${event}`);
      }

      res.json(successResponse('Webhook processed'));

    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(400).json(errorResponse('Webhook processing failed'));
    }
  }

  // Handle payment captured
  async handlePaymentCaptured(payment) {
    try {
      const orderId = payment.notes?.order_id;
      const paymentId = payment.id;

      console.log(`Payment captured: ${paymentId} for order: ${orderId}`);

      if (!orderId) {
        console.error('No order ID in payment notes');
        return;
      }

      // Check if order exists and is not already paid
      const existingOrder = await orderModel.getOrderById(orderId);
      if (!existingOrder) {
        console.error(`Order ${orderId} not found`);
        return;
      }

      if (existingOrder.status === 'paid') {
        console.log(`Order ${orderId} already paid, skipping`);
        return;
      }

      // Update order status to paid
      const updatedOrder = await orderModel.updateOrderStatus(orderId, 'paid', paymentId);

      if (updatedOrder) {
        // Update product stock
        await orderModel.updateProductStock(orderId);

        // Mark cart session as completed
        await orderModel.completeCartSession(updatedOrder.cart_session_id);

        console.log(`Order ${orderId} marked as paid via webhook`);
      }

    } catch (error) {
      console.error('Error handling payment captured:', error);
    }
  }

  // Handle payment failed
  async handlePaymentFailed(payment) {
    try {
      const orderId = payment.notes?.order_id;

      if (orderId) {
        await orderModel.updateOrderStatus(orderId, 'failed', payment.id);
        console.log(`Order ${orderId} marked as failed via webhook`);
      }
    } catch (error) {
      console.error('Error handling payment failed:', error);
    }
  }

  // Handle order paid
  async handleOrderPaid(order) {
    try {
      const orderId = order.notes?.order_id;

      if (orderId) {
        // Check if already paid
        const existingOrder = await orderModel.getOrderById(orderId);
        if (existingOrder && existingOrder.status === 'paid') {
          console.log(`Order ${orderId} already paid, skipping`);
          return;
        }

        const updatedOrder = await orderModel.updateOrderStatus(orderId, 'paid', order.id);
        
        if (updatedOrder) {
          await orderModel.updateProductStock(orderId);
          await orderModel.completeCartSession(updatedOrder.cart_session_id);
          console.log(`Order ${orderId} marked as paid via order.paid webhook`);
        }
      }
    } catch (error) {
      console.error('Error handling order paid:', error);
    }
  }

  // Handle refund created
  async handleRefundCreated(refund) {
    try {
      const paymentId = refund.payment_id;
      
      // Find order by payment ID
      const orderResult = await orderModel.pool.query(
        'SELECT * FROM orders WHERE payment_intent_id = $1',
        [paymentId]
      );

      if (orderResult.rows.length > 0) {
        const order = orderResult.rows[0];
        console.log(`Refund created for order: ${order.id}, amount: ${refund.amount / 100}`);
        
        // You can update order status to refunded if needed
        // await orderModel.updateOrderStatus(order.id, 'refunded');
      }
    } catch (error) {
      console.error('Error handling refund created:', error);
    }
  }

  // Test webhook endpoint (for development)
  async testWebhook(req, res, next) {
    try {
      // This is for testing webhooks without Razorpay
      const { order_id, payment_id, event_type = 'payment.captured' } = req.body;

      console.log('Test webhook triggered:', { order_id, payment_id, event_type });

      if (!order_id) {
        return res.status(400).json(errorResponse('order_id is required'));
      }

      if (event_type === 'payment.captured') {
        // Check if order exists
        const order = await orderModel.getOrderById(order_id);
        if (!order) {
          return res.status(404).json(errorResponse('Order not found'));
        }

        if (order.status === 'paid') {
          return res.json(successResponse('Order already paid', { order }));
        }

        // Simulate payment captured
        const updatedOrder = await orderModel.updateOrderStatus(
          order_id, 
          'paid', 
          payment_id || `test_payment_${Date.now()}`
        );
        
        await orderModel.updateProductStock(order_id);
        await orderModel.completeCartSession(updatedOrder.cart_session_id);

        console.log(`Test payment captured for order: ${order_id}`);
      } else if (event_type === 'payment.failed') {
        await orderModel.updateOrderStatus(order_id, 'failed', payment_id);
        console.log(`Test payment failed for order: ${order_id}`);
      }

      res.json(successResponse('Test webhook processed'));

    } catch (error) {
      console.error('Test webhook error:', error);
      res.status(400).json(errorResponse(error.message));
    }
  }
}

module.exports = new PaymentWebhookController();