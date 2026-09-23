const { Product, Customer, ActivationCode } = require('../models');
const { initDatabase } = require('../config/db');

async function testCourseWithAccessUrlFlow() {
  await initDatabase();
  console.log('--- 1. Database Synced ---');

  // Create Course Product with custom access_url
  const course = await Product.create({
    code: 'COURSE-VIP-' + Date.now(),
    name: 'دورة البكالوريا الممتازة 2026 (مع رابط الدخول المباشر)',
    price: 3900,
    is_active: true,
    type: 'course',
    access_url: 'https://naja7t.com/classrooms/bac-math-vip-2026'
  });
  console.log('--- 2. Course Product Created:', course.id, course.name, 'Access URL:', course.access_url);

  // Create Activation Code
  await ActivationCode.create({
    code: 'VIP-' + Math.floor(10000 + Math.random() * 90000),
    status: 'unused',
    product_id: String(course.id)
  });

  const app = require('../server');
  await new Promise(r => setTimeout(r, 1000));

  try {
    const orderId = `CUST-${Math.floor(100000 + Math.random() * 900000)}`;

    // Simulate Chargily Webhook Call for Course Purchase
    const webhookPayload = JSON.stringify({
      id: 'evt_course_vip_123',
      type: 'checkout.paid',
      data: {
        id: 'chk_vip_123',
        payment_method: 'edahabia',
        customer: {
          name: 'أسامة - تجربة شراء دورة برابط',
          email: 'oussamabvb201283@gmail.com',
          phone: '0555987654'
        },
        metadata: {
          order_id: orderId,
          course_id: String(course.id),
          course_name: course.name,
          customer_email: 'oussamabvb201283@gmail.com'
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

    const webhookData = await webhookRes.json();
    console.log('--- 3. Webhook Status:', webhookRes.status, webhookData);

    // Check customer in DB
    const customer = await Customer.findOne({ where: { serial_number: orderId } });
    if (customer) {
      console.log('✅ CUSTOMER COURSE RECORD IN DB:', {
        serial: customer.serial_number,
        email: customer.email,
        activation_code: customer.activation_code,
        status: customer.payment_status,
        access_url: webhookData.data.accessUrl
      });
    }

  } catch (err) {
    console.error('Test Error:', err);
  } finally {
    process.exit(0);
  }
}

testCourseWithAccessUrlFlow();
