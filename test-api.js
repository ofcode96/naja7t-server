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
  console.log(`\n--- 1. Testing GET /api/products on port ${PORT} ---`);
  const resProducts = await makeRequest({ host: 'localhost', port: PORT, path: '/api/products', method: 'GET' });
  console.log('Status:', resProducts.statusCode, 'Count:', resProducts.body.count);

  console.log('\n--- 2. Testing Activation Code Uniqueness Enforcement ---');
  const payloadCode = JSON.stringify({ code: `NJ-CODE-${Math.floor(Math.random()*1000)}`, product_id: 'BAC-MATH-2026' });
  const resCode1 = await makeRequest({
    host: 'localhost', port: PORT, path: '/api/activation-codes', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payloadCode) }
  }, payloadCode);
  console.log('Creation Status:', resCode1.statusCode);

  console.log('\n--- 3. Testing Purchase with Encrypted Success URL ---');
  const purchasePayload = JSON.stringify({
    fullName: 'طالب اختباري',
    courseId: 'BAC-MATH-2026',
    paymentMethod: 'FREE'
  });

  const resPurchase = await makeRequest({
    host: 'localhost', port: PORT, path: '/api/purchase/checkout', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(purchasePayload) }
  }, purchasePayload);
  console.log('Purchase Status:', resPurchase.statusCode);
  console.log('Serial Number:', resPurchase.body.data.serial_number);
  console.log('Redirect URL:', resPurchase.body.redirectUrl);
}

runTests().catch(console.error);
