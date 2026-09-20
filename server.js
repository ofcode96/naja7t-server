const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { checkConnection } = require('./config/db');
const purchaseRoutes = require('./routes/purchaseRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware الأساسية
app.use(cors());

// التقاط البايتات الخام (Raw Body Buffer) لمسار Webhook لـ Chargily Pay للتحقق من التوقيع الرقمي
app.use('/api/purchase/webhook/chargily', express.raw({ type: 'application/json' }));

// معالجة JSON والـ Form Data للمسارات الأخرى
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// الصفحة الرئيسية وفحص سلامة السيرفر Health Check
app.get('/', (req, res) => {
  res.json({
    success: true,
    name: process.env.APP_NAME || 'Naja7t API Server',
    version: '1.0.0',
    message: 'مرحباً بك في API منصة نجحت التعليمية - متوافق مع بوابة Chargily Pay',
    status: 'Running'
  });
});

// ربط مسارات صفحة الشراء وبوابة الدفع
app.use('/api/purchase', purchaseRoutes);

// معالجة المسارات غير الموجدودة (404 Handler)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'المسار المطلوب غير موجود على السيرفر (404 Not Found)'
  });
});

// معالجة الأخطاء العامة (Global Error Handler)
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({
    success: false,
    error: 'حدث خطأ داخلي في الخادم (500 Internal Server Error)'
  });
});

// تشغيل الخادم وفحص قاعدة البيانات
app.listen(PORT, async () => {
  console.log(`=================================`);
  console.log(`🚀 Naja7t Server is running on port ${PORT}`);
  console.log(`💳 Chargily Pay Gateway Endpoint Ready!`);
  console.log(`🌐 Base URL: http://localhost:${PORT}`);
  console.log(`=================================`);
  
  await checkConnection();
});

module.exports = app;
