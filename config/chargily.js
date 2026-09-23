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
 * مزامنة المنتج وسعره مع Chargily Pay لمرة واحدة بدون أي تكرار:
 * 1. ينشئ المنتج في Chargily Pay مرة واحدة فقط ويحفظ chargily_product_id
 * 2. ينشئ السعر المطلوب تحت نفس المنتج ويحفظ chargily_price_id
 * 3. في حال تحديث السعر، ينشئ سعراً جديداً تحت نفس المنتج دون تكرار إنشاء المنتج
 */
async function syncProductWithChargily(dbProduct, forceNewPrice = false) {
  if (!chargilyClient || !dbProduct) return null;

  try {
    let productId = dbProduct.chargily_product_id;

    // 1. إنشاء المنتج في Chargily Pay لمرة واحدة فقط
    if (!productId) {
      console.log(`⏳ جاري تسجيل المنتج (${dbProduct.name}) في Chargily Pay لأول مرة...`);
      const chargilyProd = await chargilyClient.createProduct({
        name: dbProduct.name,
        description: dbProduct.description || `${dbProduct.type === 'book' ? 'كتاب' : 'دورة'} منصة نجحت - ${dbProduct.code}`,
      });
      productId = chargilyProd.id;
      dbProduct.chargily_product_id = productId;
      await dbProduct.save();
      console.log(`✅ تم تسجيل المنتج في Chargily Pay بنجاح! ID: ${productId}`);
    }

    // 2. إذا كان السعر مسجلاً بالفعل ولم يتغير السعر، نستخدم السعر الحالي
    if (dbProduct.chargily_price_id && !forceNewPrice) {
      return dbProduct.chargily_price_id;
    }

    // 3. إنشاء السعر تحت نفس المنتج (دون إنشاء منتج جديد إطلاقاً)
    console.log(`⏳ جاري إنشاء سعر (${Math.round(dbProduct.price)} دج) للمنتج (${productId}) في Chargily Pay...`);
    const chargilyPrice = await chargilyClient.createPrice({
      amount: Math.round(dbProduct.price),
      currency: 'dzd',
      product_id: productId,
    });

    dbProduct.chargily_price_id = chargilyPrice.id;
    await dbProduct.save();

    console.log(`✅ تم ربط السعر (${chargilyPrice.id}) بالمنتج (${dbProduct.name}) في Chargily Pay بنجاح!`);
    return chargilyPrice.id;

  } catch (err) {
    console.error('❌ خطأ في مزامنة منتج Chargily:', err.response ? err.response.data : err.message);
    return dbProduct.chargily_price_id || null;
  }
}

/**
 * دالة إنشاء جلسة دفع لدى Chargily Pay V2 باستخدام السعر المربوط بالمنتج مباشرة
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
  customerPhone,
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
      if (!priceId) {
        throw new Error(`تعذر بدء عملية الشراء: لا يوجد سعر مسجل لهذا المنتج لدى Chargily Pay (${title})`);
      }

      const checkoutPayload = {
        items: [
          {
            price: priceId,
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
          customer_phone: customerPhone || '',
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
 * جلب بيانات العميل المباشرة من Chargily Pay بواسطة customer_id
 */
async function getChargilyCustomer(customerId) {
  if (!chargilyClient || !customerId) return null;
  try {
    return await chargilyClient.getCustomer(customerId);
  } catch (err) {
    console.error('❌ خطأ في جلب بيانات العميل من Chargily API:', err.message);
    return null;
  }
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
  syncProductWithChargily,
  getOrCreateChargilyPriceForProduct: syncProductWithChargily,
  createChargilyCheckout,
  getChargilyCustomer,
  verifyChargilyWebhookSignature,
  isChargilyConfigured: () => !!chargilyClient,
  chargilyClient
};
