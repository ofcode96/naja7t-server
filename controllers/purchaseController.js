const { pool } = require('../config/db');
const { createChargilyCheckout, verifyChargilyWebhookSignature } = require('../config/chargily');

// ذاكرة مؤقتة للمحاكاة (Mock in-memory storage)
const mockOrders = new Map();

/**
 * معالجة طلب الشراء وإنشاء جلسة الدفع عبر Chargily Pay
 * POST /api/purchase/checkout
 */
const processPurchase = async (req, res) => {
  try {
    const {
      fullName,
      phone,
      email,
      courseId,
      courseTitle,
      plan,
      paymentMethod = 'EDAHABIA', // EDAHABIA, CIB, CCP, BaridiMob
      amount,
      promoCode,
      wilaya,
      successUrl,
      failureUrl
    } = req.body;

    // 1. الاعتماد المباشر للمبلغ المدخل دون تعديل تلقائي تلقائي
    const finalAmount = Number(amount) > 0 ? Number(amount) : 3500;

    // 2. تكييف بيانات الزبون (جميع الحقول اختيارية وتتحمل المرور المباشر عبر الرابط)
    const customerName = (fullName && fullName.trim()) ? fullName.trim() : 'طالب نجحت';
    const cleanPhone = phone ? phone.replace(/[\s-]/g, '') : '';
    const itemTitle = (courseTitle && courseTitle.trim())
      ? courseTitle.trim()
      : (courseId ? `دورة ${courseId}` : 'دورة منصة نجحت التعليمية');

    // 3. إنشاء رقم طلب فريد
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const orderId = `NJ-${new Date().getFullYear()}-${randomNum}`;

    let paymentInfo = {
      method: paymentMethod,
      status: 'pending_payment'
    };

    let checkoutUrl = null;

    // 4. في حالة الدفع الإلكتروني (Chargily Pay: EDAHABIA / CIB)
    const normalizedMethod = paymentMethod.toUpperCase();
    if (['EDAHABIA', 'CIB', 'CHARGILY', 'CARD'].includes(normalizedMethod)) {
      const selectedMethod = normalizedMethod === 'EDAHABIA' ? 'edahabia' : (normalizedMethod === 'CIB' ? 'cib' : null);
      
      const hostHeader = req.get('host');
      const protocol = req.protocol || 'https';
      const webhookUrl = `${protocol}://${hostHeader}/api/purchase/webhook/chargily`;

      const chargilyResult = await createChargilyCheckout({
        amount: finalAmount, // يتم تمرير 4000 دج كما أُدخلت تماماً
        currency: 'dzd',
        title: itemTitle,
        customerName,
        customerEmail: email ? email.trim() : '',
        orderId,
        successUrl,
        failureUrl,
        webhookUrl,
        paymentMethod: selectedMethod
      });

      checkoutUrl = chargilyResult.checkoutUrl;
      paymentInfo.checkoutUrl = checkoutUrl;
      paymentInfo.chargilyCheckoutId = chargilyResult.checkoutId;
      paymentInfo.instructions = {
        note: 'سيتم توجيهك الآن إلى بوابة Chargily Pay للدفع بالبطاقة الذهبية / CIB بشكل آمن.',
        checkoutUrl
      };
    } else {
      // وسائل الدفع اليدوية (بريدي موب / CCP)
      paymentInfo.instructions = {
        method: 'بريدي موب / CCP',
        ccpNumber: '0021458796 Key 45',
        rip: '00799999002145879645',
        accountHolder: 'منصة نجحت التعليمية (Naja7t Platform)',
        note: 'يرجى إرسال وصل الدفع عبر منصة التليغرام أو رفعه في صفحة تأكيد الطلب.'
      };
    }

    // 5. بناء كائن الطلب النهائي
    const orderData = {
      orderId,
      customer: {
        fullName: customerName,
        phone: cleanPhone || null,
        email: email ? email.trim() : null,
        wilaya: wilaya || null
      },
      item: {
        courseId: courseId || 'CR-101',
        courseTitle: itemTitle,
        plan: plan || 'الدورة الكاملة'
      },
      pricing: {
        amount: finalAmount,
        currency: 'DZD',
        promoCode: promoCode || null
      },
      payment: paymentInfo,
      checkoutUrl,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    mockOrders.set(orderId, orderData);

    return res.status(201).json({
      success: true,
      message: checkoutUrl
        ? 'تم إنشاء طلب الشراء بنجاح، يرجى التوجه لرابط الدفع للإتمام.'
        : 'تم تسجيل طلب الشراء بنجاح!',
      checkoutUrl,
      data: orderData
    });

  } catch (error) {
    console.error('خطأ في معالجة طلب الشراء:', error);
    return res.status(500).json({
      success: false,
      error: 'حدث خطأ أثناء الاتصال ببوابة الدفع. يرجى المحاولة لاحقاً.'
    });
  }
};

/**
 * معالجة إشعارات Webhook القادمة من Chargily Pay
 * POST /api/purchase/webhook/chargily
 */
const handleChargilyWebhook = async (req, res) => {
  try {
    const signature = req.headers['chargily-signature'];
    const rawBody = req.body;

    const isValid = verifyChargilyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.warn('⛔ توقيع Webhook غير صالح من Chargily Pay.');
      return res.status(403).json({ success: false, error: 'Signature verification failed' });
    }

    let payload;
    try {
      payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : JSON.parse(rawBody.toString('utf8'));
    } catch (e) {
      payload = req.body;
    }

    const event = payload.type || payload.event;
    const checkoutData = payload.data || payload;

    console.log(`📩 استقبال إشعار Webhook من Chargily Pay: [${event}]`);

    if (event === 'checkout.paid') {
      const orderId = checkoutData.metadata ? checkoutData.metadata.order_id : null;
      if (orderId && mockOrders.has(orderId)) {
        const order = mockOrders.get(orderId);
        order.status = 'paid';
        order.payment.status = 'paid';
        order.payment.paidAt = new Date().toISOString();
        mockOrders.set(orderId, order);
        console.log(`✅ تم تأكيد دفع الطلب رقم ${orderId} بنجاح عبر Chargily Pay!`);
      }
    } else if (event === 'checkout.failed') {
      const orderId = checkoutData.metadata ? checkoutData.metadata.order_id : null;
      if (orderId && mockOrders.has(orderId)) {
        const order = mockOrders.get(orderId);
        order.status = 'failed';
        order.payment.status = 'failed';
        mockOrders.set(orderId, order);
        console.warn(`❌ فشلت عملية الدفع للطلب رقم ${orderId}`);
      }
    }

    return res.status(200).send('Webhook Received Successfully');

  } catch (error) {
    console.error('خطأ في استلام Webhook من Chargily:', error);
    return res.status(500).send('Internal Server Error');
  }
};

/**
 * الاستعلام عن حالة طلب شراء محدد
 * GET /api/purchase/status/:orderId
 */
const getPurchaseStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'يرجى تقديم رقم الطلب (orderId).'
      });
    }

    const order = mockOrders.get(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: `لم يتم العثور على طلب بالشفرة ${orderId}.`
      });
    }

    return res.status(200).json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('خطأ في الاستعلام عن طلب الشراء:', error);
    return res.status(500).json({
      success: false,
      error: 'حدث خطأ أثناء الاستعلام عن الطلب.'
    });
  }
};

module.exports = {
  processPurchase,
  getPurchaseStatus,
  handleChargilyWebhook
};
