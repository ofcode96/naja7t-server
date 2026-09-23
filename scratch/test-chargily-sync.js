const { Product } = require('../models');
const { initDatabase } = require('../config/db');
const { syncProductWithChargily, createChargilyCheckout } = require('../config/chargily');

async function testChargilySync() {
  await initDatabase();
  console.log('--- 1. DB Initialized ---');

  // 1. Create a product in our DB
  const prod = await Product.create({
    code: 'SYNC-TEST-' + Date.now(),
    name: 'دورة اختبار مزامنة شارجيلي',
    price: 3500,
    type: 'course'
  });
  console.log('--- 2. Product Created in DB:', prod.id, prod.name);

  // 2. Sync with Chargily Pay
  const priceId1 = await syncProductWithChargily(prod);
  console.log('--- 3. First Sync -> Product ID:', prod.chargily_product_id, 'Price ID:', prod.chargily_price_id);

  // 3. Second Sync (Simulating another checkout request)
  const priceId2 = await syncProductWithChargily(prod);
  console.log('--- 4. Second Sync -> Reused Price ID:', priceId2);

  if (priceId1 === priceId2) {
    console.log('✅ نجاح: تم إعادة استخدام نفس السعر ونفس المنتج تماماً دون تكرار الإنشاء في Chargily Pay!');
  } else {
    console.error('❌ خطأ: تم إنشاء سعر مختلف دون داعٍ!');
  }

  // 4. Test Checkout creation
  const checkoutResult = await createChargilyCheckout({
    amount: prod.price,
    title: prod.name,
    priceId: prod.chargily_price_id,
    orderId: 'CUST-TEST-123456'
  });
  console.log('--- 5. Checkout Created Successfully:', checkoutResult.checkoutUrl);

  process.exit(0);
}

testChargilySync();
