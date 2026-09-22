# 📖 التوثيق النهائي المباشر والكامل لـ API منصة نجحت (Naja7t Server API v2.5)

هذا التوثيق يحتوي على شرح **جميع المسارات ونقاط النهاية (Endpoints)** بدون أي استثناء، مع تبيان نوع الطلب (HTTP Method)، الرابط، الهيدرات، جسم الطلب (JSON Request Body)، ونماذج الاستجابات (JSON Responses)، بالإضافة إلى دعم **المنتجات الرقمية (الكتب بصيغة PDF)** بجانب **الدورات التعليمية**.

---

## 📍 الفهرس الشامل
1. [نظرة عامة والفرق بين الدورات والكتب](#1-نظرة-عامة-والفرق-بين-الدورات-والكتب)
2. [جدول المنتجات والكتب (Products & Books CRUD)](#2-جدول-المنتجات-والكتب-products--books-crud)
3. [مسار تحميل الكتب الإلكترونية الآمن (Secure Download API)](#3-مسار-تحميل-الكتب-الإلكترونية-الآمن-secure-download-api)
4. [مسارات الشراء والدفع والتسليم (Purchase & Webhook API)](#4-مسارات-الشراء-والدفع-والتسليم-purchase--webhook-api)
5. [جدول العملاء والعمليات وإعادة الإرسال (Customers API)](#5-جدول-العملاء-والعمليات-وإعادة-الإرسال-customers-api)
6. [جدول أكواد التفعيل (Activation Codes CRUD)](#6-جدول-أكواد-التفعيل-activation-codes-crud)
7. [جدول التلاميذ والنتائج (Students & Quiz API)](#7-جدول-التلاميذ-والنتائج-students--quiz-api)
8. [مسارات الإدارة وفحص الاتصال (Admin API)](#8-مسارات-الإدارة-وفحص-الاتصال-admin-api)

---

## 1. نظرة عامة والفرق بين الدورات والكتب

يدعم سيرفر منصة نجحت نوعين من المنتجات الرقمية:

| الخاصية | الدورات التعليمية (`course`) | الكتب والملفات الرقمية (`book` / `digital`) |
| :--- | :--- | :--- |
| **كود التفعيل (`activation_code`)** | يتم تخصيصه آلياً للزبون لتفعيل الحساب في المنصة | **لا يحتاج كود** (`null`) |
| **رابط التحميل (`download_link`)** | غير متوفر | يتم توليده تلقائياً لتحميل ملف الـ PDF |
| **محتوى البريد الإلكتروني** | إرسال سيريال الزبون + كود التفعيل المخصص | إرسال زر تحميل الكتاب المباشر بصيغة PDF |
| **صفحة النجاح (Success URL)** | إظهار كود التفعيل ورابط الانتقال للدورة | إظهار زر مباشر لتحميل ملف الـ PDF |

---

## 2. جدول المنتجات والكتب (Products & Books CRUD)

### 🟢 2.1 جلب كافة المنتجات والكتب
- **HTTP Method**: `GET`
- **URL**: `/api/products`
- **Response (200 OK)**:
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": 1,
      "code": "BAC-MATH-2026",
      "name": "التحضير للبكالوريا - مادة الرياضيات",
      "description": "دورة الرياضيات الشاملة لطلاب البكالوريا",
      "price": 4000,
      "type": "course",
      "file_url": null,
      "is_active": true,
      "createdAt": "2026-09-22T20:00:00.000Z",
      "updatedAt": "2026-09-22T20:00:00.000Z"
    },
    {
      "id": 2,
      "code": "BOOK-PHYSICS-2026",
      "name": "كتاب ملخص الفيزياء للبكالوريا (PDF)",
      "description": "ملخص شامل لجميع وحدات الفيزياء مع حلول التمارين",
      "price": 1500,
      "type": "book",
      "file_url": "https://naja7t.com/uploads/books/physics-summary.pdf",
      "is_active": true,
      "createdAt": "2026-09-22T20:30:00.000Z",
      "updatedAt": "2026-09-22T20:30:00.000Z"
    }
  ]
}
```

---

### 🟢 2.2 جلب منتج محدد بالـ ID أو الـ Code
- **HTTP Method**: `GET`
- **URL**: `/api/products/1` أو `/api/products/BOOK-PHYSICS-2026`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": 2,
    "code": "BOOK-PHYSICS-2026",
    "name": "كتاب ملخص الفيزياء للبكالوريا (PDF)",
    "description": "ملخص شامل",
    "price": 1500,
    "type": "book",
    "file_url": "https://naja7t.com/uploads/books/physics-summary.pdf",
    "is_active": true
  }
}
```

---

### 🟡 2.3 إنشاء منتج أو كتاب جديد
- **HTTP Method**: `POST`
- **URL**: `/api/products`
- **Headers**: `Content-Type: application/json`
- **Request Body (لدورة تعليمية)**:
```json
{
  "code": "BAC-MATH-ADV",
  "name": "دورة الرياضيات المتقدمة",
  "description": "شرح وحلول تمارين نموذجية",
  "price": 3500,
  "type": "course",
  "is_active": true
}
```
- **Request Body (لكتاب إلكتروني PDF)**:
```json
{
  "code": "BOOK-MATH-2026",
  "name": "كتاب المراجعة النهائية في الرياضيات (PDF)",
  "description": "كتاب إلكتروني يحتوي على 100 مسألة محلولة",
  "price": 1200,
  "type": "book",
  "file_url": "https://naja7t.com/uploads/books/math-review.pdf",
  "is_active": true
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "تم إنشاء المنتج بنجاح",
  "data": {
    "id": 3,
    "code": "BOOK-MATH-2026",
    "name": "كتاب المراجعة النهائية في الرياضيات (PDF)",
    "price": 1200,
    "type": "book",
    "file_url": "https://naja7t.com/uploads/books/math-review.pdf",
    "is_active": true
  }
}
```

---

### 🔵 2.4 تحديث منتج أو كتاب موجود
- **HTTP Method**: `PUT`
- **URL**: `/api/products/3`
- **Request Body**:
```json
{
  "price": 1000,
  "file_url": "https://naja7t.com/uploads/books/math-review-v2.pdf"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "تم تحديث المنتج بنجاح",
  "data": {
    "id": 3,
    "price": 1000,
    "file_url": "https://naja7t.com/uploads/books/math-review-v2.pdf"
  }
}
```

---

### 🔴 2.5 حذف منتج
- **HTTP Method**: `DELETE`
- **URL**: `/api/products/3`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "تم حذف المنتج بنجاح"
}
```

---

## 3. مسار تحميل الكتب الإلكترونية الآمن (Secure Download API)

هذا المسار مخصص لتحميل الكتب بصيغة PDF؛ حيث يتحقق السيرفر تلقائياً من أن الزبون قام بسداد قيمة الطلب (`paid`) قبل تسليمه الملف، لمنع تسريب الروابط للعامة:

### 🟢 3.1 تحميل الكتاب بواسطة سيريال الزبون
- **HTTP Method**: `GET`
- **URL**: `/api/products/download/:serial` (مثال: `/api/products/download/CUST-372169`)
- **حالات الاستجابة**:
  - **إذا كان الدفع مؤكداً والرابط خارجي**: يُرجع تحويل مباشر `302 Found` لرابط الملف الأصلي.
  - **إذا كان الملف مخزناً محلياً على السيرفر**: يُرجع تنزيل ملف تلقائي فوري `res.download(filePath)`.
  - **إذا لم يدفع الزبون**: يُرجع `403 Forbidden`:
  ```json
  { "success": false, "error": "لم يتم تأكيد دفع هذا الطلب بعد" }
  ```
  - **إذا كان السيريال غير موجود**: يُرجع `404 Not Found`:
  ```json
  { "success": false, "error": "رقم السيريال غير صحيح أو غير موجود" }
  ```

---

## 4. مسارات الشراء والدفع والتسليم (Purchase & Webhook API)

### 🟡 4.1 بدء الشراء وتوليد رابط الدفع (Checkout)
- **HTTP Method**: `POST`
- **URL**: `/api/purchase/checkout`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "courseId": 2,
  "fullName": "أسامة بن علي",
  "phone": "0555123456",
  "email": "oussamabvb201283@gmail.com",
  "paymentMethod": "EDAHABIA",
  "ref": "AFFILIATE-2026",
  "successUrl": "https://naja7t.com/payment/success",
  "failureUrl": "https://naja7t.com/payment/failure"
}
```
*(ملاحظة: يمكنك إرسال `paymentMethod: "FREE"` لتفعيل الشراء المجاني أو التجريبي الفوري).*
- **Response (201 Created للدفع الإلكتروني)**:
```json
{
  "success": true,
  "message": "تم إنشاء رابط الدفع بنجاح.",
  "checkoutUrl": "https://pay.chargily.com/test/checkout/chk_01h...",
  "serialNumber": "CUST-884192"
}
```
- **Response (201 Created للدفع المجاني/التجريبي)**:
```json
{
  "success": true,
  "message": "تم تأكيد طلبك بنجاح! سيريال العميل: CUST-884192 | رابط التحميل جاهز.",
  "serialNumber": "CUST-884192",
  "activationCode": null,
  "downloadLink": "https://naja7t.com/api/products/download/CUST-884192",
  "productType": "book",
  "redirectUrl": "https://naja7t.com/payment/success?token=eyJhbGciOi...",
  "data": { ... }
}
```

---

### 📩 4.2 استقبال إشعار الدفع من Chargily Pay (Webhook)
- **HTTP Method**: `POST`
- **URL**: `/api/purchase/webhook/chargily`
- **Headers**: `chargily-signature: <signature>`
- **ماذا يفعل السيرفر تلقائياً عند استلام الدفع**:
  1. التحقق من التوقيع الرقمي (`verifyChargilyWebhookSignature`).
  2. إنشاء سجل الزبون في قاعدة البيانات بحالة `paid`.
  3. **إذا كان المنتج كتاباً (`book`)**: ينشئ رابط التحميل `download_link` ويرسل إيميل تحميل PDF مع زر التحميل المباشر.
  4. **إذا كان المنتج دورة (`course`)**: يسحب كود تفعيل `unused` ويربطه بالزبون ويرسل إيميل كود التفعيل.
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "تم استقبال ومعالجة إشعار الدفع بنجاح.",
  "data": {
    "serialNumber": "CUST-372169",
    "activationCode": null,
    "downloadLink": "https://naja7t.com/api/products/download/CUST-372169",
    "productType": "book",
    "customerName": "أسامة بن علي",
    "paymentStatus": "paid",
    "message": "تم تأكيد عملية الشراء بنجاح! سيريال العميل: CUST-372169 | رابط تحميل الكتاب جاهز."
  }
}
```

---

### 🔓 4.3 فك تشفير توكين صفحة النجاح (Decrypt Success Token)
- **HTTP Method**: `POST`
- **URL**: `/api/purchase/decrypt-success`
- **Request Body**:
```json
{
  "token": "eyJhbGciOi..."
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "orderId": "CUST-372169",
    "serialNumber": "CUST-372169",
    "customerName": "أسامة بن علي",
    "activationCode": null,
    "downloadLink": "https://naja7t.com/api/products/download/CUST-372169",
    "productType": "book",
    "status": "paid"
  }
}
```

---

## 5. جدول العملاء والعمليات وإعادة الإرسال (Customers API)

### 🟢 5.1 جلب كافة العملاء والمبيعات
- **HTTP Method**: `GET`
- **URL**: `/api/customers`
- **Response (200 OK)**:
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": 1,
      "serial_number": "CUST-372169",
      "customer_name": "أسامة بن علي",
      "phone": "0555123456",
      "email": "oussamabvb201283@gmail.com",
      "ref": "AFFILIATE-2026",
      "product_id": "2",
      "product_name": "كتاب ملخص الفيزياء للبكالوريا (PDF)",
      "payment_method": "EDAHABIA",
      "payment_status": "paid",
      "activation_code": null,
      "download_link": "https://naja7t.com/api/products/download/CUST-372169",
      "createdAt": "2026-09-23T00:15:00.000Z"
    }
  ]
}
```

---

### 🟢 5.2 جلب عميل محدد
- **HTTP Method**: `GET`
- **URL**: `/api/customers/1` أو `/api/customers/CUST-372169`

---

### ✉️ 5.3 إعادة إرسال بريد التأكيد للعميل (Manual Resend Email)
تتيح لك إعادة إرسال البريد الإلكتروني لأي مشتري بضغطة واحدة:
- **HTTP Method**: `POST`
- **URL**: `/api/customers/:id/resend-email` (مثال: `/api/customers/1/resend-email` أو `/api/customers/CUST-372169/resend-email`)
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "تم إرسال بريد التأكيد بنجاح إلى (oussamabvb201283@gmail.com)!",
  "serialNumber": "CUST-372169",
  "activationCode": null,
  "downloadUrl": "https://naja7t.com/api/products/download/CUST-372169",
  "result": {
    "success": true,
    "messageId": "<5c428364-c918-cb26-eace-3e6c83558014@gmail.com>",
    "port": 465
  }
}
```

---

## 6. جدول أكواد التفعيل (Activation Codes CRUD)

*(مخصص للدورات التعليمية فقط)*

### 🟢 6.1 جلب كافة الأكواد والإحصائيات
- **HTTP Method**: `GET`
- **URL**: `/api/activation-codes`
- **Response (200 OK)**:
```json
{
  "success": true,
  "count": 10,
  "stats": {
    "total": 10,
    "unused": 6,
    "used": 4,
    "expired": 0
  },
  "data": [
    {
      "id": 1,
      "code": "ACT-88412",
      "status": "unused",
      "expires_at": null,
      "product_id": "1",
      "used_by_customer_id": null,
      "used_at": null
    }
  ]
}
```

---

### 🟡 6.2 إضافة كود تفعيل جديد
- **HTTP Method**: `POST`
- **URL**: `/api/activation-codes`
- **Request Body**:
```json
{
  "code": "NJ-MATH-2026-VIP",
  "product_id": "1",
  "expires_at": "2026-12-31T23:59:59.000Z"
}
```

---

### 🔍 6.3 فحص وتفعيل كود في تطبيق/منصة التلميذ
- **HTTP Method**: `POST`
- **URL**: `/api/activation-codes/verify`
- **Request Body**:
```json
{
  "code": "ACT-88412"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "الكود صالح ومفعل بنجاح!",
  "data": {
    "code": "ACT-88412",
    "status": "used",
    "productId": "1"
  }
}
```

---

## 7. جدول التلاميذ والنتائج (Students & Quiz API)

### 🟢 7.1 جلب كافة التلاميذ والنتائج
- **HTTP Method**: `GET`
- **URL**: `/api/students`

### 🟡 7.2 تسجيل إجابة كويز جديدة
- **HTTP Method**: `POST`
- **URL**: `/api/students`
- **Request Body**:
```json
{
  "serial_number": "CUST-372169",
  "student_name": "أسامة بن علي",
  "phone": "0555123456",
  "activation_code": "ACT-88412",
  "quiz_name": "اختبار الرياضيات - الوحدة الأولى",
  "score": 19.5,
  "answers": {
    "q1": "A",
    "q2": "C"
  }
}
```

---

## 8. مسارات الإدارة وفحص الاتصال (Admin API)

### ✉️ 8.1 اختبار إرسال بريد إلكتروني تجريبي (Gmail / SMTP)
- **HTTP Method**: `GET` أو `POST`
- **URL**: `/api/admin/test-email?email=oussamabvb201283@gmail.com`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "تم إرسال البريد الإلكتروني بنجاح إلى (oussamabvb201283@gmail.com)!",
  "result": {
    "success": true,
    "messageId": "<...>",
    "port": 465
  },
  "recipient": "oussamabvb201283@gmail.com"
}
```

---

### 🌐 8.2 جلب عنوان IP الخارجي للسيرفر
- **HTTP Method**: `GET`
- **URL**: `/api/admin/my-ip`
- **Response (200 OK)**:
```json
{
  "success": true,
  "ip": "213.179.x.x",
  "message": "الـ IP الحالي الخارجي لسيرفرك هو: 213.179.x.x"
}
```

---

### ⚠️ 8.3 تصفير قاعدة البيانات والجداول
- **HTTP Method**: `POST`
- **URL**: `/api/admin/reset`
- **Request Body**:
```json
{
  "target": "all" 
}
```
*(الخيارات المتاحة لـ target: `all` أو `customers` أو `activation_codes` أو `students` أو `products`).*

---
جميع الحقوق محفوظة © 2026 منصة نجحت التعليمية (Naja7t API Server)
