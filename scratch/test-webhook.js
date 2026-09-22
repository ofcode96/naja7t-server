const { Product, Customer } = require('../models');
const { initDatabase } = require('../config/db');

async function testBookPurchaseFlow() {
  await initDatabase();
  console.log('--- 1. Database Synced ---');

  // Create Book Product
  const book = await Product.create({
    code: 'BOOK-MATH-' + Date.now(),
    name: 'كتاب الرياضيات الشامل للبكالوريا (PDF)',
    price: 1500,
    is_active: true,
    type: 'book',
    file_url: 'https://naja7t.com/downloads/sample-book.pdf'
  });
  console.log('--- 2. Book Product Created:', book.id, book.name, 'Type:', book.type);

  const app = require('../server');
  await new Promise(r => setTimeout(r, 1000));

  try {
    const orderId = `CUST-${Math.floor(100000 + Math.random() * 900000)}`;

    // Simulate Chargily Webhook Call for Book Purchase
    const webhookPayload = JSON.stringify({
      id: 'evt_book_123',
      type: 'checkout.paid',
      data: {
        id: 'chk_book_123',
        payment_method: 'edahabia',
        customer: {
          name: 'أسامة - تجربة شراء كتاب',
          email: 'oussamabvb201283@gmail.com',
          phone: '0555987654'
        },
        metadata: {
          order_id: orderId,
          course_id: String(book.id),
          course_name: book.name,
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
      console.log('✅ CUSTOMER BOOK RECORD SAVED IN DB:', {
        serial: customer.serial_number,
        email: customer.email,
        activation_code: customer.activation_code, // Should be null!
        download_link: customer.download_link,     // Should have download URL!
        status: customer.payment_status
      });
    }

  } catch (err) {
    console.error('Test Error:', err);
  } finally {
    process.exit(0);
  }
}

testBookPurchaseFlow();
