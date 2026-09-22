const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initDatabase } = require('./config/db');

// استيراد المسارات
const purchaseRoutes = require('./routes/purchaseRoutes');
const productRoutes = require('./routes/productRoutes');
const customerRoutes = require('./routes/customerRoutes');
const activationCodeRoutes = require('./routes/activationCodeRoutes');
const studentRoutes = require('./routes/studentRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware الأساسية
app.use(cors());

// معالجة JSON مع حفظ البايتات الخام req.rawBody للتحقق الدقيق من التوقيع الرقمي للـ Webhook
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// معالجة أخطاء الـ JSON غير الصحيحة لمنع توقف الخادم
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    req.body = {};
    return next();
  }
  next(err);
});

// الصفحة الرئيسية وفحص سلامة السيرفر Health Check
app.get('/', (req, res) => {
  res.json({
    success: true,
    name: process.env.APP_NAME || 'Naja7t API Server',
    version: '2.2.0',
    message: 'مرحباً بك في API منصة نجحت التعليمية - خالي من الكورسات الافتراضية وجاهز لإدخال منتجاتك المخصصة',
    database: process.env.DB_DIALECT || 'sqlite',
    status: 'Running'
  });
});

// ربط جميع مسارات الـ API (CRUD, Purchase, Admin)
app.use('/api/purchase', purchaseRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/activation-codes', activationCodeRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/admin', adminRoutes);

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

// تشغيل الخادم والربط بقاعدة البيانات بدون إدراج أي كورس افتراضي
app.listen(PORT, async () => {
  console.log(`=================================`);
  console.log(`🚀 Naja7t Server 2.2 is running on port ${PORT}`);
  console.log(`🗄️ Database: ${process.env.DB_DIALECT || 'sqlite'}`);
  console.log(`🌐 Base URL: http://localhost:${PORT}`);
  console.log(`=================================`);
  
  await initDatabase();
});

module.exports = app;
