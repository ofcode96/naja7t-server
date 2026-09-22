const { Product, Customer, ActivationCode } = require('../models');
const { initDatabase } = require('../config/db');

async function testFullFlow() {
  await initDatabase();
  console.log('--- 1. Database Synced ---');

  // Create Product
  const prod = await Product.create({
    code: 'BEM-PACK-' + Date.now(),
    name: 'باقة نجحت المتكاملة',
    price: 2900,
    is_active: true
  });
  console.log('--- 2. Product Created:', prod.id, prod.name);

  // Create Activation Code
  await ActivationCode.create({
    code: 'ACT-' + Math.floor(10000 + Math.random() * 90000),
    status: 'unused',
    product_id: String(prod.id)
  });
  console.log('--- 3. Activation Code Created ---');

  const app = require('../server');
  // Wait 1 second for server to initialize
  await new Promise(r => setTimeout(r, 1000));

  try {
    const orderId = `CUST-${Math.floor(100000 + Math.random() * 900000)}`;

    // Simulate Chargily Webhook Call directly to localhost:5000
    const webhookPayload = JSON.stringify({
      id: 'evt_123456',
      type: 'checkout.paid',
      data: {
        id: 'chk_test_123',
        payment_method: 'edahabia',
        customer: {
          name: 'أسامة - تجربة شراء حقيقية',
          email: 'oussamabvb201283@gmail.com',
          phone: '0555123456'
        },
        metadata: {
          order_id: orderId,
          course_id: String(prod.id),
          course_name: prod.name,
          customer_email: 'oussamabvb201283@gmail.com',
          ref: 'AFFILIATE-N2026'
        }
      }
    });

    const webhookRes = await fetch('http://localhost:5000/api/purchase/webhook/chargily', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'chargily-signature': 'mock_sig'
      },
      body: webhookPayload
    });

    console.log('--- 4. Webhook Status:', webhookRes.status, await webhookRes.text());

    // Check customer in DB
    const customer = await Customer.findOne({ where: { serial_number: orderId } });
    if (customer) {
      console.log('✅ CUSTOMER RECORD SAVED IN DB:', {
        serial: customer.serial_number,
        email: customer.email,
        activation_code: customer.activation_code,
        status: customer.payment_status
      });
    } else {
      console.error('❌ CUSTOMER NOT SAVED!');
    }

  } catch (err) {
    console.error('Test Error:', err);
  } finally {
    process.exit(0);
  }
}

testFullFlow();
