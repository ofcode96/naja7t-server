const { ActivationCode } = require('../models');
const { Op } = require('sequelize');
const crypto = require('crypto');

/**
 * فحص وتأكيد تحديث الأكواد المنتهية تلقائياً
 */
const autoUpdateExpiredCodes = async () => {
  try {
    await ActivationCode.update(
      { status: 'expired' },
      {
        where: {
          status: 'unused',
          expires_at: {
            [Op.ne]: null,
            [Op.lt]: new Date()
          }
        }
      }
    );
  } catch (err) {
    console.warn('⚠️ خطأ في تحديث الأكواد المنتهية تلقائياً:', err.message);
  }
};

// GET /api/activation-codes - جلب كافة الأكواد مع الفلترة والتحقق من الصلاحية
const getAllActivationCodes = async (req, res) => {
  try {
    await autoUpdateExpiredCodes();

    const { status, product_id, search } = req.query;
    const where = {};

    if (status) where.status = status;
    if (product_id) where.product_id = product_id;
    if (search) {
      where.code = { [Op.like]: `%${search.trim().toUpperCase()}%` };
    }

    const codes = await ActivationCode.findAll({ where, order: [['createdAt', 'DESC']] });

    const stats = {
      total: codes.length,
      unused: codes.filter(c => c.status === 'unused').length,
      used: codes.filter(c => c.status === 'used').length,
      expired: codes.filter(c => c.status === 'expired').length
    };

    return res.status(200).json({ success: true, count: codes.length, stats, data: codes });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/activation-codes - إضافة كود تفعيل مخصص مع تحديد الصلاحية وتاريخ الانتهاء
const createActivationCode = async (req, res) => {
  try {
    const { code, product_id, expires_at, status } = req.body;
    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, error: 'يرجى تقديم كود التفعيل' });
    }

    const cleanCode = code.trim().toUpperCase();

    // فحص عدم التكرار
    const existing = await ActivationCode.findOne({ where: { code: cleanCode } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'كود التفعيل هذا موجود مسبقاً وغير مسموح بتكرار الأكواد!' });
    }

    let initialStatus = status || 'unused';
    let expDate = expires_at ? new Date(expires_at) : null;
    if (expDate && expDate < new Date() && initialStatus === 'unused') {
      initialStatus = 'expired';
    }

    const newCode = await ActivationCode.create({
      code: cleanCode,
      product_id: product_id || null,
      expires_at: expDate,
      status: initialStatus
    });

    return res.status(201).json({ success: true, message: 'تم إضافة كود التفعيل بنجاح', data: newCode });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

// PUT /api/activation-codes/:id - تعديل كود تفعيل وحالته وتاريخ انتهاء صلاحيته
const updateActivationCode = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, status, expires_at, product_id } = req.body;

    const activationCode = await ActivationCode.findByPk(id);
    if (!activationCode) {
      return res.status(404).json({ success: false, error: 'كود التفعيل غير موجود' });
    }

    if (code && code.trim().toUpperCase() !== activationCode.code) {
      const cleanCode = code.trim().toUpperCase();
      const existing = await ActivationCode.findOne({ where: { code: cleanCode } });
      if (existing) {
        return res.status(400).json({ success: false, error: 'كود التفعيل الجديد مستخدم مسبقاً' });
      }
      activationCode.code = cleanCode;
    }

    if (status && ['unused', 'used', 'expired'].includes(status)) {
      activationCode.status = status;
    }

    if (expires_at !== undefined) {
      activationCode.expires_at = expires_at ? new Date(expires_at) : null;
      if (activationCode.expires_at && activationCode.expires_at < new Date() && activationCode.status === 'unused') {
        activationCode.status = 'expired';
      }
    }

    if (product_id !== undefined) {
      activationCode.product_id = product_id || null;
    }

    await activationCode.save();

    return res.status(200).json({ success: true, message: 'تم تحديث كود التفعيل بنجاح', data: activationCode });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

// POST /api/activation-codes/generate - توليد أكواد تفعيل عشوائية فريدة دفعة واحدة
const generateBulkCodes = async (req, res) => {
  try {
    const { count = 10, product_id, expires_at } = req.body;
    const generated = [];
    const expDate = expires_at ? new Date(expires_at) : null;

    for (let i = 0; i < Number(count); i++) {
      const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
      const code = `NJ-${randomPart.slice(0, 4)}-${randomPart.slice(4)}`;
      
      try {
        const created = await ActivationCode.create({
          code,
          product_id: product_id || null,
          expires_at: expDate,
          status: (expDate && expDate < new Date()) ? 'expired' : 'unused'
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

    if (activationCode.expires_at && new Date(activationCode.expires_at) < new Date() && activationCode.status === 'unused') {
      activationCode.status = 'expired';
      await activationCode.save();
    }

    if (activationCode.status === 'expired') {
      return res.status(400).json({ success: false, valid: false, error: 'كود التفعيل منتهي الصلاحية وغير صالح للاستخدام' });
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
  updateActivationCode,
  generateBulkCodes,
  validateCode,
  deleteActivationCode
};
