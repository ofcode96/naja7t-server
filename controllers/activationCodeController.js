const { ActivationCode } = require('../models');
const crypto = require('crypto');

// GET /api/activation-codes - جلب كافة الأكواد
const getAllActivationCodes = async (req, res) => {
  try {
    const { status, product_id } = req.query;
    const where = {};
    if (status) where.status = status;
    if (product_id) where.product_id = product_id;

    const codes = await ActivationCode.findAll({ where, order: [['createdAt', 'DESC']] });
    return res.status(200).json({ success: true, count: codes.length, data: codes });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/activation-codes - إضافة كود تفعيل فريد (لا يقبل التكرار مطلقا)
const createActivationCode = async (req, res) => {
  try {
    const { code, product_id } = req.body;
    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, error: 'يرجى تقديم كود التفعيل' });
    }

    const cleanCode = code.trim().toUpperCase();

    // فحص عدم التكرار
    const existing = await ActivationCode.findOne({ where: { code: cleanCode } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'كود التفعيل هذا موجود مسبقاً وغير مسموح بتكرار الأكواد!' });
    }

    const newCode = await ActivationCode.create({
      code: cleanCode,
      product_id: product_id || null,
      status: 'unused'
    });

    return res.status(201).json({ success: true, message: 'تم إضافة كود التفعيل بنجاح', data: newCode });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

// POST /api/activation-codes/generate - توليد أكواد تفعيل عشوائية فريدة دفعة واحدة
const generateBulkCodes = async (req, res) => {
  try {
    const { count = 10, product_id } = req.body;
    const generated = [];

    for (let i = 0; i < Number(count); i++) {
      const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
      const code = `NJ-${randomPart.slice(0, 4)}-${randomPart.slice(4)}`;
      
      try {
        const created = await ActivationCode.create({
          code,
          product_id: product_id || null,
          status: 'unused'
        });
        generated.push(created);
      } catch (e) {
        // تجاهل التكرار النادر والاستمرار
      }
    }

    return res.status(201).json({
      success: true,
      message: `تم توليد ${generated.length} كود تفعيل فريد بنجاح!`,
      data: generated
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/activation-codes/validate/:code - التحقق من سلامة كود التفعيل
const validateCode = async (req, res) => {
  try {
    const { code } = req.params;
    const cleanCode = code.trim().toUpperCase();

    const activationCode = await ActivationCode.findOne({ where: { code: cleanCode } });

    if (!activationCode) {
      return res.status(404).json({ success: false, valid: false, error: 'كود التفعيل غير صحيح أو غير موجود' });
    }

    if (activationCode.status === 'used') {
      return res.status(400).json({ success: false, valid: false, error: 'كود التفعيل تم استخدامه مسبقاً' });
    }

    return res.status(200).json({
      success: true,
      valid: true,
      message: 'كود التفعيل صالح وغير مستعمل',
      data: activationCode
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/activation-codes/:id - حذف كود تفعيل
const deleteActivationCode = async (req, res) => {
  try {
    const code = await ActivationCode.findByPk(req.params.id);
    if (!code) {
      return res.status(404).json({ success: false, error: 'كود التفعيل غير موجود' });
    }
    await code.destroy();
    return res.status(200).json({ success: true, message: 'تم حذف كود التفعيل بنجاح' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  getAllActivationCodes,
  createActivationCode,
  generateBulkCodes,
  validateCode,
  deleteActivationCode
};
