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
  console.log(`--- 1. Testing GET /api/purchase/test on port ${PORT} ---`);
  const res1 = await makeRequest({ host: 'localhost', port: PORT, path: '/api/purchase/test', method: 'GET' });
  console.log('Status:', res1.statusCode);
  console.log('Body:', JSON.stringify(res1.body, null, 2));

  console.log('\n--- 2. Testing POST /api/purchase/checkout (Chargily EDAHABIA) ---');
  const checkoutPayload = JSON.stringify({
    fullName: 'ياسين الجزائري',
    phone: '0550123456',
    email: 'yassine@example.com',
    courseId: 'BAC-PHYSICS-2026',
    courseTitle: 'التحضير للبكالوريا - مادة الفيزياء',
    plan: 'الدورة الكاملة',
    paymentMethod: 'EDAHABIA',
    amount: 5000,
    promoCode: 'EXCELLENCE20',
    wilaya: 'وهران'
  });

  const res2 = await makeRequest({
    host: 'localhost',
    port: PORT,
    path: '/api/purchase/checkout',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(checkoutPayload)
    }
  }, checkoutPayload);
  console.log('Status:', res2.statusCode);
  console.log('Body:', JSON.stringify(res2.body, null, 2));

  const orderId = res2.body && res2.body.data ? res2.body.data.orderId : null;

  if (orderId) {
    console.log(`\n--- 3. Testing Webhook POST /api/purchase/webhook/chargily for order ${orderId} ---`);
    const webhookPayload = JSON.stringify({
      type: 'checkout.paid',
      data: {
        id: 'chk_test_9999',
        metadata: {
          order_id: orderId,
          customer_name: 'ياسين الجزائري'
        }
      }
    });

    const res3 = await makeRequest({
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
    console.log('Status:', res3.statusCode);
    console.log('Body:', res3.body);

    console.log(`\n--- 4. Checking updated status for order ${orderId} ---`);
    const res4 = await makeRequest({ host: 'localhost', port: PORT, path: `/api/purchase/status/${orderId}`, method: 'GET' });
    console.log('Status:', res4.statusCode);
    console.log('Body:', JSON.stringify(res4.body, null, 2));
  }
}

runTests().catch(console.error);
