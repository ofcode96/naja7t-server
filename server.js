const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initDatabase } = require('./config/db');
const { Product, ActivationCode } = require('./models');

// استيراد المسارات
const purchaseRoutes = require('./routes/purchaseRoutes');
const productRoutes = require('./routes/productRoutes');
const customerRoutes = require('./routes/customerRoutes');
const activationCodeRoutes = require('./routes/activationCodeRoutes');
const studentRoutes = require('./routes/studentRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware الأساسية
app.use(cors());

// التقاط البايتات الخام (Raw Body Buffer) لمسار Webhook لـ Chargily Pay
app.use('/api/purchase/webhook/chargily', express.raw({ type: 'application/json' }));

// معالجة JSON والـ Form Data
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// الصفحة الرئيسية وفحص سلامة السيرفر Health Check
app.get('/', (req, res) => {
  res.json({
    success: true,
    name: process.env.APP_NAME || 'Naja7t API Server',
    version: '2.0.0',
    message: 'مرحباً بك في API منصة نجحت التعليمية - تدعم قواعد البيانات و Chargily Pay وتشفير روابط النجاح',
    database: process.env.DB_DIALECT || 'sqlite',
    status: 'Running'
  });
});

// ربط جميع مسارات الـ API (CRUD & Purchase)
app.use('/api/purchase', purchaseRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/activation-codes', activationCodeRoutes);
app.use('/api/students', studentRoutes);

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

// بذر بيانات أولية مجاناً في حال كانت البيانات فارغة (Seed Initial Data)
async function seedInitialData() {
  try {
    const count = await Product.count();
    if (count === 0) {
      console.log('🌱 بذر البيانات الأولية للمنتجات وأكواد التفعيل...');
      await Product.bulkCreate([
        { code: 'BAC-MATH-2026', name: 'التحضير للبكالوريا - مادة الرياضيات', description: 'دورة الرياضيات الشاملة', price: 4000 },
        { code: 'BAC-PHYSICS-2026', name: 'التحضير للبكالوريا - مادة الفيزياء', description: 'دورة الفيزياء الشاملة', price: 4500 },
        { code: 'BAC-SCIENCE-2026', name: 'التحضير للبكالوريا - مادة العلوم', description: 'دورة العلوم الشاملة', price: 4000 },
        { code: 'FULL-PACK-2026', name: 'الباك الشامل - جميع المواد العلمية', description: 'عرض الشامل لكل المواد', price: 10000 }
      ]);

      await ActivationCode.bulkCreate([
        { code: 'NJ-ACT-1001-MATH', status: 'unused', product_id: 'BAC-MATH-2026' },
        { code: 'NJ-ACT-1002-PHYS', status: 'unused', product_id: 'BAC-PHYSICS-2026' },
        { code: 'NJ-ACT-1003-SCIE', status: 'unused', product_id: 'BAC-SCIENCE-2026' },
        { code: 'NJ-ACT-1004-PACK', status: 'unused', product_id: 'FULL-PACK-2026' }
      ]);
      console.log('✅ تم بذر البيانات بنجاح!');
    }
  } catch (err) {
    console.warn('⚠️ Seed Warning:', err.message);
  }
}

// تشغيل الخادم والربط بقاعدة البيانات
app.listen(PORT, async () => {
  console.log(`=================================`);
  console.log(`🚀 Naja7t Server 2.0 is running on port ${PORT}`);
  console.log(`🗄️ Database: ${process.env.DB_DIALECT || 'sqlite'}`);
  console.log(`🌐 Base URL: http://localhost:${PORT}`);
  console.log(`=================================`);
  
  const connected = await initDatabase();
  if (connected) {
    await seedInitialData();
  }
});

module.exports = app;
