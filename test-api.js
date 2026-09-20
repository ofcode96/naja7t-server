const http = require('http');

const PORT = process.env.PORT || 5000;

function makeRequest(options, postData, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ ...options, headers: { ...options.headers, ...headers } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTests() {
  console.log(`\n--- 1. Testing Security Price Tampering Protection ---`);
  // نحاول التلاعب بالسعر وإرسال 10 دج بدلاً من السعر الأصلي 4000 دج
  const tamperedPayload = JSON.stringify({
    courseId: 'BAC-MATH-2026',
    amount: 10 // محاولة تلاعب بسعر الدورة
  });

  const res1 = await makeRequest({
    host: 'localhost',
    port: PORT,
    path: '/api/purchase/checkout',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(tamperedPayload)
    }
  }, tamperedPayload);

  console.log('Status:', res1.statusCode);
  console.log('Returned Trusted Amount:', res1.body.data.pricing.amount, 'DZD');
  if (res1.body.data.pricing.amount === 4000) {
    console.log('🛡️ SUCCESS: Server protected the price and rejected frontend tampering!');
  } else {
    console.error('❌ SECURITY FAILURE: Server accepted tampered amount!');
  }

  console.log(`\n--- 2. Testing Webhook & Status Flow ---`);
  const orderId = res1.body.data.orderId;
  const webhookPayload = JSON.stringify({
    type: 'checkout.paid',
    data: { id: 'chk_sec_test', metadata: { order_id: orderId } }
  });

  await makeRequest({
    host: 'localhost',
    port: PORT,
    path: '/api/purchase/webhook/chargily',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'chargily-signature': 'mock_signature_for_test',
      'Content-Length': Buffer.byteLength(webhookPayload)
    }
  }, webhookPayload);

  const resStatus = await makeRequest({ host: 'localhost', port: PORT, path: `/api/purchase/status/${orderId}`, method: 'GET' });
  console.log('Updated Status:', resStatus.body.data.status);
}

runTests().catch(console.error);
