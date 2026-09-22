const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * محاولة الإرسال عبر Brevo HTTP API المباشر (Port 443 - غير محظور في الاستضافات)
 */
async function sendViaBrevoApi({ toEmail, customerName, serialNumber, activationCode, productName, htmlContent }) {
  const apiKey = (process.env.EMAIL_PASS || '').trim();
  if (!apiKey.startsWith('xkeysib-')) {
    throw new Error('ليس مفتاح Brevo API صريح (xkeysib-).');
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
    return { success: true, messageId: data.messageId || 'brevo-api-ok', provider: 'Brevo HTTP API' };
  } else {
    throw new Error(data.message || JSON.stringify(data));
  }
}

/**
 * محاولة الإرسال عبر Resend HTTP API المباشر (Port 443 - غير محظور في الاستضافات)
 */
async function sendViaResendApi({ toEmail, customerName, serialNumber, activationCode, productName, htmlContent }) {
  const apiKey = (process.env.RESEND_API_KEY || process.env.EMAIL_PASS || '').trim();
  if (!apiKey.startsWith('re_')) {
    throw new Error('ليس مفتاح Resend API صريح (re_).');
  }

  const senderEmail = process.env.EMAIL_USER && !process.env.EMAIL_USER.includes('@gmail.com')
    ? process.env.EMAIL_USER
    : 'onboarding@resend.dev';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `منصة نجحت التعليمية <${senderEmail}>`,
      to: [toEmail.trim()],
      subject: `🎓 كود التفعيل وسيريال الشراء الخاص بك - منصة نجحت (${productName})`,
      html: htmlContent
    })
  });

  const data = await response.json();
  if (response.ok) {
    return { success: true, messageId: data.id || 'resend-api-ok', provider: 'Resend HTTP API' };
  } else {
    throw new Error(data.message || JSON.stringify(data));
  }
}

/**
 * إنشاء ناقل Nodemailer تقليدي للمستضيفات المحلية أو السيرفرات التي تسمح بـ SMTP
 */
