const Razorpay = require('razorpay');
const crypto = require('crypto');

class RazorpayService {
  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }

  // Create order in Razorpay
  async createOrder(amount, currency = 'INR', receipt = null, notes = {}) {
    try {
      const options = {
        amount: amount * 100, // Convert to paise
        currency: currency,
        receipt: receipt || `receipt_${Date.now()}`,
        notes: notes,
        payment_capture: 1 // Auto capture payment
      };

      const order = await this.razorpay.orders.create(options);
      
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

  // Verify payment signature
  verifyPaymentSignature(orderId, paymentId, signature) {
    try {
      const body = orderId + "|" + paymentId;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

      return expectedSignature === signature;
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  // Fetch payment details
  async fetchPayment(paymentId) {
    try {
      const payment = await this.razorpay.payments.fetch(paymentId);
      return payment;
    } catch (error) {
      console.error('Razorpay fetch payment error:', error);
      throw new Error(`Failed to fetch payment: ${error.error ? error.error.description : error.message}`);
    }
  }

  // Create refund
  async createRefund(paymentId, amount = null) {
    try {
      const refundData = {
        payment_id: paymentId,
      };

      if (amount) {
        refundData.amount = amount * 100; // Convert to paise
      }

      const refund = await this.razorpay.refunds.create(refundData);
      return refund;
    } catch (error) {
      console.error('Razorpay refund error:', error);
      throw new Error(`Refund failed: ${error.error ? error.error.description : error.message}`);
    }
  }

  // Generate payment link (for manual payments)
  async generatePaymentLink(amount, customer, notes = {}) {
    try {
      const paymentLink = await this.razorpay.paymentLink.create({
        amount: amount * 100,
        currency: "INR",
        accept_partial: false,
        description: "Payment for Smart Checkout System",
        customer: customer,
        notify: {
          sms: true,
          email: true
        },
        reminder_enable: true,
        notes: notes,
        callback_url: process.env.FRONTEND_SUCCESS_URL,
        callback_method: "get"
      });

      return paymentLink;
    } catch (error) {
      console.error('Razorpay payment link error:', error);
      throw new Error(`Payment link creation failed: ${error.error ? error.error.description : error.message}`);
    }
  }
}

module.exports = new RazorpayService();