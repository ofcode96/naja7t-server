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
  console.log(`--- Testing Checkout Endpoint on Port ${PORT} ---`);
  const payload = JSON.stringify({
    courseId: 'BAC-MATH-2026',
    amount: 2500,
    fullName: 'طالب بتسعيير ديناميكي',
    paymentMethod: 'EDAHABIA'
  });

  const res = await makeRequest({
    host: 'localhost', port: PORT, path: '/api/purchase/checkout', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
  }, payload);

  console.log('Status:', res.statusCode);
  console.log('Checkout URL:', res.body.checkoutUrl);
}

runTests().catch(console.error);
