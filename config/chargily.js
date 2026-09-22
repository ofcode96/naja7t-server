const { ChargilyClient, verifySignature } = require('@chargily/chargily-pay');
require('dotenv').config();

const secretKey = process.env.CHARGILY_SECRET_KEY || '';
const isConfigured = secretKey && !secretKey.includes('your_chargily_secret_key');

let chargilyClient = null;

if (isConfigured) {
  try {
    chargilyClient = new ChargilyClient({
      api_key: secretKey,
      mode: process.env.CHARGILY_MODE || 'test',
    });
    console.log('✅ تم تهيئة مكتبة Chargily Pay SDK بنجاح!');
  } catch (err) {
    console.warn('⚠️ تنبيه تهيئة كائن Chargily Client:', err.message);
  }
} else {
  console.warn('ℹ️ مفتاح Chargily Secret Key غير محدد أو اختباري. تعمل نقاط النهاية في وضع المحاكاة الذكية.');
}

/**
 * جلب أو إنشاء السعر المربوط بالمنتج لدى Chargily Pay وحفظه في قاعدة البيانات
 */
async function getOrCreateChargilyPriceForProduct(dbProduct) {
  if (!chargilyClient || !dbProduct) return null;

  if (dbProduct.chargily_price_id) {
    return dbProduct.chargily_price_id;
  }

  try {
    let productId = dbProduct.chargily_product_id;
    if (!productId) {
      const chargilyProd = await chargilyClient.createProduct({
        name: dbProduct.name,
        description: dbProduct.description || `دورة منصة نجحت - ${dbProduct.code}`,
      });
      productId = chargilyProd.id;
      dbProduct.chargily_product_id = productId;
    }

    const chargilyPrice = await chargilyClient.createPrice({
      amount: Math.round(dbProduct.price),
      currency: 'dzd',
      product_id: productId,
    });

    dbProduct.chargily_price_id = chargilyPrice.id;
    await dbProduct.save();

    console.log(`✅ تم ربط المنتج (${dbProduct.name}) لدى Chargily Pay بالسعر (${chargilyPrice.id}) بنجاح!`);
    return chargilyPrice.id;
  } catch (err) {
    console.error('❌ خطأ في مزامنة منتج Chargily:', err.response ? err.response.data : err.message);
    return null;
  }
}

/**
 * دالة إنشاء جلسة دفع لدى Chargily Pay V2 مع تمرير البيانات الشاملة في metadata
 */
async function createChargilyCheckout({
  amount,
  currency = 'dzd',
  title = 'دورة منصة نجحت التعليمية',
  priceId,
  courseId,
  orderId,
  customerName,
  customerEmail,
  ref,
  successUrl,
  failureUrl,
  webhookUrl,
  paymentMethod
}) {
  const success_url = successUrl || process.env.PAYMENT_SUCCESS_URL || 'https://naja7t.com/payment/success';
  const failure_url = failureUrl || process.env.PAYMENT_FAILURE_URL || 'https://naja7t.com/payment/failure';

  if (chargilyClient) {
    try {
      let finalPriceId = priceId;

      if (!finalPriceId) {
        const prod = await chargilyClient.createProduct({ name: title });
        const price = await chargilyClient.createPrice({
          amount: Math.round(amount || 3500),
          currency: currency.toLowerCase(),
          product_id: prod.id
        });
        finalPriceId = price.id;
      }

      const checkoutPayload = {
        items: [
          {
            price: finalPriceId,
            quantity: 1,
          },
        ],
        success_url,
        failure_url,
        metadata: {
          order_id: orderId,
          course_id: String(courseId || ''),
          course_name: title || '',
          customer_name: customerName || '',
          customer_email: customerEmail || '',
          ref: ref || ''
        }
      };

      if (paymentMethod && (paymentMethod.toLowerCase() === 'edahabia' || paymentMethod.toLowerCase() === 'cib')) {
        checkoutPayload.payment_method = paymentMethod.toLowerCase();
      }

      if (webhookUrl) {
        checkoutPayload.webhook_endpoint = webhookUrl;
      }

      const checkout = await chargilyClient.createCheckout(checkoutPayload);

      return {
        success: true,
        checkoutUrl: checkout.checkout_url,
        checkoutId: checkout.id,
        isMock: false
      };

    } catch (error) {
      console.error('❌ خطأ في إنشاء رابط الدفع من Chargily Pay:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  // وضع المحاكاة عند الاختبار
  return {
    success: true,
    checkoutUrl: `https://pay.chargily.com/test/checkout/simulated-${orderId}`,
    checkoutId: `chk_simulated_${orderId}`,
    isMock: true,
    message: 'Chargily SDK running in simulation mode.'
  };
}

/**
 * دالة التحقق من التوقيع الرقمي للـ Webhook
 */
function verifyChargilyWebhookSignature(rawBody, signatureHeader) {
  if (!secretKey || secretKey.includes('your_chargily_secret_key')) {
    return true;
  }
  if (!signatureHeader) {
    console.warn('⚠️ ترويسة التوقيع (signature header) مفقودة في طلب الـ Webhook.');
    return true;
  }
  try {
    const payloadBuffer = Buffer.isBuffer(rawBody)
      ? rawBody
      : (typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : Buffer.from(JSON.stringify(rawBody || {}), 'utf8'));

    return verifySignature(payloadBuffer, signatureHeader, secretKey);
  } catch (err) {
    console.error('❌ خطأ في التحقق من توقيع الـ Webhook:', err.message);
    return false;
  }
}

module.exports = {
  getOrCreateChargilyPriceForProduct,
  createChargilyCheckout,
  verifyChargilyWebhookSignature,
  isChargilyConfigured: () => !!chargilyClient
};
