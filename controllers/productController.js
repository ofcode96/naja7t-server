const { Product } = require('../models');

// GET /api/products - جلب كافة المنتجات
const getAllProducts = async (req, res) => {
  try {
    const products = await Product.findAll();
    return res.status(200).json({ success: true, count: products.length, data: products });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/products/:id - جلب منتج محدد
const getProductById = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'المنتج غير موجود' });
    }
    return res.status(200).json({ success: true, data: product });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/products - إضافة منتج جديد
const createProduct = async (req, res) => {
  try {
    const { code, name, description, price, is_active } = req.body;
    if (!code || !name || price === undefined) {
      return res.status(400).json({ success: false, error: 'يرجى تقديم كود المنتج والاسم والسعر' });
    }
    const product = await Product.create({ code, name, description, price, is_active });
    return res.status(201).json({ success: true, message: 'تم إنشاء المنتج بنجاح', data: product });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

// PUT /api/products/:id - تحديث منتج
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'المنتج غير موجود' });
    }
    await product.update(req.body);
    return res.status(200).json({ success: true, message: 'تم تحديث المنتج بنجاح', data: product });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

// DELETE /api/products/:id - حذف منتج
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'المنتج غير موجود' });
    }
    await product.destroy();
    return res.status(200).json({ success: true, message: 'تم حذف المنتج بنجاح' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};
