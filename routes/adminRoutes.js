const express = require('express');
const router = express.Router();
const { resetDatabase, testEmail, getServerIp } = require('../controllers/adminController');

/**
 * @route   POST /api/admin/reset
 * @desc    تصفير وتفريغ قاعدة البيانات أو جداول محددة (all, customers, products, activation_codes, students)
 * @access  Admin
 */
router.post('/reset', resetDatabase);

/**
 * @route   POST & GET /api/admin/test-email
 * @desc    اختبار إرسال بريد إلكتروني تجريبي لبريد محدد للتحقق من الاتصال وBrevo SMTP
 * @access  Admin
 */
router.post('/test-email', testEmail);
router.get('/test-email', testEmail);

/**
 * @route   GET /api/admin/my-ip
 * @desc    جلب الـ IP الخارجي الحالي للسيرفر لإضافته في Brevo Authorized IPs
 * @access  Admin
 */
router.get('/my-ip', getServerIp);

module.exports = router;
