const express = require('express');
const router = express.Router();
const { processPurchase, getPurchaseStatus } = require('../controllers/purchaseController');

/**
 * @route   POST /api/purchase/checkout
 * @desc    معالجة وإنشاء طلب شراء محاكى
 * @access  Public
 */
router.post('/checkout', processPurchase);

/**
 * @route   GET /api/purchase/status/:orderId
 * @desc    جلب تفاصيل وحالة طلب الشراء
 * @access  Public
 */
router.get('/status/:orderId', getPurchaseStatus);

/**
 * @route   GET /api/purchase/test
 * @desc    فحص عمل مسارات الشراء
 * @access  Public
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'مسارات صفحة الشراء (Purchase API) تعمل بنجاح!',
    timestamp: new Date().toISOString()
  });
    console.log({success:true});
});

module.exports = router;
