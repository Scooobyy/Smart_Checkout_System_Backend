const axios = require('axios');

async function testPaymentFlow() {
  const baseURL = 'http://localhost:5000/api';
  
  console.log('🧪 Testing Complete Payment Flow...\n');

  try {
    // 1. Create guest customer
    console.log('1. Creating guest customer...');
    const guestRes = await axios.post(`${baseURL}/customers/guest`);
    const cartSessionToken = guestRes.data.data.cart_session.token;
    console.log('✅ Guest created, Cart Token:', cartSessionToken.substring(0, 20) + '...');

    // 2. Create product (as admin - you'll need admin token)
    console.log('\n2. Note: Create product via admin first');
    console.log('   Use: POST /api/products with admin token');
    
    // 3. Get product QR data (from your database)
    console.log('\n3. Note: Get product QR data from database');
    
    // 4. Scan QR to add to cart
    console.log('\n4. Scanning QR code...');
    // const qrRes = await axios.post(`${baseURL}/qr/scan`, {
    //   qr_data: 'YOUR_QR_DATA_HERE'
    // }, {
    //   headers: { 'X-Cart-Session': cartSessionToken }
    // });
    // console.log('✅ Product added to cart');

    // 5. Create order
    console.log('\n5. Creating order...');
    const orderRes = await axios.post(`${baseURL}/orders/create`, {
      shipping_address: {
        street: 'Test Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        zip: '400001'
      }
    }, {
      headers: { 'X-Cart-Session': cartSessionToken }
    });
    
    const orderId = orderRes.data.data.order.id;
    const razorpayOrderId = orderRes.data.data.payment.razorpay_order_id;
    console.log('✅ Order created:', orderId);
    console.log('   Razorpay Order ID:', razorpayOrderId);

    // 6. Test payment (development only)
    console.log('\n6. Testing payment (development mode)...');
    const testPaymentRes = await axios.post(
      `${baseURL}/orders/${orderId}/test-payment`,
      {},
      { headers: { 'X-Cart-Session': cartSessionToken } }
    );
    
    console.log('✅ Test payment completed');
    console.log('   Order Status:', testPaymentRes.data.data.order.status);

    // 7. Test exit gate validation
    console.log('\n7. Testing exit gate validation...');
    console.log('   Note: Need UHF tag ID assigned to product');
    // const exitRes = await axios.post(`${baseURL}/exit-gate/validate`, {
    //   uhf_uids: ['YOUR_UHF_TAG_ID']
    // });
    // console.log('✅ Exit gate validation:', exitRes.data.data.all_paid);

    console.log('\n🎉 Payment flow test completed!');
    console.log('\nNext steps:');
    console.log('1. Set up Razorpay test account');
    console.log('2. Configure webhooks in Razorpay dashboard');
    console.log('3. Test with real QR codes');
    console.log('4. Test with UHF RFID tags');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testPaymentFlow();