const { Product, Customer } = require('../models');
const path = require('path');
const fs = require('fs');

// GET /api/products - جلب كافة المنتجات
const getAllProducts = async (req, res) => {
  try {
    const products = await Product.findAll({ order: [['id', 'DESC']] });
    return res.status(200).json({ success: true, count: products.length, data: products });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/products/:id - جلب منتج محدد
const getProductById = async (req, res) => {
  try {
    const product = isNaN(req.params.id)
      ? await Product.findOne({ where: { code: req.params.id } })
      : await Product.findByPk(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, error: 'المنتج غير موجود' });
    }
    return res.status(200).json({ success: true, data: product });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/products - إضافة منتج جديد (دورة أو كتاب رقمي)
const createProduct = async (req, res) => {
  try {
    const { code, name, description, price, is_active, type = 'course', file_url, access_url, course_url, link } = req.body;
    if (!code || !name || price === undefined) {
      return res.status(400).json({ success: false, error: 'يرجى تقديم كود المنتج والاسم والسعر' });
    }
    const finalAccessUrl = access_url || course_url || link || null;
    const product = await Product.create({
      code,
      name,
      description,
      price,
      is_active,
      type: type || 'course',
      file_url: file_url || null,
      access_url: finalAccessUrl
    });

    // تسجيل المنتج وسعره في Chargily Pay تلقائياً لمرة واحدة
    const { syncProductWithChargily } = require('../config/chargily');
    await syncProductWithChargily(product);

    return res.status(201).json({ success: true, message: 'تم إنشاء المنتج بنجاح', data: product });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

// PUT /api/products/:id - تحديث منتج
const updateProduct = async (req, res) => {
  try {
    const product = isNaN(req.params.id)
      ? await Product.findOne({ where: { code: req.params.id } })
      : await Product.findByPk(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, error: 'المنتج غير موجود' });
    }

    const oldPrice = product.price;
    const oldName = product.name;

    const updateData = { ...req.body };
    if (req.body.course_url || req.body.link) {
      updateData.access_url = req.body.access_url || req.body.course_url || req.body.link;
    }

    await product.update(updateData);

    // إذا تغير الاسم أو السعر، يتم التحديث في Chargily Pay دون إنشاء منتج جديد
    const { syncProductWithChargily, chargilyClient } = require('../config/chargily');
    if (chargilyClient && product.chargily_product_id) {
      if (updateData.name && updateData.name !== oldName) {
        try {
          await chargilyClient.updateProduct(product.chargily_product_id, { name: product.name });
          console.log(`✅ تم تحديث اسم المنتج في Chargily Pay إلى: ${product.name}`);
        } catch (e) {
          console.warn('⚠️ تنبيه تحديث اسم المنتج في Chargily:', e.message);
        }
      }
      if (updateData.price && Number(updateData.price) !== Number(oldPrice)) {
        await syncProductWithChargily(product, true); // forceNewPrice = true تحت نفس المنتج
      }
    }

    return res.status(200).json({ success: true, message: 'تم تحديث المنتج بنجاح', data: product });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

// DELETE /api/products/:id - حذف منتج
const deleteProduct = async (req, res) => {
  try {
    const product = isNaN(req.params.id)
      ? await Product.findOne({ where: { code: req.params.id } })
      : await Product.findByPk(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, error: 'المنتج غير موجود' });
    }
    await product.destroy();
    return res.status(200).json({ success: true, message: 'تم حذف المنتج بنجاح' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/products/download/:serial - تحميل آمن للكتاب الرقمي عبر رقم سيريال المشتري
const downloadProductFile = async (req, res) => {
  try {
    const { serial } = req.params;

    const customer = await Customer.findOne({ where: { serial_number: serial } });
    if (!customer) {
      return res.status(404).json({ success: false, error: 'رقم السيريال غير صحيح أو غير موجود' });
    }

    if (customer.payment_status !== 'paid') {
      return res.status(403).json({ success: false, error: 'لم يتم تأكيد دفع هذا الطلب بعد' });
    }

    const product = isNaN(customer.product_id)
      ? await Product.findOne({ where: { code: customer.product_id } })
      : await Product.findByPk(customer.product_id);

    if (!product || !product.file_url) {
      return res.status(404).json({ success: false, error: 'الملف المطلوب غير متوفر حالياً لهذا المنتج' });
    }

    // إذا كان الرابط خارجياً (مثل Google Drive أو AWS S3 أو رابط مباشر)
    if (product.file_url.startsWith('http://') || product.file_url.startsWith('https://')) {
      return res.redirect(product.file_url);
    }

    // إذا كان الملف مخزناً محلياً على السيرفر
    const filePath = path.resolve(__dirname, '..', product.file_url);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'الملف غير موجود على السيرفر' });
    }

    return res.download(filePath);
  } catch (err) {
    console.error('Error in downloadProductFile:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  downloadProductFile
};
