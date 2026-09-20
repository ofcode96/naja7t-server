const { ChargilyClient, verifySignature } = require('@chargily/chargily-pay');
require('dotenv').config();

const secretKey = process.env.CHARGILY_SECRET_KEY || '';
const isConfigured = secretKey && !secretKey.includes('your_chargily_secret_key');

let chargilyClient = null;

// ذاكرة مؤقتة لتخزين المنتجات والأسعار وإعادة استخدامها لمنع تكرارها في Chargily Dashboard
const productCache = new Map();
const priceCache = new Map();

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
 * دالة الحصول على منتج مخزن أو إنشائه مرة واحدة فقط لدى Chargily
 */
async function getOrCreateChargilyProduct(courseId, title) {
  if (!chargilyClient) return null;

  const cacheKey = courseId || title;
  if (productCache.has(cacheKey)) {
    return productCache.get(cacheKey);
  }

  const product = await chargilyClient.createProduct({
    name: title,
    description: `دورة منصة نجحت التعليمية - ${courseId || ''}`,
  });

  productCache.set(cacheKey, product);
  return product;
}

/**
 * دالة الحصول على سعر مخزن أو إنشائه مرة واحدة فقط لدى Chargily
 */
async function getOrCreateChargilyPrice(courseId, title, amount, currency = 'dzd') {
  if (!chargilyClient) return null;

  const product = await getOrCreateChargilyProduct(courseId, title);
  const cacheKey = `${courseId || title}_${amount}_${currency.toLowerCase()}`;

  if (priceCache.has(cacheKey)) {
    return priceCache.get(cacheKey);
  }

  const price = await chargilyClient.createPrice({
    amount: Math.round(amount),
    currency: currency.toLowerCase(),
    product_id: product.id,
  });

  priceCache.set(cacheKey, price);
  return price;
}

/**
 * دالة إنشاء جلسة دفع لدى Chargily Pay V2 مع إعادة استخدام المنتجات والأسعار
 */
async function createChargilyCheckout({
  amount,
  currency = 'dzd',
  title = 'دورة منصة نجحت التعليمية',
  courseId,
  customerName,
  customerEmail,
  orderId,
  successUrl,
  failureUrl,
  webhookUrl,
  paymentMethod
}) {
  const success_url = successUrl || process.env.PAYMENT_SUCCESS_URL || 'https://naja7t.com/payment/success';
  const failure_url = failureUrl || process.env.PAYMENT_FAILURE_URL || 'https://naja7t.com/payment/failure';

  if (chargilyClient) {
    try {
      // 1. إعادة استخدام أو إنشاء السعر المربوط بالمنتج مرة واحدة فقط
      const price = await getOrCreateChargilyPrice(courseId, title, amount, currency);

      // 2. إنشاء جلسة الدفع الخفيفة (Checkout)
      const checkoutPayload = {
        items: [
          {
            price: price.id,
            quantity: 1,
          },
        ],
        success_url,
        failure_url,
        metadata: {
          order_id: orderId,
          customer_name: customerName || '',
          customer_email: customerEmail || '',
        },
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

  // وضع المحاكاة التلقائي عند الاختبار
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
  try {
    return verifySignature(rawBody, signatureHeader, secretKey);
  } catch (err) {
    console.error('خطأ في التحقق من توقيع الـ Webhook:', err.message);
    return false;
  }
}

module.exports = {
  createChargilyCheckout,
  verifyChargilyWebhookSignature,
  isChargilyConfigured: () => !!chargilyClient
};
