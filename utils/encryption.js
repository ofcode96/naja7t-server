const crypto = require('crypto');
require('dotenv').config();

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY_RAW = process.env.ENCRYPTION_SECRET || 'naja7t_secret_key_encryption_2026_dzd';
// تحويل المفتاح ليكون بطول 32 باييت دقيق لـ AES-256
const KEY = crypto.createHash('sha256').update(String(SECRET_KEY_RAW)).digest();

/**
 * تشفير كائن أو بيانات وإرجاع نص مشفر آمن للروابط (URL-safe string)
 * @param {object|string} data البيانات المراد تشفيرها
 * @returns {string} النص المشفر
 */
function encryptData(data) {
  try {
    const text = typeof data === 'object' ? JSON.stringify(data) : String(data);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // دمج متجه التهيئة IV مع البيانات المشفرة
    const combined = `${iv.toString('hex')}:${encrypted}`;
    return Buffer.from(combined).toString('base64url');
  } catch (err) {
    console.error('خطأ في تشفير البيانات:', err.message);
    throw err;
  }
}

/**
 * فك تشفير النص واسترجاع البيانات الأصلية
 * @param {string} token النص المشفر الممرر في الرابط
 * @returns {object|string} البيانات المكتشفة الأصلية
 */
function decryptData(token) {
  try {
    if (!token) return null;
    const combined = Buffer.from(token, 'base64url').toString('utf8');
    const [ivHex, encryptedText] = combined.split(':');
    
    if (!ivHex || !encryptedText) {
      throw new Error('صيغة التوكين المشفر غير صحيحة');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    try {
      return JSON.parse(decrypted);
    } catch (e) {
      return decrypted;
    }
  } catch (err) {
    console.error('خطأ في فك تشفير البيانات:', err.message);
    return null;
  }
}

/**
 * توليد رابط النجاح المتضمن لبارامتر كويري مشفر بأمان
 * @param {string} baseUrl رابط صفحة النجاح الأساسي
 * @param {object} purchaseData بيانات عملية الشراء
 * @returns {string} الرابط النهائي للنجاح ومعه التوكين المشفر
 */
function generateSuccessUrl(baseUrl, purchaseData) {
  const targetBase = baseUrl || process.env.PAYMENT_SUCCESS_URL || 'https://naja7t.com/payment/success';
  const token = encryptData(purchaseData);
  const separator = targetBase.includes('?') ? '&' : '?';
  return `${targetBase}${separator}data=${encodeURIComponent(token)}`;
}

module.exports = {
  encryptData,
  decryptData,
  generateSuccessUrl
};
