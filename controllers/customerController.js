const { Customer, Product, ActivationCode } = require('../models');
const { Op } = require('sequelize');
const crypto = require('crypto');
const {
  createChargilyCheckout,
  getOrCreateChargilyPriceForProduct,
  getChargilyCustomer,
  verifyChargilyWebhookSignature
} = require('../config/chargily');
const { generateSuccessUrl } = require('../utils/encryption');

/**
 * دالة مساعدة لاختيار وتخصيص كود تفعيل واحد فقط غير مستعمل وغير منتهي الصلاحية للزبون
 */
const assignValidActivationCode = async (serial_number, product_id) => {
  const now = new Date();

  // جلب الأكواد غير المستعملة المخصصة للمنتج أو الأكواد العامة
  const candidateCodes = await ActivationCode.findAll({
    where: {
      status: 'unused',
      [Op.or]: [
        { product_id: null },
        { product_id: String(product_id || '') }
      ]
    },
    order: [['id', 'ASC']]
  });

  let validCode = null;

  for (const actCode of candidateCodes) {
    if (actCode.expires_at && new Date(actCode.expires_at) < now) {
      actCode.status = 'expired';
      await actCode.save();
    } else {
      validCode = actCode;
      break;
    }
  }

  let codeStr = '';
  if (validCode) {
    validCode.status = 'used';
    validCode.used_by_customer_id = serial_number;
    validCode.used_at = now;
    await validCode.save();
    codeStr = validCode.code;
  } else {
    // توليد كود تفعيل صالح فريد تلقائياً عند عدم توفر أكواد مسبقة
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    codeStr = `NJ-${randomHex.slice(0, 4)}-${randomHex.slice(4)}`;
    await ActivationCode.create({
      code: codeStr,
      status: 'used',
      product_id: product_id ? String(product_id) : null,
      used_by_customer_id: serial_number,
      used_at: now
    });
  }

  return codeStr;
};

// GET /api/customers - جلب كافة العملاء المسجلين والمدفوعين
const getAllCustomers = async (req, res) => {
  try {
    const customers = await Customer.findAll({ order: [['id', 'DESC']] });
    return res.status(200).json({ success: true, count: customers.length, data: customers });
  } catch (err) {
    console.error('Error in getAllCustomers:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/customers/:id - جلب عميل محدد
const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = isNaN(id)
      ? await Customer.findOne({ where: { serial_number: id } })
      : await Customer.findByPk(id);

    if (!customer) {
      return res.status(404).json({ success: false, error: 'العميل غير موجود' });
    }
    return res.status(200).json({ success: true, data: customer });
  } catch (err) {
    console.error('Error in getCustomerById:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/customers - إضافة عميل يدوي
const createCustomerRecord = async (req, res) => {
  try {
    const { customer_name, phone, email, ref, product_id, product_name, payment_method, payment_status, activation_code } = req.body;
    
    const serial_number = `CUST-${Math.floor(100000 + Math.random() * 900000)}`;

    const customer = await Customer.create({
      serial_number,
      customer_name: customer_name || 'طالب نجحت',
      phone: phone || null,
      email: email || null,
      ref: ref || null,
      product_id: product_id || null,
      product_name: product_name || null,
      payment_method: payment_method ? payment_method.toUpperCase() : 'CASH',
      payment_status: payment_status || 'paid',
      activation_code: activation_code || null
    });

    return res.status(201).json({ success: true, message: 'تم إضافة العميل بنجاح', data: customer });
  } catch (err) {
    console.error('Error in createCustomerRecord:', err);
    return res.status(400).json({ success: false, error: err.message });
  }
};

// PUT /api/customers/:id - تحديث عميل
const updateCustomerRecord = async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'العميل غير موجود' });
    }
    await customer.update(req.body);
    return res.status(200).json({ success: true, message: 'تم تحديث العميل بنجاح', data: customer });
  } catch (err) {
    console.error('Error in updateCustomerRecord:', err);
    return res.status(400).json({ success: false, error: err.message });
  }
};

