const Razorpay = require('razorpay');
const crypto = require('crypto');

class PaymentService {
  constructor() {
    // Check if credentials are properly configured
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    
    if (!keyId || !keySecret || keyId === 'rzp_test_your_key_id_here' || keyId === 'your_actual_test_key_id_here') {
      console.warn('⚠️  Razorpay credentials not configured. Running in mock mode.');
      this.mockMode = true;
    } else {
      this.razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret
      });
      this.mockMode = false;
    }
  }

  // Create order in Razorpay
  // Create order in Razorpay
async createOrder(amount, currency = 'INR', receipt = null, notes = {}) {
  try {
    // If in mock mode, generate mock order
    if (this.mockMode) {
      console.log('Running in mock mode - generating mock Razorpay order');
      return this.generateMockOrder(amount, currency, receipt, notes);
    }

    // Convert amount to paise (smallest currency unit for INR)
    const amountInPaise = Math.round(amount * 100);

    // Truncate receipt to max 40 characters (Razorpay limit)
    let shortReceipt = receipt || `receipt_${Date.now()}`;
    if (shortReceipt.length > 40) {
      // Take last 40 characters or generate a shorter one
      shortReceipt = shortReceipt.slice(-40);
      console.log(`Receipt truncated from ${receipt.length} to ${shortReceipt.length} chars`);
    }

    const options = {
      amount: amountInPaise,
      currency: currency,
      receipt: shortReceipt,
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
  // Truncate receipt for mock order too
  let shortReceipt = receipt || `receipt_${Date.now()}`;
  if (shortReceipt.length > 40) {
    shortReceipt = shortReceipt.slice(-40);
  }
  
  const mockOrderId = `order_mock_${Date.now()}`;
  console.log('Generated mock order:', mockOrderId);
  
  return {
    order_id: mockOrderId,
    amount: amount,
    currency: currency,
    receipt: shortReceipt,
    status: 'created'
  };
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
      // If in mock mode, always return true for test payments
      if (this.mockMode && paymentId && paymentId.startsWith('pay_test_')) {
        console.log('Mock mode: Accepting test payment signature');
        return true;
      }

      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        console.error('RAZORPAY_KEY_SECRET not configured');
        return false;
      }

      const body = orderId + "|" + paymentId;
      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
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
 // Fetch payment details
async fetchPayment(paymentId) {
  try {
    // If in mock mode or test payment, return mock response
    if (this.mockMode || (paymentId && paymentId.startsWith('pay_test_'))) {
      console.log('Mock mode: Returning mock payment details');
      return {
        id: paymentId,
        status: 'captured',
        amount: 10000, // ₹100 in paise
        currency: 'INR',
        method: 'test',
        created_at: Date.now()
      };
    }

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
    // Don't throw, return null and let controller handle
    return null;
  }
}

  // Fetch order details
  async fetchOrder(orderId) {
    try {
      // If in mock mode, return mock response
      if (this.mockMode || (orderId && orderId.startsWith('order_mock_'))) {
        console.log('Mock mode: Returning mock order details');
        return {
          id: orderId,
          status: 'created',
          amount: 10000,
          currency: 'INR',
          created_at: Date.now()
        };
      }

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
      // If in mock mode, return mock refund
      if (this.mockMode) {
        console.log('Mock mode: Creating mock refund');
        return {
          id: `refund_mock_${Date.now()}`,
          payment_id: paymentId,
          amount: amount ? Math.round(amount * 100) : 10000,
          status: 'processed'
        };
      }

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
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'test_secret_key';
    return crypto
      .createHmac('sha256', keySecret)
      .update(body.toString())
      .digest('hex');
  }

  // Verify webhook signature
  verifyWebhookSignature(body, signature) {
    try {
      // If in mock mode, accept all signatures
      if (this.mockMode) {
        console.log('Mock mode: Accepting webhook signature');
        return true;
      }

      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
      
      if (!webhookSecret) {
        console.error('Webhook secret not configured');
        return false;
      }

      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(body))
        .digest('hex');

      return expectedSignature === signature;
    } catch (error) {
      console.error('Webhook signature verification error:', error);
      return false;
    }
  }

  // Check if in mock mode
  isMockMode() {
    return this.mockMode;
  }
}

module.exports = new PaymentService();