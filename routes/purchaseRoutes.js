const express = require('express');
const router = express.Router();
const { processPurchase, getPurchaseStatus, handleChargilyWebhook } = require('../controllers/purchaseController');

/**
 * @route   POST /api/purchase/checkout
 * @desc    معالجة وإنشاء طلب شراء وجلسة دفع Chargily Pay
 * @access  Public
 */
router.post('/checkout', processPurchase);

/**
 * @route   POST /api/purchase/webhook/chargily
 * @desc    استقبال إشعارات وتأكيدات الدفع الفورية من Chargily Pay Webhook
 * @access  Public (مع التحقق من التوقيع الرقمي chargily-signature)
 */
router.post('/webhook/chargily', handleChargilyWebhook);

/**
 * @route   GET /api/purchase/status/:orderId
 * @desc    جلب تفاصيل وحالة طلب الشراء
 * @access  Public
 */
router.get('/status/:orderId', getPurchaseStatus);

/**
 * @route   GET /api/purchase/test
 * @desc    فحص عمل مسارات الشراء وبوابة Chargily
 * @access  Public
 */
router.get('/test', (req, res) => {
  const { isChargilyConfigured } = require('../config/chargily');
  res.json({
    success: true,
    message: 'مسارات صفحة الشراء وبوابة الدفع Chargily Pay تعمل بنجاح!',
    chargilyConfigured: isChargilyConfigured(),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
