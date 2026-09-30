const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

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
  const host = (process.env.EMAIL_HOST || 'smtp.gmail.com').trim();
  const port = customPort || Number(process.env.EMAIL_PORT || 587);
  const rawUser = process.env.EMAIL_USER;
  const rawPass = process.env.EMAIL_PASS;

  if (!rawUser || !rawPass || rawPass.includes('your_') || rawUser.includes('your_')) {
    return null;
  }

  // تنظيف البريد وكلمة المرور من أي مسافات زائدة أو علامات تنصيص قد تضاف بالخطأ في cPanel
  const user = rawUser.trim().replace(/^['"]|['"]$/g, '');
  const pass = rawPass.trim().replace(/^['"]|['"]$/g, '').replace(/\s+/g, '');

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
  downloadUrl = null,
  accessUrl = null
}) {
  if (!toEmail || !toEmail.trim() || !toEmail.includes('@')) {
    console.log(`ℹ️ [Email Service] لم يتم إرسال بريد لـ (${serialNumber}): البريد الإلكتروني غير متوفر أو غير صالِح.`);
    return { success: false, reason: 'No valid recipient email provided' };
  }

  const frontendUrl = process.env.FRONTEND_URL || 'https://naja7t.com';
  const isBook = (productType === 'book' || productType === 'digital' || productType === 'ebook' || !!downloadUrl);
  const finalDownloadLink = downloadUrl || `${frontendUrl}/api/products/download/${serialNumber}`;
  const finalAccessUrl = accessUrl || null;

  const emailSubject = isBook
    ? `📚 كتابك الإلكتروني جاهز للتحميل - منصة نجحت (${productName})`
    : `🎓 كود التفعيل وسيريال الشراء الخاص بك - منصة نجحت (${productName})`;

  // التحقق من وجود ملف الشعار الرسمي لتضمينه كـ CID Attachment
  const logoPath = path.join(__dirname, '..', 'public', 'logo.png');
  const hasLogo = fs.existsSync(logoPath);
  const attachments = hasLogo ? [{
    filename: 'logo.png',
    path: logoPath,
    cid: 'naja7t-logo'
  }] : [];

  const logoHtml = hasLogo
    ? `<img src="cid:naja7t-logo" alt="منصة نجحت التعليمية" style="max-height: 75px; width: auto; display: block; margin: 0 auto;" />`
    : `<div style="font-size: 26px; font-weight: 800; color: #ff6600; text-align: center;">🎓 منصة نجحت</div>`;

  // قالب البريد المخصص (RTL بالكامل وبألوان البراند الرسمية)
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${emailSubject}</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, Arial, sans-serif;
          background-color: #f1f5f9;
          margin: 0;
          padding: 20px 10px;
          color: #1e293b;
          direction: rtl;
          text-align: right;
        }
        .email-wrapper {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 10px 25px rgba(0,0,0,0.06);
          border: 1px solid #e2e8f0;
        }
        .header-logo {
          background-color: #ffffff;
          padding: 25px 20px 15px 20px;
          text-align: center;
          border-bottom: 2px solid #f8fafc;
        }
        .banner {
          background: linear-gradient(135deg, ${isBook ? '#1e40af 0%, #3b82f6 100%' : '#ea580c 0%, #ff6600 100%'});
          color: #ffffff;
          padding: 20px;
          text-align: center;
        }
        .banner h1 {
          margin: 0;
          font-size: 22px;
          font-weight: 800;
        }
        .banner p {
          margin: 6px 0 0 0;
          font-size: 14px;
          opacity: 0.95;
        }
        .content {
          padding: 30px 25px;
          line-height: 1.8;
        }
        .greeting {
          font-size: 19px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 12px;
        }
        .order-card {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-right: 4px solid ${isBook ? '#3b82f6' : '#ff6600'};
          border-radius: 10px;
          padding: 18px 20px;
          margin: 22px 0;
        }
        .order-card-title {
          font-weight: 700;
          font-size: 15px;
          color: ${isBook ? '#1d4ed8' : '#c2410c'};
          margin-bottom: 10px;
        }
        .order-row {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          font-size: 14px;
        }
        .badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
        }
        .badge-success {
          background-color: #dcfce7;
          color: #15803d;
        }
        .code-container {
          background: #0f172a;
          border: 2px dashed #ff6600;
          border-radius: 12px;
          padding: 22px;
          text-align: center;
          margin: 25px 0;
        }
        .code-title {
          font-size: 14px;
          color: #fed7aa;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .code-value {
          font-size: 26px;
          font-weight: 900;
          letter-spacing: 3px;
          color: #ff6600;
          font-family: monospace;
          background: #1e293b;
          padding: 10px 20px;
          border-radius: 8px;
          display: inline-block;
          margin: 6px 0;
        }
        .code-note {
          font-size: 12px;
          color: #94a3b8;
          margin-top: 8px;
        }
        .download-container {
          background: #eff6ff;
          border: 2px solid #bfdbfe;
          border-radius: 12px;
          padding: 25px 20px;
          text-align: center;
          margin: 25px 0;
        }
        .download-title {
          font-size: 17px;
          font-weight: 800;
          color: #1e3a8a;
          margin-bottom: 8px;
        }
        .download-desc {
          font-size: 14px;
          color: #475569;
          margin: 0 0 18px 0;
          line-height: 1.6;
        }
        .steps-card {
          background-color: #fff7ed;
          border: 1px solid #ffedd5;
          border-radius: 10px;
          padding: 16px 20px;
          margin: 20px 0;
          font-size: 14px;
        }
        .steps-title {
          font-weight: 700;
          color: #9a3412;
          margin-bottom: 8px;
        }
        .step-item {
          margin: 6px 0;
          color: #7c2d12;
        }
        .btn-action {
          display: inline-block;
          background-color: ${isBook ? '#2563eb' : '#ff6600'};
          color: #ffffff !important;
          padding: 14px 32px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 700;
          font-size: 16px;
          text-align: center;
          margin: 10px auto;
          box-shadow: 0 4px 12px ${isBook ? 'rgba(37,99,235,0.3)' : 'rgba(255,102,0,0.3)'};
        }
        .footer {
          background-color: #f8fafc;
          padding: 20px;
          text-align: center;
          font-size: 13px;
          color: #64748b;
          border-top: 1px solid #e2e8f0;
          line-height: 1.6;
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <!-- شعار منصة نجحت الرسمي -->
        <div class="header-logo">
          ${logoHtml}
        </div>

        <!-- البانر العلوي -->
        <div class="banner">
          <h1>${isBook ? '📚 تسليم الكتاب الإلكتروني' : '🎓 تأكيد وتفعيل الاشتراك'}</h1>
          <p>${isBook ? 'نسختك الإلكترونية الرقمية الأصلية جاهزة للتحميل' : 'مبارك انضمامك لأسرة منصة نجحت التعليمية'}</p>
        </div>

        <!-- محتوى الرسالة -->
        <div class="content">
          <div class="greeting">مرحباً ${customerName}،</div>
          <p>
            ${isBook
              ? 'شكراً لاختيارك منصة نجحت التعليمية! تم تأكيد عملية الدفع بنجاح وأصبح كتابك الرقمي جاهزاً للتحميل المباشر.'
              : 'شكراً لثقتك واشتراكك في منصة نجحت التعليمية! تم استلام وتأكيد عملية الدفع بنجاح، ويسعدنا مرافقتك في مشوار تفوقك الدراسي.'}
          </p>

          <!-- بطاقة تفاصيل الطلب -->
          <div class="order-card">
            <div class="order-card-title">📦 تفاصيل طلب الشراء:</div>
            <div class="order-row">
              <strong>${isBook ? 'الكتاب المطلوب:' : 'الدورة التدريبية:'}</strong>
              <span>${productName}</span>
            </div>
            <div class="order-row">
              <strong>رقم السيريال الخاص بك:</strong>
              <span style="font-family: monospace; font-weight: bold; color: ${isBook ? '#2563eb' : '#ff6600'};">${serialNumber}</span>
            </div>
            <div class="order-row">
              <strong>حالة العملية:</strong>
              <span class="badge badge-success">مدفوع ومؤكد بنجاح ✅</span>
            </div>
          </div>

          ${isBook ? `
            <!-- بطاقة تحميل الكتاب الإلكتروني (بدون أي كود تفعيل) -->
            <div class="download-container">
              <div style="font-size: 38px; margin-bottom: 8px;">📖</div>
              <div class="download-title">نسختك الأصلية بصيغة (PDF) جاهزة الآن!</div>
              <p class="download-desc">
                يمكنك تحميل الكتاب وحفظه على هاتفك الذكي أو جهازك اللوحي أو الحاسوب، والاطلاع عليه ومراجعته في أي وقت بدون إنترنت.
              </p>
              <div style="text-align: center; margin: 15px 0;">
                <a href="${finalDownloadLink}" class="btn-action" target="_blank">📥 تحميل الكتاب الإلكتروني (PDF)</a>
              </div>
            </div>

            <div class="steps-card">
              <div class="steps-title">💡 نصيحة للقارئ:</div>
              <div class="step-item">• يمكنك طباعة صفحات الكتاب للمراجعة الورقية أو قراءته عبر أي تطبيق يدعم PDF.</div>
              <div class="step-item">• رابط التحميل متاح دائماً، ويمكنك العودة لهذا البريد في أي وقت لإعادة التحميل.</div>
            </div>
          ` : `
            <!-- بطاقة كود التفعيل المخصص للدورة -->
            <div class="code-container">
              <div class="code-title">🔑 كود التفعيل المخصص لحسابك (Activation Code):</div>
              <div class="code-value">${activationCode}</div>
              <div class="code-note">احتفظ بهذا الكود، ستقوم باستخدامه عند تفعيل الدورة لفتح كافة الدروس.</div>
            </div>

            ${finalAccessUrl ? `
              <div style="text-align: center; margin: 20px 0;">
                <a href="${finalAccessUrl}" class="btn-action" target="_blank">🚀 الدخول إلى محتوى الدورة الآن</a>
              </div>
            ` : `
              <div style="text-align: center; margin: 20px 0;">
                <a href="${frontendUrl}" class="btn-action" target="_blank">🚀 الانتقال إلى المنصة والتفعيل</a>
              </div>
            `}

            <!-- خطوات التفعيل السريعة -->
            <div class="steps-card">
              <div class="steps-title">📝 خطوات تفعيل الدورة في 3 خطوات بسيطة:</div>
              <div class="step-item">1️⃣ اضغط على زر <strong>"الدخول إلى محتوى الدورة"</strong> أعلاه.</div>
              <div class="step-item">2️⃣ سجّل دخولك إلى حسابك (أو أنشئ حساباً جديداً بالبريد الإلكتروني).</div>
              <div class="step-item">3️⃣ الصق كود التفعيل الموضح أعلاه لتفتح لك كافة الدروس والتطبيقات فوراً!</div>
            </div>
          `}

          <p style="margin-top: 25px; font-size: 14px; color: #64748b;">
            إذا واجهتك أي صعوبة أو كان لديك أي استفسار، فريق الدعم الفني لمنصة نجحت جاهز لمساعدتك في أي وقت.
          </p>
        </div>

        <!-- التذييل -->
        <div class="footer">
          <div>منصة نجحت التعليمية - طريقك نحو التفوق والنجاح 🎓</div>
          <div style="margin-top: 6px; font-size: 12px; color: #94a3b8;">
            جميع الحقوق محفوظة © ${new Date().getFullYear()} Naja7t Platform
          </div>
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

  // 3. المحاولة عبر SMTP (يدعم Octenium Hosting و cPanel و Gmail)
  const rawUser = process.env.EMAIL_USER || 'contact@naja7t.com';
  const cleanEmail = rawUser.replace(/.*<|>.*/g, '').trim();
  const customFrom = process.env.EMAIL_FROM ? process.env.EMAIL_FROM.trim() : `"منصة نجحت التعليمية" <${cleanEmail}>`;
  const fromAddress = customFrom.includes('@') ? customFrom : `"منصة نجحت التعليمية" <${cleanEmail}>`;

  const primaryPort = Number(process.env.EMAIL_PORT || 465);
  let transporter = createTransporter(primaryPort);

  if (!transporter) {
    let reason = 'SMTP credentials not configured in .env';
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      reason = 'EMAIL_USER or EMAIL_PASS is missing in environment (.env not loaded or variables empty)';
    } else if (process.env.EMAIL_PASS.includes('your_') || process.env.EMAIL_USER.includes('your_')) {
      reason = 'EMAIL_PASS or EMAIL_USER still contains template placeholder (your_...)';
    }
    console.warn(`⚠️ [Email Service] ${reason}. تم تجاوز الإرسال لـ ${toEmail}`);
    return { success: false, reason };
  }

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: toEmail.trim(),
      subject: emailSubject,
      html: htmlContent,
      attachments: attachments
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
        subject: emailSubject,
        html: htmlContent,
        attachments: attachments
      });

      console.log(`✉️ [SMTP Sent Successfully] (Port ${fallbackPort} Fallback) تم إرسال البريد لـ (${toEmail})! ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId, port: fallbackPort };
    } catch (fallbackErr) {
      console.error(`❌ [SMTP Fallback Error - Port ${fallbackPort}] فشل الإرسال أيضاً:`, fallbackErr.message);
      return {
        success: false,
        error: err.message,
        fallbackError: fallbackErr.message
      };
    }
  }
}

module.exports = {
  sendPurchaseConfirmationEmail
};
