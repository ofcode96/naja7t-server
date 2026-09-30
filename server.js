const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initDatabase, sequelize } = require('./config/db');

// استيراد المسارات
const purchaseRoutes = require('./routes/purchaseRoutes');
const productRoutes = require('./routes/productRoutes');
const customerRoutes = require('./routes/customerRoutes');
const activationCodeRoutes = require('./routes/activationCodeRoutes');
const studentRoutes = require('./routes/studentRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// تمكين الـ Proxy ليعمل Express بشكل سليم خلف Nginx / Apache / Cloudflare / cPanel
app.set('trust proxy', 1);

// إعداد CORS متقدم ومرن يدعم الاستضافات المختلفة وتطبيقات الويب والموبايل
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['*'];

const frontendUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.trim() : null;

const corsOptions = {
  origin: (origin, callback) => {
    // السماح بالطلبات بدون origin (مثل mobile apps, curl, server-to-server, webhooks)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes('*')) return callback(null, true);
    if (frontendUrl && (origin === frontendUrl || origin.startsWith(frontendUrl))) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'chargily-signature',
    'signature',
    'x-chargily-signature'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// معالجة JSON مع حفظ البايتات الخام req.rawBody للتحقق الدقيق من التوقيع الرقمي للـ Webhook
app.use(express.json({
  limit: '15mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.use(express.urlencoded({ extended: true, limit: '15mb' }));

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
    version: '2.5.0',
    message: 'مرحباً بك في API منصة نجحت التعليمية - جاهز للإنتاج',
    database: sequelize ? sequelize.getDialect().toUpperCase() : (process.env.DB_DIALECT || 'mysql').toUpperCase(),
    environment: process.env.NODE_ENV || 'production',
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
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

// معالجة المسارات غير الموجودة (404 Handler)
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
    error: err.message || 'حدث خطأ داخلي في الخادم (500 Internal Server Error)'
  });
});

// تشغيل الخادم والربط بقاعدة البيانات
app.listen(PORT, async () => {
  console.log(`=================================`);
  console.log(`🚀 Naja7t Server 2.5 is running on port ${PORT}`);
  console.log(`🗄️ Database: ${(process.env.DB_DIALECT || 'mysql').toUpperCase()}`);
  console.log(`🌐 Base URL: http://localhost:${PORT}`);
  console.log(`🔒 Trust Proxy: Enabled`);
  console.log(`=================================`);
  
  await initDatabase();
});

module.exports = app;
