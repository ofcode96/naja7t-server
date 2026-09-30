const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

// تحديد نوع قاعدة البيانات: mysql افتراضياً للإنتاج ما لم يتم تحديد sqlite صراحة
const dialect = (process.env.DB_DIALECT || 'mysql').toLowerCase();
const isMySQL = dialect === 'mysql';

let sequelize;

if (isMySQL) {
  try {
    const mysql2 = require('mysql2');
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = Number(process.env.DB_PORT || 3306);
    const dbName = process.env.DB_NAME || 'naja7t_db';
    const dbUser = process.env.DB_USER || 'root';
    const dbPassword = process.env.DB_PASSWORD || '';

    sequelize = new Sequelize(
      dbName,
      dbUser,
      dbPassword,
      {
        host: dbHost,
        port: dbPort,
        dialect: 'mysql',
        dialectModule: mysql2,
        logging: false,
        timezone: '+01:00', // توقيت الجزائر (GMT+1)
        dialectOptions: {
          charset: 'utf8mb4',
          dateStrings: true,
          typeCast: true,
          connectTimeout: 60000
        },
        define: {
          charset: 'utf8mb4',
          collate: 'utf8mb4_unicode_ci',
          timestamps: true
        },
        pool: {
          max: 15,
          min: 0,
          acquire: 60000,
          idle: 10000
        }
      }
    );
    console.log(`🐬 تم تهيئة الاتصال بقاعدة بيانات MySQL (${dbHost}:${dbPort}/${dbName}) بنجاح!`);
  } catch (err) {
    console.error('❌ خطأ في إعداد مكتبة MySQL2:', err.message);
  }
}

// التكيف التلقائي مع SQLite في بيئة التطوير أو عند تعذر MySQL
if (!sequelize) {
  try {
    const sqlite3 = require('sqlite3');
    sequelize = new Sequelize({
      dialect: 'sqlite',
      dialectModule: sqlite3,
      storage: process.env.DB_STORAGE || './naja7t_v2.sqlite',
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
    const currentDialect = sequelize.getDialect().toUpperCase();
    console.log(`✅ تم الاتصال بنجاح بقاعدة البيانات (${currentDialect})`);
    
    // استدعاء النماذج ومزامنة الجداول
    require('../models');
    await sequelize.sync();

    // فحص وإضافة أي أعمدة مفقودة في SQLite تلقائياً عند العمل بـ SQLite
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

        // 2. products (type, file_url, access_url)
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
          const hasAccessUrl = prodResults.some(col => col.name === 'access_url');
          if (!hasAccessUrl) {
            await sequelize.query("ALTER TABLE `products` ADD COLUMN `access_url` VARCHAR(255) NULL;");
            console.log('✅ تم إضافة عمود access_url في جدول products بنجاح!');
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

    console.log(`🔄 تم فحص ومزامنة جداول قاعدة البيانات (${currentDialect}) بنجاح!`);
    return true;
  } catch (error) {
    console.error('❌ خطأ في الاتصال بقاعدة البيانات:');
    console.error(error.message);
    if (dialect === 'mysql') {
      console.warn('💡 تأكد من صحة بيانات الاتصال في ملف .env (DB_HOST, DB_NAME, DB_USER, DB_PASSWORD) ومن تشغيل خادم MySQL.');
    }
    return false;
  }
}

module.exports = {
  sequelize,
  initDatabase
};