function createTransporter(customPort = null, customSecure = null) {
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = customPort || Number(process.env.EMAIL_PORT || 587);
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass || pass.includes('your_') || user.includes('your_')) {
    return null;
  }

  const isGmail = (user && user.toLowerCase().includes('@gmail.com')) || (host && host.toLowerCase().includes('gmail'));

  if (isGmail) {
    const isSecure = customSecure !== null ? customSecure : (port === 465);
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: port,
      secure: isSecure,
      auth: { user, pass },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  const secure = customSecure !== null ? customSecure : (process.env.EMAIL_SECURE === 'true' || port === 465);

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
 * دالة إرسال بريد إلكتروني تلقائي للزبون (يدعم الدورات بالأكواد والكتب بروابط التحميل المباشرة)
 */
async function sendPurchaseConfirmationEmail({
  toEmail,
  customerName = 'طالب نجحت',
  serialNumber,
  activationCode,
  productName = 'دورة منصة نجحت التعليمية',
  productType = 'course',
  downloadUrl = null
}) {
  if (!toEmail || !toEmail.trim() || !toEmail.includes('@')) {
    console.log(`ℹ️ [Email Service] لم يتم إرسال بريد لـ (${serialNumber}): البريد الإلكتروني غير متوفر أو غير صالِح.`);
    return { success: false, reason: 'No valid recipient email provided' };
  }

  const frontendUrl = process.env.FRONTEND_URL || 'https://naja7t.com';
  const isBook = (productType === 'book' || productType === 'digital' || !!downloadUrl);
  const finalDownloadLink = downloadUrl || `${frontendUrl}/api/products/download/${serialNumber}`;

  const emailSubject = isBook
    ? `📚 كتابك الإلكتروني جاهز للتحميل - منصة نجحت (${productName})`
    : `🎓 كود التفعيل وسيريال الشراء الخاص بك - منصة نجحت (${productName})`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>${isBook ? 'تحميل الكتاب الإلكتروني' : 'تأكيد وتفعيل الشراء'} - منصة نجحت</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; margin: 0; padding: 20px; color: #333; direction: rtl; text-align: right; }
        .container { max-width: 600px; background: #ffffff; margin: 20px auto; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08); border: 1px solid #e1e8e5; }
        .header { background: linear-gradient(135deg, ${isBook ? '#0284c7 0%, #0369a1 100%' : '#10b981 0%, #059669 100%'}); color: white; padding: 30px 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
        .content { padding: 30px 25px; line-height: 1.8; }
        .welcome { font-size: 18px; font-weight: 600; color: ${isBook ? '#0369a1' : '#065f46'}; margin-bottom: 15px; }
        .card { background: ${isBook ? '#f0f9ff' : '#f0fdf4'}; border-right: 4px solid ${isBook ? '#0284c7' : '#10b981'}; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .code-box { background: #111827; color: #10b981; font-family: monospace; font-size: 22px; font-weight: bold; text-align: center; padding: 15px; border-radius: 8px; letter-spacing: 2px; margin: 20px 0; }
        .download-box { background: #f8fafc; border: 2px dashed #0284c7; padding: 25px; text-align: center; border-radius: 10px; margin: 25px 0; }
        .btn { display: inline-block; background-color: ${isBook ? '#0284c7' : '#10b981'}; color: white !important; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; text-align: center; font-size: 16px; margin-top: 10px; }
        .footer { background: #f9fafb; padding: 15px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${isBook ? '📚' : '🎓'} منصة نجحت التعليمية</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">${isBook ? 'تسليم وتأكيد استلام كتابك الإلكتروني' : 'تأكيد وتفعيل تفاصيل حسابك'}</p>
        </div>
        <div class="content">
          <div class="welcome">مرحباً ${customerName}،</div>
          <p>شكراً لثقتك واقتنائك من منصة نجحت! تم تأكيد عملية الدفع وإتمام الطلب بنجاح.</p>
          
          <div class="card">
            <div style="font-weight: bold; margin-bottom: 8px; color: ${isBook ? '#0369a1' : '#047857'};">📦 تفاصيل الطلب:</div>
            <div><strong>${isBook ? 'الكتاب / المنتج الرقمي:' : 'الدورة / المنتج:'}</strong> ${productName}</div>
            <div><strong>سيريال الزبون الخاص بك:</strong> <span style="color: ${isBook ? '#0284c7' : '#10b981'}; font-weight: bold;">${serialNumber}</span></div>
          </div>

          ${isBook ? `
            <div class="download-box">
              <div style="font-size: 18px; font-weight: bold; color: #0f172a; margin-bottom: 8px;">📥 نسختك الإلكترونية (PDF) جاهزة الآن!</div>
              <p style="color: #64748b; font-size: 14px; margin-bottom: 15px;">يمكنك تحميل نسختك وحفظها على هاتفك أو حاسوبك وقراءتها في أي وقت بدون إنترنت.</p>
              <a href="${finalDownloadLink}" class="btn" target="_blank">📥 تحميل كتابك بصيغة PDF الآن</a>
            </div>
          ` : `
            <p style="font-weight: bold; margin-bottom: 5px;">🔑 كود التفعيل المخصص لك:</p>
            <div class="code-box">${activationCode}</div>
            <p>يمكنك استخدام هذا الكود لتفعيل اشتراكك والدخول إلى كافة دروس ومحتويات الدورة.</p>
            <div style="text-align: center;">
              <a href="${frontendUrl}" class="btn">الانتقال إلى المنصة والتفعيل</a>
            </div>
          `}
        </div>
        <div class="footer">
          جميع الحقوق محفوظة © ${new Date().getFullYear()} منصة نجحت التعليمية
        </div>
      </div>
    </body>
    </html>
  `;

  const emailPass = (process.env.EMAIL_PASS || '').trim();
  const resendApiKey = (process.env.RESEND_API_KEY || '').trim();

  // 1. تجربة Resend HTTP API (إذا بدأ المفتاح بـ re_)
  if (resendApiKey.startsWith('re_') || emailPass.startsWith('re_')) {
    try {
      const apiResult = await sendViaResendApi({
        toEmail,
        customerName,
        serialNumber,
        activationCode,
        productName,
        htmlContent
      });
      console.log(`✉️ [Resend API Success] تم إرسال بريد التأكيد إلى (${toEmail})! ID: ${apiResult.messageId}`);
      return apiResult;
    } catch (apiError) {
      console.warn(`⚠️ [Resend API Error]: ${apiError.message}`);
    }
  }

  // 2. تجربة Brevo HTTP API (إذا بدأ المفتاح بـ xkeysib-)
  if (emailPass.startsWith('xkeysib-')) {
    try {
      const apiResult = await sendViaBrevoApi({
        toEmail,
        customerName,
        serialNumber,
        activationCode,
        productName,
        htmlContent
      });
      console.log(`✉️ [Brevo API Success] تم إرسال بريد التأكيد إلى (${toEmail})! ID: ${apiResult.messageId}`);
      return apiResult;
    } catch (apiError) {
      console.warn(`⚠️ [Brevo API Error]: ${apiError.message}`);
    }
  }

  // 3. المحاولة عبر SMTP (قد يفشل على Render بسبب حظر منافذ SMTP 25/465/587)
  const rawUser = process.env.EMAIL_USER || 'oussamabvb201283@gmail.com';
  const cleanEmail = rawUser.replace(/.*<|>.*/g, '').trim();
  const fromAddress = `"منصة نجحت التعليمية" <${cleanEmail}>`;

  const primaryPort = Number(process.env.EMAIL_PORT || 587);
  let transporter = createTransporter(primaryPort);

  if (!transporter) {
    console.warn(`⚠️ [Email Service] لم يتم تهيئة إعدادات SMTP في ملف .env. تم تجاوز الإرسال لـ ${toEmail}`);
    return { success: false, reason: 'SMTP credentials not configured in .env' };
  }

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: toEmail.trim(),
      subject: `🎓 كود التفعيل وسيريال الشراء الخاص بك - منصة نجحت (${productName})`,
      html: htmlContent
    });

    console.log(`✉️ [SMTP Sent Successfully] (Port ${primaryPort}) تم إرسال بريد التأكيد إلى (${toEmail}) برقم سيريال (${serialNumber})! ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId, port: primaryPort };
  } catch (err) {
    console.error(`❌ [SMTP Dispatch Error - Port ${primaryPort}] تعذر الإرسال إلى (${toEmail}):`, err.message);

    const fallbackPort = primaryPort === 465 ? 587 : 465;
    console.log(`🔄 [SMTP Fallback] جاري تجربة الإرسال عبر المنفذ البديل Port ${fallbackPort}...`);

    try {
      const fallbackTransporter = createTransporter(fallbackPort, fallbackPort === 465);
      const info = await fallbackTransporter.sendMail({
        from: fromAddress,
        to: toEmail.trim(),
        subject: `🎓 كود التفعيل وسيريال الشراء الخاص بك - منصة نجحت (${productName})`,
        html: htmlContent
      });

      console.log(`✉️ [SMTP Sent Successfully] (Port ${fallbackPort} Fallback) تم إرسال البريد لـ (${toEmail})! ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId, port: fallbackPort };
    } catch (fallbackErr) {
      console.error(`❌ [SMTP Fallback Error - Port ${fallbackPort}] فشل الإرسال أيضاً:`, fallbackErr.message);
      return {
        success: false,
        error: `Render blocks raw SMTP socket connections (${err.message}). Please use Resend API Key (re_...) or Brevo API Key (xkeysib-...) in EMAIL_PASS.`,
        fallbackError: fallbackErr.message
      };
    }
  }
}

module.exports = {
  sendPurchaseConfirmationEmail
};
