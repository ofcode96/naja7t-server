const { pool } = require('../config/db');

// ذاكرة مؤقتة للمحاكاة (Mock in-memory storage) في حال عدم وجود قاعدة بيانات حية
const mockOrders = new Map();

/**
 * معالجة طلب الشراء (محاكاة صفحة الشراء / Checkout Mock)
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
      paymentMethod = 'BaridiMob',
      amount,
      promoCode,
      wilaya
    } = req.body;

    // 1. التحقق من البيانات الأساسية Required Fields Validation
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

    // فحص صيغة رقم الهاتف الجزائري البسيطة
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

    // 2. حساب السعر والخصومات
    let baseAmount = Number(amount) || 3500; // مبلغ افتراضي بالدينار
    let discount = 0;
    let appliedPromo = null;

    if (promoCode) {
      const codeUpper = promoCode.trim().toUpperCase();
      if (codeUpper === 'NAJA7T10' || codeUpper === 'BAC2026') {
        discount = Math.round(baseAmount * 0.10); // خصم 10%
        appliedPromo = { code: codeUpper, discountPercent: 10 };
      } else if (codeUpper === 'EXCELLENCE20') {
        discount = Math.round(baseAmount * 0.20); // خصم 20%
        appliedPromo = { code: codeUpper, discountPercent: 20 };
      }
    }

    const finalAmount = Math.max(0, baseAmount - discount);

    // 3. إنشاء رقم طلب محاكى
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const orderId = `NJ-${new Date().getFullYear()}-${randomNum}`;

    // 4. إعداد تعليمات الدفع حسب طريقة الدفع
    let paymentInstructions = {};
    switch (paymentMethod.toUpperCase()) {
      case 'BARIDIMOB':
      case 'CCP':
        paymentInstructions = {
          method: 'بريدي موب / CCP',
          ccpNumber: '0021458796 Key 45',
          rip: '00799999002145879645',
          accountHolder: 'منصة نجحت التعليمية (Naja7t Platform)',
          note: 'يرجى إرسال وصل الدفع عبر منصة التليغرام أو رفعه في صفحة تأكيد الطلب مرفقاً برقم الطلب.'
        };
        break;
      case 'CEDB':
      case 'EDAHABIA':
        paymentInstructions = {
          method: 'البطاقة الذهبية / CEDB',
          gatewayUrl: `https://mock-pay.naja7t.dz/checkout?order=${orderId}`,
          note: 'سيتم توجيهك لبوابة الدفع الإلكتروني الآمنة بالبطاقة الذهبية.'
        };
        break;
      default:
        paymentInstructions = {
          method: paymentMethod,
          note: 'تواصل مع فريق الدعم الفني لتأكيد طريقة الدفع المختارة.'
        };
    }

    // 5. بناء كائن الطلب
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
        courseTitle: courseTitle || 'الدورة الشاملة للتحضير لشهادة البكالوريا',
        plan
      },
      pricing: {
        originalAmount: baseAmount,
        discount,
        finalAmount,
        currency: 'DZD',
        promoApplied: appliedPromo
      },
      payment: {
        method: paymentMethod,
        instructions: paymentInstructions,
        status: 'pending_payment' // pending_payment, confirmed, cancelled
      },
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    // حفظ الطلب في الذاكرة المؤقتة المحاكاة
    mockOrders.set(orderId, orderData);

    // محاولة الحفظ في قاعدة البيانات لو كانت متصلة (اختياري دون تسبب في خطأ)
    try {
      // قد نقوم بإدخال الطلب في جدول orders لاحقاً
    } catch (dbErr) {
      console.warn('DB Save skipped:', dbErr.message);
    }

    // 6. إرجاع الاستجابة بنجاح
    return res.status(201).json({
      success: true,
      message: 'تم تسجيل طلب الشراء بنجاح! يرجى إتمام عملية الدفع وفق التعليمات المرفقة.',
      data: orderData
    });

  } catch (error) {
    console.error('خطأ في معالجة طلب الشراء:', error);
    return res.status(500).json({
      success: false,
      error: 'حدث خطأ غير متوقع أثناء معالجة طلب الشراء. يرجى المحاولة لاحقاً.'
    });
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
  getPurchaseStatus
};
