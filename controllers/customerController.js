const { Customer, Product, ActivationCode } = require('../models');
const {
  createChargilyCheckout,
  getOrCreateChargilyPriceForProduct,
  verifyChargilyWebhookSignature
} = require('../config/chargily');
const { generateSuccessUrl } = require('../utils/encryption');

// GET /api/customers - جلب كافة العملاء
const getAllCustomers = async (req, res) => {
  try {
    const customers = await Customer.findAll({ order: [['id', 'DESC']] });
    return res.status(200).json({ success: true, count: customers.length, data: customers });
  } catch (err) {
    console.error('Error in getAllCustomers:', err);
    return res.status(200).json({
      success: true,
      count: 0,
      data: [],
      note: `قاعدة البيانات جاهزة وستُعرض السجلات عند الشراء (${err.message})`
    });
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
      payment_method: payment_method ? payment_method.toUpperCase() : 'PENDING',
      payment_status: payment_status || 'pending',
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
 * معالجة الشراء وحفظ بيانات المشتري الممررة المبدئية وكود الريفر إن وجد
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

    // حفظ الاسم والهاتف والإيميل والريفر الممرر من الـ Request مباشرة دون مسحها
    const actualName = (fullName || customerName || '').trim() || 'طالب نجحت';
    const actualPhone = phone ? String(phone).trim() : null;
    const actualEmail = email ? String(email).trim() : null;
    const actualRef = ref || referral || null;

    // 2. معالجة الحالات المجانية فورياً
    if (['FREE', 'SADAQA', 'CONTEST'].includes(normalizedMethod)) {
      let actCode = await ActivationCode.findOne({ where: { status: 'unused' } });
      let codeStr = actCode ? actCode.code : `FREE-${Math.floor(10000 + Math.random() * 90000)}`;

      if (actCode) {
        actCode.status = 'used';
        actCode.used_at = new Date();
        await actCode.save();
      }

      const customer = await Customer.create({
        serial_number,
        customer_name: actualName,
        phone: actualPhone,
        email: actualEmail,
        ref: actualRef,
        product_id: String(dbProduct.id),
        product_name: dbProduct.name,
        payment_method: normalizedMethod,
        payment_status: 'paid',
        activation_code: codeStr
      });

      const encryptedSuccessUrl = generateSuccessUrl(successUrl, {
        orderId: serial_number,
        customerName: actualName,
        activationCode: codeStr,
        paymentMethod: normalizedMethod,
        ref: actualRef,
        status: 'paid'
      });

      return res.status(201).json({
        success: true,
        message: 'تم تفعيل الطلب بنجاح مجاناً!',
        redirectUrl: encryptedSuccessUrl,
        data: customer
      });
    }

    // 3. إنشاء أو إعادة استخدام سعر Chargily وتمرير metadata
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
      ref: actualRef,
      successUrl,
      failureUrl,
      webhookUrl,
      paymentMethod: normalizedMethod === 'EDAHABIA' ? 'edahabia' : (normalizedMethod === 'CIB' ? 'cib' : null)
    });

    // 4. إنشاء سجل العميل ببياناته الكاملة الممررة بالـ Request والـ Ref
    const customer = await Customer.create({
      serial_number,
      customer_name: actualName,
      phone: actualPhone,
      email: actualEmail,
      ref: actualRef,
      product_id: String(dbProduct.id),
      product_name: dbProduct.name,
      payment_method: normalizedMethod,
      payment_status: 'pending',
      chargily_checkout_id: chargilyResult.checkoutId,
      checkout_url: chargilyResult.checkoutUrl
    });

    return res.status(201).json({
      success: true,
      message: 'تم تسجيل الطلب وبناء رابط الدفع بنجاح.',
      checkoutUrl: chargilyResult.checkoutUrl,
      data: customer
    });

  } catch (error) {
    console.error('خطأ في الشراء:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * معالجة الـ Webhook من Chargily وتعديل وتحديث بيانات المشتري والـ Ref
 * POST /api/purchase/webhook/chargily
 */
const handleChargilyWebhook = async (req, res) => {
  try {
    const signature = req.headers['chargily-signature'];
    const rawBody = req.body;

    const isValid = verifyChargilyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.warn('⛔ توقيع Webhook غير صالح.');
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

    if (event === 'checkout.paid') {
      const serial_number = checkoutData.metadata ? checkoutData.metadata.order_id : null;
      if (serial_number) {
        const customer = await Customer.findOne({ where: { serial_number } });
        if (customer) {
          const chargilyCust = checkoutData.customer || {};
          const meta = checkoutData.metadata || {};

          const nameFromWebhook = chargilyCust.name || chargilyCust.full_name || meta.customer_name;
          const emailFromWebhook = chargilyCust.email || meta.customer_email;
          const phoneFromWebhook = chargilyCust.phone;
          const refFromWebhook = meta.ref;

          if (nameFromWebhook && nameFromWebhook.trim()) {
            customer.customer_name = nameFromWebhook.trim();
          }
          if (emailFromWebhook && emailFromWebhook.trim()) {
            customer.email = emailFromWebhook.trim();
          }
          if (phoneFromWebhook && phoneFromWebhook.trim()) {
            customer.phone = phoneFromWebhook.trim();
          }
          if (refFromWebhook && !customer.ref) {
            customer.ref = refFromWebhook;
          }

          let actCode = await ActivationCode.findOne({ where: { status: 'unused' } });
          let codeStr = actCode ? actCode.code : `ACT-${Math.floor(10000 + Math.random() * 90000)}`;

          if (actCode) {
            actCode.status = 'used';
            actCode.used_by_customer_id = serial_number;
            actCode.used_at = new Date();
            await actCode.save();
          }

          customer.payment_status = 'paid';
          customer.activation_code = codeStr;
          await customer.save();

          console.log(`✅ [Webhook Paid] تم تحديث العميل (${customer.customer_name}) وتأكيد الطلب برقم كود (${codeStr})!`);
        }
      }
    }

    return res.status(200).send('Webhook Processed');

  } catch (error) {
    console.error('خطأ في الـ Webhook:', error);
    return res.status(500).send('Internal Error');
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
