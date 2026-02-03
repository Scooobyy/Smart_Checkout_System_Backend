const orderModel = require('../models/orderModel');
const razorpayService = require('../services/razorpayService');
const { successResponse, errorResponse } = require('../utils/helpers');
const crypto = require('crypto');

class RazorpayWebhookController {
  
  // Handle Razorpay webhooks
  async handleWebhook(req, res, next) {
    try {
      const webhookSignature = req.headers['x-razorpay-signature'];
      const webhookBody = JSON.stringify(req.body);

      // Verify webhook signature
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(webhookBody)
        .digest('hex');

      if (webhookSignature !== expectedSignature) {
        console.error('Invalid webhook signature');
        return res.status(400).json(errorResponse('Invalid webhook signature'));
      }

      const event = req.body;
      console.log(`Razorpay webhook received: ${event.event}`);

      // Handle different event types
      switch (event.event) {
        case 'payment.captured':
          await this.handlePaymentCaptured(event.payload.payment.entity);
          break;

        case 'payment.failed':
          await this.handlePaymentFailed(event.payload.payment.entity);
          break;

        case 'order.paid':
          await this.handleOrderPaid(event.payload.order.entity);
          break;

        default:
          console.log(`Unhandled event type: ${event.event}`);
      }

      res.json(successResponse('Webhook processed'));

    } catch (error) {
      console.error('Webhook error:', error);
      res.status(400).json(errorResponse('Webhook processing failed'));
    }
  }

  // Handle payment captured
  async handlePaymentCaptured(payment) {
    try {
      const orderId = payment.notes.order_id;

      if (!orderId) {
        console.error('No order ID in payment notes');
        return;
      }

      // Update order status to paid
      const updatedOrder = await orderModel.updateOrderStatus(orderId, 'paid', payment.id);

      // Update product stock
      await orderModel.updateProductStock(orderId);

      // Mark cart session as completed
      await orderModel.completeCartSession(updatedOrder.cart_session_id);

      console.log(`Order ${orderId} marked as paid via webhook`);

    } catch (error) {
      console.error('Error handling payment captured:', error);
    }
  }

  // Handle payment failed
  async handlePaymentFailed(payment) {
    try {
      const orderId = payment.notes.order_id;

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
      const orderId = order.notes.order_id;

      if (orderId) {
        const updatedOrder = await orderModel.updateOrderStatus(orderId, 'paid', order.id);
        
        await orderModel.updateProductStock(orderId);
        await orderModel.completeCartSession(updatedOrder.cart_session_id);

        console.log(`Order ${orderId} marked as paid via order.paid webhook`);
      }
    } catch (error) {
      console.error('Error handling order paid:', error);
    }
  }
}

module.exports = new RazorpayWebhookController();