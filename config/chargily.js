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
 * دالة إنشاء جلسة دفع لدى Chargily Pay V2
 */
async function createChargilyCheckout({
  amount,
  currency = 'dzd',
  title = 'دورة منصة نجحت التعليمية',
  customerName,
  customerEmail,
  orderId,
  successUrl,
  failureUrl,
  webhookUrl,
  paymentMethod // 'edahabia' or 'cib' or null
}) {
  const success_url = successUrl || process.env.PAYMENT_SUCCESS_URL || 'https://naja7t.com/payment/success';
  const failure_url = failureUrl || process.env.PAYMENT_FAILURE_URL || 'https://naja7t.com/payment/failure';

  // استخدام المكتبة الحقيقية إذا تم تهيئة المفاتيح
  if (chargilyClient) {
    try {
      // 1. إنشاء المنتج Product
      const product = await chargilyClient.createProduct({
        name: title,
        description: `طلب رقم: ${orderId} - المشتري: ${customerName}`,
      });

      // 2. إنشاء السعر Price
      const price = await chargilyClient.createPrice({
        amount: Math.round(amount),
        currency: currency.toLowerCase(),
        product_id: product.id,
      });

      // 3. إنشاء جلسة الدفع Checkout
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
          customer_name: customerName,
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

  // وضع المحاكاة التلقائي عند عدم توفر المفتاح الحي بعد
  console.log('⚡ إنشاء رابط محاكاة Chargily Pay للطلب:', orderId);
  return {
    success: true,
    checkoutUrl: `https://pay.chargily.com/test/checkout/simulated-${orderId}`,
    checkoutId: `chk_simulated_${orderId}`,
    isMock: true,
    message: 'Chargily SDK running in test simulation mode. Provide CHARGILY_SECRET_KEY in .env for live gateway.'
  };
}

/**
 * دالة التحقق من التوقيع الرقمي للـ Webhook
 */
function verifyChargilyWebhookSignature(rawBody, signatureHeader) {
  if (!secretKey || secretKey.includes('your_chargily_secret_key')) {
    return true; // قبول التوقيع في وضع الاختارات المحلية
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
