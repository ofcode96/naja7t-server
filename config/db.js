const mysql = require('mysql2/promise');
require('dotenv').config();

// إعداد مجمع الاتصالات لـ MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'naja7t_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// فحص الاتصال بقاعدة البيانات بشكل آمن
async function checkConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ تم الاتصال بنجاح بقاعدة البيانات MySQL!');
    connection.release();
    return true;
  } catch (err) {
    console.warn('⚠️  تنبيه الاتصال بقاعدة البيانات MySQL:', err.message);
    console.warn('ℹ️  السيرفر يعتمد حالياً وضع المحاكاة (Mock Mode) لنقاط النهاية.');
    return false;
  }
}

module.exports = {
  pool,
  checkConnection
};
