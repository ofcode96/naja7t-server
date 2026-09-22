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

    // فحص وإضافة أي أعمدة مفقودة في SQLite تلقائياً
    if (sequelize.getDialect() === 'sqlite') {
      try {
        // 1. activation_codes.expires_at
        const [actResults] = await sequelize.query("PRAGMA table_info('activation_codes');");
        if (actResults && actResults.length > 0) {
          const hasExpiresAt = actResults.some(col => col.name === 'expires_at');
          if (!hasExpiresAt) {
            await sequelize.query("ALTER TABLE `activation_codes` ADD COLUMN `expires_at` DATETIME NULL;");
            console.log('✅ تم إضافة عمود expires_at في جدول activation_codes بنجاح!');
          }
        }

        // 2. products.type & products.file_url
        const [prodResults] = await sequelize.query("PRAGMA table_info('products');");
        if (prodResults && prodResults.length > 0) {
          const hasType = prodResults.some(col => col.name === 'type');
          if (!hasType) {
            await sequelize.query("ALTER TABLE `products` ADD COLUMN `type` VARCHAR(50) DEFAULT 'course';");
            console.log('✅ تم إضافة عمود type في جدول products بنجاح!');
          }
          const hasFileUrl = prodResults.some(col => col.name === 'file_url');
          if (!hasFileUrl) {
            await sequelize.query("ALTER TABLE `products` ADD COLUMN `file_url` VARCHAR(255) NULL;");
            console.log('✅ تم إضافة عمود file_url في جدول products بنجاح!');
          }
        }

        // 3. customers.download_link
        const [custResults] = await sequelize.query("PRAGMA table_info('customers');");
        if (custResults && custResults.length > 0) {
          const hasDownloadLink = custResults.some(col => col.name === 'download_link');
          if (!hasDownloadLink) {
            await sequelize.query("ALTER TABLE `customers` ADD COLUMN `download_link` VARCHAR(255) NULL;");
            console.log('✅ تم إضافة عمود download_link في جدول customers بنجاح!');
          }
        }
      } catch (colErr) {
        console.warn('⚠️ فحص أعمدة SQLite التلقائية:', colErr.message);
      }
    }

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
