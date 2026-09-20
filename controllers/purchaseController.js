const { pool } = require('../config/db');
const { createChargilyCheckout, verifyChargilyWebhookSignature } = require('../config/chargily');

// ذاكرة مؤقتة للمحاكاة (Mock in-memory storage) في حال عدم وجود قاعدة بيانات حية
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
      plan = 'الدورة الكاملة',
      paymentMethod = 'EDAHABIA', // EDAHABIA, CIB, CCP, BaridiMob
      amount,
      promoCode,
      wilaya,
      successUrl,
      failureUrl
    } = req.body;

    // 1. التحقق من البيانات الأساسية
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({
        success: false,
        error: 'يرجى إدخال الاسم الكامل.'
      });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({
        success: false,
        error: 'يرجى إدخال رقم الهاتف.'
      });
    }

    const cleanPhone = phone.replace(/[\s-]/g, '');
    const phoneRegex = /^(05|06|07|021|023|024|025|026|027|029|031|032|033|034|035|036|037|038|041|043|045|046|048|049)[0-9]{8}$/;
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        error: 'رقم الهاتف غير صحيح. يرجى إدخال رقم هاتف جزائري مكون من 10 أرقام.'
      });
    }

    if (!courseId && !courseTitle) {
      return res.status(400).json({
        success: false,
        error: 'يرجى تحديد الدورة أو المادة المراد شؤاؤها.'
      });
    }

    // 2. حساب المبلغ النهائي والخصومات
    let baseAmount = Number(amount) || 3500;
    let discount = 0;
    let appliedPromo = null;

    if (promoCode) {
      const codeUpper = promoCode.trim().toUpperCase();
      if (codeUpper === 'NAJA7T10' || codeUpper === 'BAC2026') {
        discount = Math.round(baseAmount * 0.10);
        appliedPromo = { code: codeUpper, discountPercent: 10 };
      } else if (codeUpper === 'EXCELLENCE20') {
        discount = Math.round(baseAmount * 0.20);
        appliedPromo = { code: codeUpper, discountPercent: 20 };
      }
    }

    const finalAmount = Math.max(10, baseAmount - discount); // الحد الأدنى للمبلغ هو 10 دج

    // 3. إنشاء رقم طلب فريد
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const orderId = `NJ-${new Date().getFullYear()}-${randomNum}`;

    let paymentInfo = {
      method: paymentMethod,
      status: 'pending_payment'
    };

    let checkoutUrl = null;

    // 4. في حالة الدفع عبر البطاقة الذهبية أو CIB أو Chargily Pay
    const normalizedMethod = paymentMethod.toUpperCase();
    if (['EDAHABIA', 'CIB', 'CHARGILY', 'CARD'].includes(normalizedMethod)) {
      const selectedMethod = normalizedMethod === 'EDAHABIA' ? 'edahabia' : (normalizedMethod === 'CIB' ? 'cib' : null);
      
      const hostHeader = req.get('host');
      const protocol = req.protocol || 'https';
      const webhookUrl = `${protocol}://${hostHeader}/api/purchase/webhook/chargily`;

      const chargilyResult = await createChargilyCheckout({
        amount: finalAmount,
        currency: 'dzd',
        title: courseTitle || 'دورة منصة نجحت التعليمية',
        customerName: fullName.trim(),
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

    // 5. بناء وتخزين بيانات الطلب
    const orderData = {
      orderId,
      customer: {
        fullName: fullName.trim(),
        phone: cleanPhone,
        email: email ? email.trim() : null,
        wilaya: wilaya || 'غير محدد'
      },
      item: {
        courseId: courseId || 'CR-101',
        courseTitle: courseTitle || 'الدورة الشاملة منصة نجحت',
        plan
      },
      pricing: {
        originalAmount: baseAmount,
        discount,
        finalAmount,
        currency: 'DZD',
        promoApplied: appliedPromo
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
        : 'تم تسجيل طلب الشراء بنجاح! يرجى إتمام عملية الدفع وفق التعليمات.',
      checkoutUrl,
      data: orderData
    });

  } catch (error) {
    console.error('خطأ في معالجة طلب الشراء عبر Chargily:', error);
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
    const rawBody = req.body; // Buffer or raw body

    // 1. التحقق التوقيع الرقمي
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

    // 2. تحديث حالة الطلب بناءً على نوع الحدث
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
