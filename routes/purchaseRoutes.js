const express = require('express');
const router = express.Router();
const { processPurchase, handleChargilyWebhook } = require('../controllers/customerController');
const { decryptData } = require('../utils/encryption');

/**
 * @route   POST /api/purchase/checkout
 * @desc    معالجة الشراء وحفظ العميل في قاعدة البيانات وتوليد رابط Chargily Pay أو التفعيل المجاني
 */
router.post('/checkout', processPurchase);

/**
 * @route   POST /api/purchase/webhook/chargily
 * @desc    استقبال إشعار الدفع من Chargily Pay وتأكيد الطلب وتعيين كود التفعيل
 */
router.post('/webhook/chargily', handleChargilyWebhook);

/**
 * @route   POST /api/purchase/decrypt-success
 * @desc    فك تشفير التوكين الممرر في رابط صفحة النجاح لاستخراج البيانات بأمان
 */
router.post('/decrypt-success', (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'يرجى تقديم التوكين المشفر' });
    }

    const decryptedData = decryptData(token);
    if (!decryptedData) {
      return res.status(400).json({ success: false, error: 'التوكين غير صالح أو تم التلاعب به' });
    }

    return res.status(200).json({ success: true, data: decryptedData });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/purchase/test
 */
router.get('/test', (req, res) => {
  const { isChargilyConfigured } = require('../config/chargily');
  res.json({
    success: true,
    message: 'مسارات الشراء وقواعد البيانات تعمل بنجاح!',
    chargilyConfigured: isChargilyConfigured(),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
