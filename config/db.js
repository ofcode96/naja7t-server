const { Sequelize } = require('sequelize');
require('dotenv').config();

// إذا لم يتم تحديد DB_HOST للإنتاج، نعتمد SQLite تلقائياً لضمان العمل التام على Render بدون أخطاء
const isMySQLConfigured = Boolean(process.env.DB_HOST && process.env.DB_HOST !== 'localhost');
const dialect = process.env.DB_DIALECT || (isMySQLConfigured ? 'mysql' : 'sqlite');

let sequelize;

if (dialect === 'mysql' && isMySQLConfigured) {
  try {
    const mysql2 = require('mysql2');
    sequelize = new Sequelize(
      process.env.DB_NAME || 'naja7t_db',
      process.env.DB_USER || 'root',
      process.env.DB_PASSWORD || '',
      {
        host: process.env.DB_HOST,
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
    console.log(`🐬 تم الاتصال بقاعدة بيانات MySQL (${process.env.DB_HOST})`);
  } catch (err) {
    console.error('❌ خطأ في إعداد اتصال MySQL:', err.message);
  }
}

// التكيف التلقائي مع SQLite في حال عدم ربط سيرفر MySQL خارجي
if (!sequelize) {
  try {
    const sqlite3 = require('sqlite3');
    sequelize = new Sequelize({
      dialect: 'sqlite',
      dialectModule: sqlite3,
      storage: process.env.DB_STORAGE || './naja7t.sqlite',
      logging: false
    });
    console.log('📦 تم استخدام قاعدة البيانات المستقلة: SQLite');
  } catch (err) {
    console.error('❌ خطأ في تحميل وحدة SQLite:', err.message);
  }
}

// دالة فحص ومزامنة الاتصال
async function initDatabase() {
  try {
    await sequelize.authenticate();
    console.log(`✅ تم الاتصال بنجاح بقاعدة البيانات (${sequelize.getDialect().toUpperCase()})`);
    require('../models');
    await sequelize.sync();
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
