const Razorpay = require('razorpay');
const crypto = require('crypto');

class PaymentService {
  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }

  // Create order in Razorpay
  async createOrder(amount, currency = 'INR', receipt = null, notes = {}) {
    try {
      // Check if running in test mode with placeholder credentials
      if (process.env.RAZORPAY_KEY_ID === 'your_actual_test_key_id_here' || 
          process.env.RAZORPAY_KEY_ID === 'rzp_test_your_key_id_here') {
        console.log('Running in test mode - generating mock Razorpay order');
        return this.generateMockOrder(amount, currency, receipt, notes);
      }

      // Convert amount to paise (smallest currency unit for INR)
      const amountInPaise = Math.round(amount * 100);

      const options = {
        amount: amountInPaise,
        currency: currency,
        receipt: receipt || `receipt_${Date.now()}`,
        notes: notes,
        payment_capture: 1 // Auto capture payment
      };

      console.log('Creating Razorpay order with options:', options);

      const order = await this.razorpay.orders.create(options);
      
      console.log('Razorpay order created:', order.id);

      return {
        order_id: order.id,
        amount: order.amount / 100, // Convert back to rupees
        currency: order.currency,
        receipt: order.receipt,
        status: order.status
      };
    } catch (error) {
      console.error('Razorpay order creation error:', error);
      throw new Error(`Payment processing error: ${error.error ? error.error.description : error.message}`);
    }
  }

  // Generate mock order for testing
  generateMockOrder(amount, currency = 'INR', receipt = null, notes = {}) {
    const mockOrderId = `order_mock_${Date.now()}`;
    console.log('Generated mock order:', mockOrderId);
    
    return {
      order_id: mockOrderId,
      amount: amount,
      currency: currency,
      receipt: receipt || `receipt_${Date.now()}`,
      status: 'created'
    };
  }

  // Verify payment signature
  verifyPaymentSignature(orderId, paymentId, signature) {
    try {
      const body = orderId + "|" + paymentId;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

      const isValid = expectedSignature === signature;
      
      console.log('Payment signature verification:', {
        orderId,
        paymentId,
        isValid,
        expectedSignature,
        receivedSignature: signature
      });

      return isValid;
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  // Fetch payment details
  async fetchPayment(paymentId) {
    try {
      console.log('Fetching payment details for:', paymentId);
      const payment = await this.razorpay.payments.fetch(paymentId);
      
      console.log('Payment details fetched:', {
        id: payment.id,
        status: payment.status,
        amount: payment.amount / 100,
        method: payment.method
      });

      return payment;
    } catch (error) {
      console.error('Razorpay fetch payment error:', error);
      throw new Error(`Failed to fetch payment: ${error.error ? error.error.description : error.message}`);
    }
  }

  // Fetch order details
  async fetchOrder(orderId) {
    try {
      console.log('Fetching order details for:', orderId);
      const order = await this.razorpay.orders.fetch(orderId);
      return order;
    } catch (error) {
      console.error('Razorpay fetch order error:', error);
      throw new Error(`Failed to fetch order: ${error.error ? error.error.description : error.message}`);
    }
  }

  // Create refund
  async createRefund(paymentId, amount = null) {
    try {
      const refundData = {
        payment_id: paymentId,
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100); // Convert to paise
      }

      console.log('Creating refund:', refundData);
      const refund = await this.razorpay.refunds.create(refundData);
      
      console.log('Refund created:', refund.id);
      return refund;
    } catch (error) {
      console.error('Razorpay refund error:', error);
      throw new Error(`Refund failed: ${error.error ? error.error.description : error.message}`);
    }
  }

  // Generate test payment data (for development/testing)
  generateTestPaymentData(orderId) {
    // This is for testing without actual payment
    return {
      order_id: orderId,
      payment_id: `pay_test_${Date.now()}`,
      signature: this.generateTestSignature(orderId),
      amount: 100, // ₹1 for testing
      status: 'captured'
    };
  }

  // Generate test signature
  generateTestSignature(orderId) {
    const paymentId = `pay_test_${Date.now()}`;
    const body = orderId + "|" + paymentId;
    return crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');
  }

  // Verify webhook signature
  verifyWebhookSignature(body, signature) {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(JSON.stringify(body))
        .digest('hex');

      return expectedSignature === signature;
    } catch (error) {
      console.error('Webhook signature verification error:', error);
      return false;
    }
  }
}

module.exports = new PaymentService();