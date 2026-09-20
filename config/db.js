const { Sequelize } = require('sequelize');
require('dotenv').config();

const dialect = process.env.DB_DIALECT || 'sqlite';
let sequelize;

if (dialect === 'sqlite') {
  // تحميل مكتبة sqlite3 ديناميكياً فقط عند استخدام وضع SQLite محلياً
  try {
    const sqlite3 = require('sqlite3');
    sequelize = new Sequelize({
      dialect: 'sqlite',
      dialectModule: sqlite3,
      storage: process.env.DB_STORAGE || './naja7t.sqlite',
      logging: false
    });
    console.log('📦 تم اختيار قاعدة البيانات المحلية: SQLite');
  } catch (err) {
    console.error('❌ خطأ في تحميل وحدة sqlite3:', err.message);
    throw err;
  }
} else {
  // في بيئة الإنتاج على Render (MySQL) يتم استدعاء mysql2 صراحة لمنع البحث عن GLIBC الخاص بـ sqlite3
  const mysql2 = require('mysql2');
  sequelize = new Sequelize(
    process.env.DB_NAME || 'naja7t_db',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      dialect: 'mysql',
      dialectModule: mysql2,
      logging: false,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    }
  );
  console.log('🐬 تم اختيار قاعدة البيانات للإنتاج: MySQL');
}

// دالة فحص ومزامنة الاتصال
async function initDatabase() {
  try {
    await sequelize.authenticate();
    console.log(`✅ تم الاتصال بنجاح بقاعدة البيانات (${dialect.toUpperCase()})`);
    await sequelize.sync({ alter: true });
    console.log('🔄 تم فحص ومزامنة الجداول بنجاح!');
    return true;
  } catch (error) {
    console.error('❌ خطأ في الاتصال بقاعدة البيانات:', error.message);
    return false;
  }
}

module.exports = {
  sequelize,
  initDatabase
};