// DELETE /api/customers/:id - حذف عميل
const deleteCustomerRecord = async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'العميل غير موجود' });
    }
    await customer.destroy();
    return res.status(200).json({ success: true, message: 'تم حذف العميل بنجاح' });
  } catch (err) {
    console.error('Error in deleteCustomerRecord:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * إنشاء رابط الشراء فقط دون حفظ أي صفوف معلقة (Pending) في قاعدة البيانات
 * POST /api/purchase/checkout
 */
const processPurchase = async (req, res) => {
  try {
    const {
      courseId,
      fullName,
      customerName,
      phone,
      email,
      ref,
      referral,
      paymentMethod = 'EDAHABIA',
      successUrl,
      failureUrl
    } = req.body;

    if (!courseId) {
      return res.status(400).json({ success: false, error: 'يرجى تحديد معرف المنتج (courseId)' });
    }

    // 1. البحث عن المنتج في قاعدة البيانات بالـ ID أو الـ Code
    let dbProduct = null;
    if (!isNaN(courseId)) {
      dbProduct = await Product.findByPk(courseId);
    }
    if (!dbProduct) {
      dbProduct = await Product.findOne({ where: { code: courseId } });
    }

    if (!dbProduct) {
      return res.status(404).json({ success: false, error: `المنتج رقم (${courseId}) غير موجود في قاعدة البيانات` });
    }

    const serial_number = `CUST-${Math.floor(100000 + Math.random() * 900000)}`;
    const normalizedMethod = paymentMethod.toUpperCase();

    const actualName = (fullName || customerName || '').trim();
    const actualPhone = phone ? String(phone).trim() : '';
    const actualEmail = email ? String(email).trim() : '';
    const actualRef = ref || referral || '';

    // 2. معالجة الحالات المجانية فورياً (FREE, SADAQA, CONTEST)
    if (['FREE', 'SADAQA', 'CONTEST'].includes(normalizedMethod)) {
      const codeStr = await assignValidActivationCode(serial_number, dbProduct.id);

      const customer = await Customer.create({
        serial_number,
        customer_name: actualName || 'طالب نجحت',
        phone: actualPhone || null,
        email: actualEmail || null,
        ref: actualRef || null,
        product_id: String(dbProduct.id),
        product_name: dbProduct.name,
        payment_method: normalizedMethod,
        payment_status: 'paid',
        activation_code: codeStr
      });

      const message = `تم تفعيل الطلب بنجاح! سيريال العميل: ${serial_number} | كود التفعيل: ${codeStr}`;

      const encryptedSuccessUrl = generateSuccessUrl(successUrl, {
        orderId: serial_number,
        serialNumber: serial_number,
        customerName: customer.customer_name,
        activationCode: codeStr,
        paymentMethod: normalizedMethod,
        ref: actualRef,
        status: 'paid',
        message
      });

      return res.status(201).json({
        success: true,
        message,
        serialNumber: serial_number,
        activationCode: codeStr,
        redirectUrl: encryptedSuccessUrl,
        data: customer
      });
    }

    // 3. توليد رابط Chargily Pay دون إنشاء أي سجل في قاعدة البيانات في هذه المرحلة
    const priceId = await getOrCreateChargilyPriceForProduct(dbProduct);

    const hostHeader = req.get('host');
    const protocol = req.protocol || 'https';
    const webhookUrl = `${protocol}://${hostHeader}/api/purchase/webhook/chargily`;

    const chargilyResult = await createChargilyCheckout({
      amount: dbProduct.price,
      currency: 'dzd',
      title: dbProduct.name,
      priceId,
      orderId: serial_number,
      customerName: actualName,
      customerEmail: actualEmail,
      customerPhone: actualPhone,
      ref: actualRef,
      successUrl,
      failureUrl,
      webhookUrl,
      paymentMethod: normalizedMethod === 'EDAHABIA' ? 'edahabia' : (normalizedMethod === 'CIB' ? 'cib' : null)
    });

    return res.status(201).json({
      success: true,
      message: 'تم إنشاء رابط الدفع بنجاح.',
      checkoutUrl: chargilyResult.checkoutUrl,
      serialNumber: serial_number
    });

  } catch (error) {
    console.error('خطأ في الشراء:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * معالجة الـ Webhook من Chargily: إنشاء وتخزين سجل المشتري الفعلي وتأكيده في قاعدة البيانات عند الدفع فقط
 * POST /api/purchase/webhook/chargily
 */
const handleChargilyWebhook = async (req, res) => {
  try {
    const signature = req.headers['chargily-signature'] || req.headers['signature'] || req.headers['x-chargily-signature'];
    const rawBody = req.rawBody || req.body;

    const isValid = verifyChargilyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.warn('⛔ توقيع Webhook غير صالح.');
      return res.status(403).json({ success: false, error: 'Signature verification failed' });
    }

    let payload;
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      payload = req.body;
    } else if (Buffer.isBuffer(rawBody)) {
      payload = JSON.parse(rawBody.toString('utf8'));
    } else if (typeof rawBody === 'string') {
      payload = JSON.parse(rawBody);
    } else {
      payload = req.body || {};
    }

    const event = payload.type || payload.event;
    const checkoutData = payload.data || payload;

    console.log(`📩 استقبال إشعار Webhook من Chargily Pay: [${event}]`);

    if (event === 'checkout.paid' || event === 'invoice.paid') {
      const meta = checkoutData.metadata || (checkoutData.checkout && checkoutData.checkout.metadata) || {};
      let chargilyCust = checkoutData.customer || (checkoutData.checkout && checkoutData.checkout.customer) || {};

      // محاولة جلب العميل مباشرة من Chargily API إذا تم توفير customer_id
      const customerId = checkoutData.customer_id || (checkoutData.checkout && checkoutData.checkout.customer_id);
      if (customerId && (!chargilyCust.name && !chargilyCust.email && !chargilyCust.phone)) {
        try {
          const apiCust = await getChargilyCustomer(customerId);
          if (apiCust) chargilyCust = apiCust;
        } catch (e) {
          console.warn('⚠️ تعذر جلب العميل من Chargily API:', e.message);
        }
      }

      const serial_number = meta.order_id || `CUST-${Math.floor(100000 + Math.random() * 900000)}`;
      const courseId = meta.course_id || null;
      const courseName = meta.course_name || null;
      const refCode = meta.ref || null;

      // استخراج بيانات المشتري الفعلي الواردة في الـ Webhook من Chargily أو الـ Metadata
      const finalName = (chargilyCust.name || chargilyCust.full_name || meta.customer_name || meta.fullName || '').trim() || 'طالب نجحت';
      const finalEmail = (chargilyCust.email || meta.customer_email || meta.email || '').trim() || null;
      const finalPhone = (chargilyCust.phone || chargilyCust.mobile || meta.customer_phone || meta.phone || '').trim() || null;

      const rawPaymentMethod = checkoutData.payment_method || (checkoutData.checkout && checkoutData.checkout.payment_method) || 'EDAHABIA';
      const paymentMethod = String(rawPaymentMethod).toUpperCase();

      // فحص إن كان السجل موجوداً أو إنشائه فورياً عند الدفع الفعلي
      let customer = await Customer.findOne({ where: { serial_number } });
      
      if (!customer) {
        // إنشاء سجل المشتري الحقيقي فقط عند نجاح عملية الدفع
        customer = await Customer.create({
          serial_number,
          customer_name: finalName,
          phone: finalPhone,
          email: finalEmail,
          ref: refCode,
          product_id: courseId ? String(courseId) : null,
          product_name: courseName || null,
          payment_method: paymentMethod,
          payment_status: 'paid'
        });
      } else {
        customer.customer_name = finalName;
        if (finalEmail) customer.email = finalEmail;
        if (finalPhone) customer.phone = finalPhone;
        if (refCode) customer.ref = refCode;
        customer.payment_method = paymentMethod;
        customer.payment_status = 'paid';
      }

      // تخصيص كود تفعيل واحد فقط غير مستعمل وغير منتهي الصلاحية
      const codeStr = await assignValidActivationCode(serial_number, courseId);
      customer.activation_code = codeStr;
      await customer.save();

      const successMessage = `تم تأكيد عملية الشراء بنجاح! سيريال العميل: ${customer.serial_number} | كود التفعيل: ${codeStr}`;

      console.log(`✅ [Webhook Paid] تم تسجيل المشتري الفعلي (${customer.customer_name}) برقم سيريال (${serial_number}) وتأكيده بكود تفعيل (${codeStr}) بنجاح!`);

      return res.status(200).json({
        success: true,
        message: 'تم استقبال ومعالجة إشعار الدفع وتعيين كود التفعيل بنجاح.',
        data: {
          serialNumber: customer.serial_number,
          activationCode: customer.activation_code,
          customerName: customer.customer_name,
          paymentStatus: customer.payment_status,
          message: successMessage
        }
      });
    }

    return res.status(200).send('Webhook Processed Successfully');

  } catch (error) {
    console.error('❌ خطأ في معالجة الـ Webhook:', error);
    return res.status(500).send('Internal Server Error');
  }
};

module.exports = {
  getAllCustomers,
  getCustomerById,
  createCustomerRecord,
  updateCustomerRecord,
  deleteCustomerRecord,
  processPurchase,
  handleChargilyWebhook
};
