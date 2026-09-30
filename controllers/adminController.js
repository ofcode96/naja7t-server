const { Product, Customer, ActivationCode, Student } = require('../models');
const { sequelize } = require('../config/db');

/**
 * تصفير وتفريغ قاعدة البيانات أو جداول محددة بالكامل بدون إضافة كورسات افتراضية
 * POST /api/admin/reset
 */
const resetDatabase = async (req, res) => {
  try {
    const { target = 'all' } = req.body;
    let message = '';

    const targetLower = (target || 'all').toLowerCase();

    if (targetLower === 'all') {
      // إعادة إنشاء وبناء جميع الجداول نظيفة بالكامل
      await sequelize.sync({ force: true });
      message = 'تم تصفير وتفريغ جميع جداول قاعدة البيانات بالكامل وهي الآن فارغة ونظيفة وجاهزة لإدخال بياناتك!';
    } else {
      switch (targetLower) {
        case 'customers':
          await Customer.destroy({ where: {} });
          message = 'تم تصفير وتفريغ جدول العملاء والعمليات بنجاح!';
          break;

        case 'activation_codes':
        case 'activation-codes':
          await ActivationCode.destroy({ where: {} });
          message = 'تم تصفير وتفريغ جدول أكواد التفعيل بنجاح!';
          break;

        case 'students':
          await Student.destroy({ where: {} });
          message = 'تم تصفير وتفريغ جدول التلاميذ وإجابات الكويزات بنجاح!';
          break;

        case 'products':
          await Product.destroy({ where: {} });
          message = 'تم تصفير وتفريغ جدول المنتجات بنجاح!';
          break;

        default:
          await Customer.destroy({ where: {} });
          message = 'تم تصفير وتفريغ الجدول المطلوب بنجاح!';
          break;
      }
    }

    return res.status(200).json({
      success: true,
      message,
      target: targetLower
    });

  } catch (error) {
    console.error('خطأ في تصفير قاعدة البيانات:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * اختبار إرسال بريد إلكتروني تجريبي لعنوان محدد عبر SMTP بشكل غير حاجب (Non-blocking Asynchronous)
 * POST & GET /api/admin/test-email
 */
const testEmail = async (req, res) => {
  try {
    const { sendPurchaseConfirmationEmail } = require('../utils/emailService');
    const { email } = req.body || {};
    const recipient = email || req.query.email || 'oussamabvb201283@gmail.com';

    console.log(`⏳ [Test Email Request] جاري تجربة إرسال بريد اختباري لـ: ${recipient}`);

    const result = await sendPurchaseConfirmationEmail({
      toEmail: recipient,
      customerName: 'زبون تجريبي - منصة نجحت',
      serialNumber: 'CUST-TEST-9999',
      activationCode: 'NJ-TEST-2026',
      productName: 'باقة نجحت المعتمدة - تجربة بريد المنصة'
    });

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: `تم إرسال البريد الإلكتروني بنجاح إلى (${recipient})!`,
        result,
        recipient,
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(500).json({
        success: false,
        message: `فشل إرسال البريد الإلكتروني إلى (${recipient}).`,
        error: result.error || result.reason,
        result,
        recipient,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('خطأ في اختبار الإيميل:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * جلب الـ IP الخارجي الحالي الذي يستخدمه السيرفر للخروج للشبكة
 * GET /api/admin/my-ip
 */
const getServerIp = async (req, res) => {
  try {
    const ipRes = await fetch('https://api.ipify.org?format=json');
    const ipData = await ipRes.json();
    return res.status(200).json({
      success: true,
      ip: ipData.ip,
      message: `الـ IP الحالي الخارجي لسيرفرك هو: ${ipData.ip}`
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * فحص المتغيرات وبيئة الاستضافة بدون كشف كلمات المرور (Diagnostics)
 * GET /api/admin/env-check
 */
const checkEnvironment = (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const rootDir = path.resolve(__dirname, '..');
  const envFileExists = fs.existsSync(path.join(rootDir, '.env'));

  return res.status(200).json({
    success: true,
    server: {
      cwd: process.cwd(),
      appDir: rootDir,
      envFileExists: envFileExists,
      nodeVersion: process.version
    },
    database: {
      dialect: (process.env.DB_DIALECT || 'mysql').toUpperCase(),
      host: process.env.DB_HOST || 'not set (using localhost)',
      port: process.env.DB_PORT || '3306',
      name: process.env.DB_NAME || 'not set',
      user: process.env.DB_USER || 'not set (using root)',
      isPasswordSet: Boolean(process.env.DB_PASSWORD && process.env.DB_PASSWORD.trim().length > 0)
    },
    smtp: {
      host: process.env.EMAIL_HOST || 'not set',
      port: process.env.EMAIL_PORT || 'not set',
      user: process.env.EMAIL_USER || 'not set',
      isPassSet: Boolean(process.env.EMAIL_PASS && process.env.EMAIL_PASS.trim().length > 0),
      isPassPlaceholder: Boolean(process.env.EMAIL_PASS && process.env.EMAIL_PASS.includes('your_'))
    }
  });
};

module.exports = {
  resetDatabase,
  testEmail,
  getServerIp,
  checkEnvironment
};
