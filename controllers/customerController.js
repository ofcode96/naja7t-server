const { Customer, Product, ActivationCode } = require('../models');
const { createChargilyCheckout, verifyChargilyWebhookSignature } = require('../config/chargily');
const { generateSuccessUrl } = require('../utils/encryption');

// GET /api/customers - جلب كافة العملاء
const getAllCustomers = async (req, res) => {
  try {
    const customers = await Customer.findAll({ order: [['createdAt', 'DESC']] });
    return res.status(200).json({ success: true, count: customers.length, data: customers });
  } catch (err) {
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
    return res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/customers - إضافة عميل يدوي
const createCustomerRecord = async (req, res) => {
  try {
    const { customer_name, phone, email, product_id, product_name, payment_method, payment_status, activation_code } = req.body;
    
    const serial_number = `CUST-${Math.floor(100000 + Math.random() * 900000)}`;

    const customer = await Customer.create({
      serial_number,
      customer_name: customer_name || 'طالب نجحت',
      phone: phone || null,
      email: email || null,
      product_id: product_id || null,
      product_name: product_name || null,
      payment_method: payment_method ? payment_method.toUpperCase() : 'PENDING',
      payment_status: payment_status || 'pending',
      activation_code: activation_code || null
    });

    return res.status(201).json({ success: true, message: 'تم إضافة العميل بنجاح', data: customer });
  } catch (err) {
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
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * معالجة الشراء والبحث المرن عن المنتج بالـ ID أو بالـ Code
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
      amount,
      paymentMethod = 'EDAHABIA', // EDAHABIA, CASH, FLEXY, RECEIPT, FREE, SADAQA, CONTEST, PENDING
      successUrl,
      failureUrl
    } = req.body;

    let finalAmount = Number(amount) > 0 ? Number(amount) : 0;
    let itemTitle = (courseTitle && courseTitle.trim()) ? courseTitle.trim() : '';
    let foundProductCode = courseId;

    // 1. البحث المرن عن المنتج في قاعدة البيانات (بالـ Primary Key ID أولاً إذا كان رقماً، أو بالـ Code)
    if (courseId) {
      let dbProduct = null;
      if (!isNaN(courseId)) {
        dbProduct = await Product.findByPk(courseId);
      }
      if (!dbProduct) {
        dbProduct = await Product.findOne({ where: { code: courseId } });
      }

      if (dbProduct) {
        if (finalAmount <= 0) {
          finalAmount = dbProduct.price; // جلب السعر الصحيح للمنتج 5 (مثلاً 2900 دج)
        }
        if (!itemTitle) {
          itemTitle = dbProduct.name; // جلب اسم المنتج الصحيح للمنتج 5
        }
        foundProductCode = dbProduct.code || dbProduct.id;
      }
    }

    // إذا لم يحدد عنوان أو مبلغ يلجأ للافتراضي
    if (finalAmount <= 0) finalAmount = 3500;
    if (!itemTitle) itemTitle = courseId ? `دورة ${courseId}` : 'دورة منصة نجحت';

    const customerName = (fullName && fullName.trim()) ? fullName.trim() : 'طالب نجحت';
    const serial_number = `CUST-${Math.floor(100000 + Math.random() * 900000)}`;
    const normalizedMethod = paymentMethod.toUpperCase();

    // 2. معالجة الحالات المجانية (FREE, SADAQA, CONTEST)
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
        customer_name: customerName,
        phone: phone || null,
        email: email || null,
        product_id: String(courseId || 'FREE-PACK'),
        product_name: itemTitle,
        payment_method: normalizedMethod,
        payment_status: 'paid',
        activation_code: codeStr
      });

      const encryptedSuccessUrl = generateSuccessUrl(successUrl, {
        orderId: serial_number,
        customerName,
        activationCode: codeStr,
        paymentMethod: normalizedMethod,
        status: 'paid'
      });

      return res.status(201).json({
        success: true,
        message: 'تم تفعيل الطلب بنجاح مجاناً!',
        redirectUrl: encryptedSuccessUrl,
        data: customer
      });
    }

    // 3. الدفع الإلكتروني عبر البطاقة الذهبية / CIB (Chargily Pay)
    let checkoutUrl = null;
    let chargilyCheckoutId = null;

    if (['EDAHABIA', 'CIB', 'CHARGILY', 'CARD'].includes(normalizedMethod)) {
      const selectedMethod = normalizedMethod === 'EDAHABIA' ? 'edahabia' : (normalizedMethod === 'CIB' ? 'cib' : null);
      
      const hostHeader = req.get('host');
      const protocol = req.protocol || 'https';
      const webhookUrl = `${protocol}://${hostHeader}/api/purchase/webhook/chargily`;

      const chargilyResult = await createChargilyCheckout({
        amount: finalAmount, // السعر الصحيح المأخوذ من المنتج رقم 5 (مثلاً 2900 دج)
        currency: 'dzd',
        title: itemTitle,    // العنوان الصحيح للمنتج رقم 5
        courseId: String(courseId || 'CR-101'),
        customerName,
        customerEmail: email || '',
        orderId: serial_number,
        successUrl,
        failureUrl,
        webhookUrl,
        paymentMethod: selectedMethod
      });

      checkoutUrl = chargilyResult.checkoutUrl;
      chargilyCheckoutId = chargilyResult.checkoutId;
    }

    // 4. حفظ الطلب في قاعدة البيانات
    const customer = await Customer.create({
      serial_number,
      customer_name: customerName,
      phone: phone || null,
      email: email || null,
      product_id: String(courseId || 'CR-101'),
      product_name: itemTitle,
      payment_method: normalizedMethod,
      payment_status: 'pending',
      chargily_checkout_id: chargilyCheckoutId,
      checkout_url: checkoutUrl
    });

    return res.status(201).json({
      success: true,
      message: checkoutUrl ? 'تم إنشاء طلب الشراء بنجاح' : 'تم تسجيل الطلب في قاعدة البيانات',
      checkoutUrl,
      data: customer
    });

  } catch (error) {
    console.error('خطأ في الشراء:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * معالجة الـ Webhook من Chargily وتعديل قاعدة البيانات
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

          console.log(`✅ تم تحديث العميل ${serial_number} إلى paid في قاعدة البيانات بنجاح!`);
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
