const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * محاولة الإرسال عبر Brevo HTTP API المباشر على المنفذ 443 (مضمون 100% بدون Timeout على Render)
 */
async function sendViaBrevoApi({ toEmail, customerName, serialNumber, activationCode, productName, htmlContent }) {
  const apiKey = process.env.EMAIL_PASS;
  if (!apiKey || apiKey.includes('your_') || apiKey.includes('placeholder')) {
    throw new Error('مفتاح EMAIL_PASS غير مفعل للـ API.');
  }

  const user = process.env.EMAIL_USER || 'baa227001@smtp-brevo.com';
  const cleanUser = user.replace(/.*<|>.*/g, '').trim();

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: 'منصة نجحت التعليمية', email: cleanUser },
      to: [{ email: toEmail.trim(), name: customerName }],
      subject: `🎓 كود التفعيل وسيريال الشراء الخاص بك - منصة نجحت (${productName})`,
      htmlContent: htmlContent
    })
  });

  const data = await response.json();
  if (response.ok) {
    return { success: true, messageId: data.messageId || 'brevo-api-ok' };
  } else {
    throw new Error(data.message || JSON.stringify(data));
  }
}

/**
 * إنشاء ناقل Nodemailer SMTP احتياطي مع ضبط مهلة الاتصال لمنع التعليق
 */
function createTransporter() {
  const host = process.env.EMAIL_HOST || 'smtp-relay.brevo.com';
  const port = Number(process.env.EMAIL_PORT || 587);
  const secure = process.env.EMAIL_SECURE === 'true' || port === 465;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass || pass.includes('your_') || user.includes('your_')) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    tls: {
      rejectUnauthorized: false
    }
  });
}

/**
 * دالة إرسال بريد إلكتروني تلقائي للزبون يحتوي على السيريال كود وكود التفعيل
 */
async function sendPurchaseConfirmationEmail({
  toEmail,
  customerName = 'طالب نجحت',
  serialNumber,
  activationCode,
  productName = 'دورة منصة نجحت التعليمية'
}) {
  if (!toEmail || !toEmail.trim() || !toEmail.includes('@')) {
    console.log(`ℹ️ [Email Service] لم يتم إرسال بريد لـ (${serialNumber}): البريد الإلكتروني غير متوفر أو غير صالِح.`);
    return { success: false, reason: 'No valid recipient email provided' };
  }

  const frontendUrl = process.env.FRONTEND_URL || 'https://naja7t.com';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تأكيد وتفعيل الشراء - منصة نجحت</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; margin: 0; padding: 20px; color: #333; direction: rtl; text-align: right; }
        .container { max-width: 600px; background: #ffffff; margin: 20px auto; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08); border: 1px solid #e1e8e5; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
        .content { padding: 30px 25px; line-height: 1.8; }
        .welcome { font-size: 18px; font-weight: 600; color: #065f46; margin-bottom: 15px; }
        .card { background: #f0fdf4; border-right: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .code-box { background: #111827; color: #10b981; font-family: monospace; font-size: 22px; font-weight: bold; text-align: center; padding: 15px; border-radius: 8px; letter-spacing: 2px; margin: 20px 0; }
        .btn { display: inline-block; background-color: #10b981; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; text-align: center; margin-top: 15px; }
        .footer { background: #f9fafb; padding: 15px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎓 منصة نجحت التعليمية</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">تأكيد وتفعيل تفاصيل حسابك</p>
        </div>
        <div class="content">
          <div class="welcome">مرحباً ${customerName}،</div>
          <p>شكراً لثقتك واشتراكك في منصة نجحت! تم إتمام عملية الشراء بنجاح وتأكيد الدفع الخاص بك.</p>
          
          <div class="card">
            <div style="font-weight: bold; margin-bottom: 8px; color: #047857;">📦 تفاصيل الاشتراك:</div>
            <div><strong>الدورة / المنتج:</strong> ${productName}</div>
            <div><strong>سيريال الزبون الخاص بك:</strong> <span style="color: #10b981; font-weight: bold;">${serialNumber}</span></div>
          </div>

          <p style="font-weight: bold; margin-bottom: 5px;">🔑 كود التفعيل المخصص لك:</p>
          <div class="code-box">${activationCode}</div>

          <p>يمكنك استخدام هذا الكود لتفعيل اشتراكك والدخول إلى كافة دروس ومحتويات الدورة.</p>
          
          <div style="text-align: center;">
            <a href="${frontendUrl}" class="btn">الانتقال إلى المنصة والتفعيل</a>
          </div>
        </div>
        <div class="footer">
          جميع الحقوق محفوظة © ${new Date().getFullYear()} منصة نجحت التعليمية
        </div>
      </div>
    </body>
    </html>
  `;

  // 1. المحاولة الأولى: عبر Brevo HTTP API المباشر السريع (منفذ 443)
  try {
    const apiResult = await sendViaBrevoApi({
      toEmail,
      customerName,
      serialNumber,
      activationCode,
      productName,
      htmlContent
    });
    console.log(`✉️ [Brevo API Success] تم إرسال بريد التأكيد إلى (${toEmail}) برقم سيريال (${serialNumber})! ID: ${apiResult.messageId}`);
    return apiResult;
  } catch (apiError) {
    console.warn(`⚠️ [Brevo API Fallback] تعذر الإرسال عبر HTTP API (${apiError.message})، المحاولة عبر Nodemailer SMTP...`);
  }

  // 2. المحاولة الثانية: عبر Nodemailer SMTP الاحتياطي
  const transporter = createTransporter();
  if (!transporter) {
    console.warn(`⚠️ [Email Service] لم يتم تهيئة إعدادات SMTP في ملف .env. تم تجاوز الإرسال لـ ${toEmail}`);
    return { success: false, reason: 'SMTP credentials not configured in .env' };
  }

  const fromAddress = process.env.EMAIL_FROM || `"منصة نجحت التعليمية" <${process.env.EMAIL_USER}>`;

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: toEmail.trim(),
      subject: `🎓 كود التفعيل وسيريال الشراء الخاص بك - منصة نجحت (${productName})`,
      html: htmlContent
    });

    console.log(`✉️ [SMTP Sent Successfully] تم إرسال بريد التأكيد إلى (${toEmail}) برقم سيريال (${serialNumber})! ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ [SMTP Dispatch Error] تعذر إرسال البريد إلى (${toEmail}):`, err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendPurchaseConfirmationEmail
};
