const express = require('express');
const router = express.Router();
const { resetDatabase, testEmail } = require('../controllers/adminController');

/**
 * @route   POST /api/admin/reset
 * @desc    تصفير وتفريغ قاعدة البيانات أو جداول محددة (all, customers, products, activation_codes, students)
 * @access  Admin
 */
router.post('/reset', resetDatabase);

/**
 * @route   POST /api/admin/test-email
 * @desc    اختبار إرسال بريد إلكتروني تجريبي لبريد محدد للتحقق من الاتصال وBrevo SMTP
 * @access  Admin
 */
router.post('/test-email', testEmail);

module.exports = router;
