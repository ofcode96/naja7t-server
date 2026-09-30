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
function createTransporter(customPort = null, customSecure = null, customHost = null) {
  let host = customHost || (process.env.EMAIL_HOST || 'localhost').trim();
  const port = customPort || Number(process.env.EMAIL_PORT || 465);
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

  // إذا كان الهوست mail.naja7t.com والنطاق الأساسي مربوط بـ DNS خارجي (مثل Google)، فإن سيرفر بريد cPanel يربط محلياً عبر localhost أو api.naja7t.com
  if (host === 'mail.naja7t.com') {
    host = 'localhost';
  }

  const secure = customSecure !== null ? customSecure : (process.env.EMAIL_SECURE === 'true' || port === 465);

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
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
    ? `<img src="cid:naja7t-logo" alt="منصة نجحت التعليمية" width="130" style="display: block; width: 130px; max-width: 130px; height: auto; margin: 0 auto;" />`
    : `<div style="font-size: 24px; font-weight: 900; color: #ff6600; text-align: center; font-family: 'Segoe UI', Tahoma, sans-serif;">🎓 منصة نجحت</div>`;

  // قالب البريد المطور: مخصص للهاتف أولاً (Mobile-First)، يعتمد على جداول HTML والبرتقالي الصافي للعلامة التجارية
  const htmlContent = `
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml" lang="ar" dir="rtl">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${emailSubject}</title>
    </head>
    <body style="margin: 0; padding: 15px 5px; background-color: #f4f5f7; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, Arial, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; direction: rtl; text-align: right;">
      
      <!-- الحاوية الرئيسية المتوافقة مع جميع شاشات الهواتف -->
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f4f5f7;">
        <tr>
          <td align="center">
            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 480px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
              
              <!-- ترويسة الشعار الرسمي -->
              <tr>
                <td align="center" style="padding: 22px 15px 16px 15px; background-color: #ffffff;">
                  ${logoHtml}
                </td>
              </tr>

              <!-- شريط البراند البرتقالي الأنيق -->
              <tr>
                <td style="height: 4px; background: linear-gradient(90deg, #ff6600 0%, #ff8533 50%, #ffa726 100%); font-size: 0; line-height: 0;">&nbsp;</td>
              </tr>

              <!-- شارة نوع المنتج العلوية -->
              <tr>
                <td align="center" style="background-color: #fff7ed; padding: 12px 15px; border-bottom: 1px solid #ffedd5;">
                  <span style="font-size: 13px; font-weight: 800; color: #ea580c; background-color: #ffedd5; padding: 5px 14px; border-radius: 20px; display: inline-block;">
                    ${isBook ? '📚 تسليم الكتاب الإلكتروني' : '🎓 اشتراك الدورة التعليمية'}
                  </span>
                </td>
              </tr>

              <!-- المحتوى الرئيسي للرسالة -->
              <tr>
                <td style="padding: 24px 20px; direction: rtl; text-align: right; color: #1e293b; font-size: 15px; line-height: 1.7;">
                  
                  <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">
                    مرحباً ${customerName} 👋
                  </div>
                  
                  <p style="margin: 0 0 18px 0; color: #475569; font-size: 14px;">
                    ${isBook
                      ? 'شكراً لاختيارك منصة نجحت! تم تأكيد طلبك بنجاح، وأصبح كتابك الإلكتروني جاهزاً للتحميل المباشر وقراءته في أي وقت.'
                      : 'شكراً لاشتراكك في منصة نجحت التعليمية! تم تأكيد عملية الدفع بنجاح، ويسعدنا مرافقتك في مشوار تفوقك الدراسي.'}
                  </p>

                  ${isBook ? `
                    <!-- بطاقة تحميل الكتاب الإلكتروني (بدون أي كود تفعيل) -->
                    <div style="background-color: #fff7ed; border: 2px solid #fed7aa; border-radius: 14px; padding: 20px 14px; text-align: center; margin: 18px 0;">
                      <div style="font-size: 36px; line-height: 1; margin-bottom: 6px;">📖</div>
                      <div style="font-size: 16px; font-weight: 800; color: #9a3412; margin-bottom: 4px;">
                        نسختك الأصلية (PDF) جاهزة الآن!
                      </div>
                      <div style="font-size: 12px; color: #64748b; margin-bottom: 16px; line-height: 1.5;">
                        تم إعداد نسختك الرقمية بجودة عالية. يمكنك تحميلها والاحتفاظ بها على هاتفك للقراءة بدون إنترنت.
                      </div>
                      
                      <!-- زر التحميل الرئيسي المتناسق مع الهاتف -->
                      <table width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td align="center">
                            <a href="${finalDownloadLink}" target="_blank" style="background-color: #ff6600; background: linear-gradient(135deg, #ff7700 0%, #ff5500 100%); color: #ffffff !important; font-size: 16px; font-weight: 800; text-decoration: none; padding: 15px 20px; border-radius: 12px; display: block; width: 100%; box-sizing: border-box; text-align: center; box-shadow: 0 4px 14px rgba(255, 102, 0, 0.35);">
                              📥 اضغط هنا لتحميل الكتاب الآن (PDF)
                            </a>
                          </td>
                        </tr>
                      </table>
                    </div>

                    <!-- إرشادات للقارئ -->
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin: 16px 0; font-size: 12px; color: #64748b; line-height: 1.6;">
                      💡 <strong>نصيحة:</strong> يمكنك طباعة صفحات الكتاب للمراجعة الورقية أو قراءته عبر أي تطبيق PDF، ورابط التحميل متاح دائماً عبر هذا البريد.
                    </div>
                  ` : `
                    <!-- بطاقة كود التفعيل المخصص للدورة -->
                    <div style="background-color: #fff7ed; border: 2px dashed #ff6600; border-radius: 14px; padding: 18px 14px; text-align: center; margin: 18px 0;">
                      <div style="font-size: 13px; font-weight: 800; color: #c2410c; margin-bottom: 6px;">
                        🔑 كود التفعيل المخصص لحسابك
                      </div>
                      <div style="font-size: 26px; font-weight: 900; letter-spacing: 2px; color: #ea580c; background-color: #ffffff; border: 1px solid #fed7aa; padding: 10px 16px; border-radius: 10px; display: inline-block; font-family: 'Courier New', Courier, monospace; margin: 6px 0; -webkit-user-select: all; user-select: all;">
                        ${activationCode}
                      </div>
                      <div style="font-size: 11px; color: #9a3412; margin-top: 4px;">
                        اضغط مطولاً على الكود لنسخه واستخدامه عند التفعيل
                      </div>
                    </div>

                    <!-- زر الدخول للدورة المخصص للهاتف -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 18px 0;">
                      <tr>
                        <td align="center">
                          <a href="${finalAccessUrl || frontendUrl}" target="_blank" style="background-color: #ff6600; background: linear-gradient(135deg, #ff7700 0%, #ff5500 100%); color: #ffffff !important; font-size: 16px; font-weight: 800; text-decoration: none; padding: 15px 20px; border-radius: 12px; display: block; width: 100%; box-sizing: border-box; text-align: center; box-shadow: 0 4px 14px rgba(255, 102, 0, 0.35);">
                            🚀 الدخول إلى محتوى الدورة الآن
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- خطوات التفعيل السريعة للهاتف -->
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin: 16px 0; font-size: 13px; line-height: 1.6;">
                      <div style="font-weight: 800; color: #1e293b; margin-bottom: 6px;">📱 خطوات التفعيل في 3 خطوات بسيطة:</div>
                      <div style="color: #475569; margin: 3px 0;">1️⃣ اضغط على الزر البرتقالي أعلاه.</div>
                      <div style="color: #475569; margin: 3px 0;">2️⃣ سجّل دخولك بحسابك على المنصة.</div>
                      <div style="color: #475569; margin: 3px 0;">3️⃣ الصق كود التفعيل لتفتح لك كامل الدروس فوراً!</div>
                    </div>
                  `}

                  <!-- جدول تفاصيل الطلب المتناسق والمضبوط للهواتف -->
                  <table width="100%" cellpadding="8" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin: 16px 0; font-size: 13px; color: #334155; direction: rtl;">
                    <tr style="border-bottom: 1px solid #edf2f7;">
                      <td style="color: #64748b; padding: 8px 12px;"><strong>${isBook ? 'الكتاب:' : 'الدورة:'}</strong></td>
                      <td style="color: #0f172a; font-weight: bold; text-align: left; padding: 8px 12px;">${productName}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #edf2f7;">
                      <td style="color: #64748b; padding: 8px 12px;"><strong>سيريال الطلب:</strong></td>
                      <td style="color: #ea580c; font-family: monospace; font-weight: bold; text-align: left; padding: 8px 12px;">${serialNumber}</td>
                    </tr>
                    <tr>
                      <td style="color: #64748b; padding: 8px 12px;"><strong>حالة العملية:</strong></td>
                      <td style="color: #16a34a; font-weight: bold; text-align: left; padding: 8px 12px;">مؤكد ومدفوع بنجاح ✅</td>
                    </tr>
                  </table>

                  <p style="margin: 20px 0 0 0; font-size: 12px; color: #94a3b8; text-align: center;">
                    إذا واجهتك أي صعوبة، فريق الدعم الفني لمنصة نجحت جاهز لمساعدتك دائماً.
                  </p>
                </td>
              </tr>

              <!-- تذييل الرسالة -->
              <tr>
                <td style="background-color: #faf5f0; padding: 18px 15px; text-align: center; border-top: 1px solid #fed7aa; font-size: 12px; color: #78716c; line-height: 1.6;">
                  <div style="font-weight: 800; color: #44403c; margin-bottom: 3px;">منصة نجحت التعليمية 🎓</div>
                  <div>طريقك نحو التميز والتفوق الدراسي</div>
                  <div style="margin-top: 6px; font-size: 11px; color: #a8a29e;">
                    جميع الحقوق محفوظة © ${new Date().getFullYear()} Naja7t Platform
                  </div>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>

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
    const fallbackHost = 'localhost';
    console.log(`🔄 [SMTP Fallback] جاري تجربة الإرسال عبر المضيف المحلي (${fallbackHost}) والمنفذ Port ${fallbackPort}...`);

    try {
      const fallbackTransporter = createTransporter(fallbackPort, fallbackPort === 465, fallbackHost);
      const info = await fallbackTransporter.sendMail({
        from: fromAddress,
        to: toEmail.trim(),
        subject: emailSubject,
        html: htmlContent,
        attachments: attachments
      });

      console.log(`✉️ [SMTP Sent Successfully] (Localhost Port ${fallbackPort} Fallback) تم إرسال البريد لـ (${toEmail})! ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId, port: fallbackPort, host: fallbackHost };
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
