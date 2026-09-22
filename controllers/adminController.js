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
 * اختبار إرسال بريد إلكتروني تجريبي لعنوان محدد عبر SMTP
 * POST /api/admin/test-email
 */
const testEmail = async (req, res) => {
  try {
    const { sendPurchaseConfirmationEmail } = require('../utils/emailService');
    const { email } = req.body;
    const recipient = email || req.query.email || 'baa227001@smtp-brevo.com';

    const result = await sendPurchaseConfirmationEmail({
      toEmail: recipient,
      customerName: 'زبون تجريبي - منصة نجحت',
      serialNumber: 'CUST-TEST-9999',
      activationCode: 'NJ-BREVO-TEST-2026',
      productName: 'باقة نجحت المعتمدة - تجربة Brevo SMTP'
    });

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: `تم إرسال البريد الإلكتروني بنجاح إلى (${recipient}) عبر SMTP!`,
        messageId: result.messageId,
        data: result
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error || result.reason || 'تعذر إرسال البريد الإلكتروني',
        data: result
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

module.exports = {
  resetDatabase,
  testEmail,
  getServerIp
};
