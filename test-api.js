const http = require('http');

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
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
  console.log('--- 1. Testing GET / ---');
  const res1 = await makeRequest({ host: 'localhost', port: 5000, path: '/', method: 'GET' });
  console.log('Status:', res1.statusCode);
  console.log('Body:', JSON.stringify(res1.body, null, 2));

  console.log('\n--- 2. Testing POST /api/purchase/checkout ---');
  const payload = JSON.stringify({
    fullName: 'محمد الأمين',
    phone: '0661234567',
    email: 'amine@example.com',
    courseId: 'BAC-MATH-2026',
    courseTitle: 'شعبة علوم تجريبية - مادة الرياضيات',
    plan: 'الدورة الكاملة',
    paymentMethod: 'BaridiMob',
    amount: 4000,
    promoCode: 'NAJA7T10',
    wilaya: 'الجزائر'
  });

  const res2 = await makeRequest({
    host: 'localhost',
    port: 5000,
    path: '/api/purchase/checkout',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, payload);
  console.log('Status:', res2.statusCode);
  console.log('Body:', JSON.stringify(res2.body, null, 2));

  if (res2.body && res2.body.data && res2.body.data.orderId) {
    const orderId = res2.body.data.orderId;
    console.log(`\n--- 3. Testing GET /api/purchase/status/${orderId} ---`);
    const res3 = await makeRequest({ host: 'localhost', port: 5000, path: `/api/purchase/status/${orderId}`, method: 'GET' });
    console.log('Status:', res3.statusCode);
    console.log('Body:', JSON.stringify(res3.body, null, 2));
  }
}

runTests().catch(console.error);
