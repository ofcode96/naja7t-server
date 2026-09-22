const app = require('../server');
const { Product, Customer, ActivationCode } = require('../models');
const { initDatabase } = require('../config/db');

async function testFullFlow() {
  await initDatabase();
  console.log('--- 1. Database Synced ---');

  // Create Product
  const prod = await Product.create({
    code: 'BEM-PACK',
    name: 'باقة نجحت المتكاملة',
    price: 2900,
    is_active: true
  });
  console.log('--- 2. Product Created:', prod.id, prod.name);

  // Create Activation Code
  await ActivationCode.create({
    code: 'ACT-99999',
    status: 'unused',
    product_id: String(prod.id)
  });
  console.log('--- 3. Activation Code Created ---');

  const server = app.listen(5005, async () => {
    console.log('--- 4. Test Server Running on 5005 ---');

    try {
      // Simulate Checkout Call
      const checkoutPayload = JSON.stringify({ courseId: prod.id, ref: 'AFFILIATE-N2026' });
      const checkoutRes = await fetch('http://localhost:5005/api/purchase/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: checkoutPayload
      });
      const checkoutData = await checkoutRes.json();
      console.log('--- 5. Checkout Response:', checkoutRes.status, checkoutData);

      // Verify no customers in DB yet
      let customers = await Customer.findAll();
      console.log('--- 6. Customers count before webhook:', customers.length);

      // Simulate Chargily Webhook Call
      const webhookPayload = JSON.stringify({
        id: 'evt_123456',
        type: 'checkout.paid',
        data: {
          id: 'chk_test_123',
          payment_method: 'edahabia',
          customer: {
            name: 'محمد الجزائري',
            email: 'mohamed@gmail.com',
            phone: '0555123456'
          },
          metadata: {
            order_id: checkoutData.serialNumber,
            course_id: String(prod.id),
            course_name: prod.name,
            ref: 'AFFILIATE-N2026'
          }
        }
      });

      const webhookRes = await fetch('http://localhost:5005/api/purchase/webhook/chargily', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'chargily-signature': 'mock_sig'
        },
        body: webhookPayload
      });
      console.log('--- 7. Webhook Status:', webhookRes.status, await webhookRes.text());

      // Check customers in DB now
      customers = await Customer.findAll();
      console.log('--- 8. Customers count after webhook:', customers.length);
      if (customers.length > 0) {
        console.log('✅ CUSTOMER RECORD IN DB:', JSON.stringify(customers[0], null, 2));
      } else {
        console.error('❌ CUSTOMER NOT SAVED!');
      }

    } catch (err) {
      console.error('Test Error:', err);
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

testFullFlow();
