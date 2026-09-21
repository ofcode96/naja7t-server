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
  console.log(`--- Testing Simplified Purchase Request ({ "courseId": 1 }) ---`);
  const checkoutPayload = JSON.stringify({
    courseId: 1
  });

  const resCheckout = await makeRequest({
    host: 'localhost', port: PORT, path: '/api/purchase/checkout', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(checkoutPayload) }
  }, checkoutPayload);

  console.log('Status:', resCheckout.statusCode);
  console.log('Checkout URL:', resCheckout.body.checkoutUrl);
}

runTests().catch(console.error);
