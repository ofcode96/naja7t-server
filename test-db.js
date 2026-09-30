require('dotenv').config();
const { sequelize } = require('./config/db');

async function testConnection() {
  console.log('==============================================');
  console.log('🔍 جاري فحص الاتصال بقاعدة البيانات...');
  console.log(`🗄️ النوع المختار (Dialect): ${(process.env.DB_DIALECT || 'mysql').toUpperCase()}`);
  console.log(`🌐 المضيف (Host): ${process.env.DB_HOST || 'localhost'}`);
  console.log(`🔌 المنفذ (Port): ${process.env.DB_PORT || 3306}`);
  console.log(`📦 اسم القاعدة (Database): ${process.env.DB_NAME || 'naja7t_db'}`);
  console.log(`👤 المستخدم (User): ${process.env.DB_USER || 'root'}`);
  console.log('==============================================');

  try {
    await sequelize.authenticate();
    console.log('✅ نجاح: تم الاتصال بقاعدة البيانات بنجاح تام وبدون أي أخطاء!');
    
    // فحص مزامنة الجداول
    require('./models');
    await sequelize.sync();
    console.log('🔄 نجاح: تم فحص ومزامنة جميع جداول المنصة (Products, Customers, ActivationCodes, Students) بنجاح!');
    console.log('==============================================');
    console.log('🎉 السيرفر جاهز للعمل والتشغيل في بيئة الإنتاج!');
    process.exit(0);
  } catch (error) {
    console.error('❌ فشل الاتصال بقاعدة البيانات:');
    console.error(error.message);
    console.log('----------------------------------------------');
    console.log('💡 نصائح للحل:');
    console.log('1. تأكد من إنشاء قاعدة البيانات أولاً في phpMyAdmin أو cPanel (مثلاً naja7t_db).');
    console.log('2. تأكد من ربط المستخدم بقاعدة البيانات وإعطائه كافة الصلاحيات (ALL PRIVILEGES).');
    console.log('3. تأكد من كتابة كلمة المرور واسم المستخدم بدقة في ملف .env.');
    console.log('==============================================');
    process.exit(1);
  }
}

testConnection();
