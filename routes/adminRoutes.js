const express = require('express');
const router = express.Router();
const { resetDatabase } = require('../controllers/adminController');

/**
 * @route   POST /api/admin/reset
 * @desc    تصفير وتفريغ قاعدة البيانات أو جداول محددة (all, customers, products, activation_codes, students)
 * @access  Admin
 */
router.post('/reset', resetDatabase);

module.exports = router;
