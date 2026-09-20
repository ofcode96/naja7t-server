# 📖 توثيق API الشامل - منصة نجحت التعليمية (Naja7t Server API v2.1)

هذا المستند يتضمن التوثيق الكامل والمفصل لجميع مسارات ونقاط النهاية (API Endpoints) المتاحة في سيرفر منصة **نجحت** التعليمية.

---

## 📍 الفهرس
1. [إعدادات البيئة ورابط الأساس](#1-إعدادات-البيئة)
2. [مسارات صفحة الشراء و Chargily Pay](#2-مسارات-الشراء-والدفع)
3. [مسارات فك تشفير صفحة النجاح](#3-فك-تشفير-روابط-النجاح)
4. [مسارات إدارة أكواد التفعيل](#4-أكواد-التفعيل)
5. [مسارات الكويزات والتلاميذ](#5-الكويزات-والتلاميذ)
6. [مسارات إدارة المنتجات (Products CRUD)](#6-المنتجات-والأسعار)
7. [مسارات إدارة العملاء والعمليات (Customers CRUD)](#7-العملاء-والعمليات)
8. [مسارات الإدارة وتصفير قاعدة البيانات](#8-تصفير-وتفريغ-قاعدة-البيانات)

---

## 1. إعدادات البيئة
- **الرابط المحلي**: `http://localhost:5000`
- **الرابط على Render**: `https://<YOUR-RENDER-APP>.onrender.com`

---

## 2. مسارات الشراء والدفع

### 💳 إنشاء طلب شراء وحصول على رابط الدفع
`POST /api/purchase/checkout`

- **الوصف**: معالجة طلب الشراء وحماية السعر وتوليد رابط الدفع الإلكتروني عبر **Chargily Pay** أو التفعيل المجاني.
- **جسم الطلب (JSON Body):**
  ```json
  {
    "courseId": "BAC-MATH-2026",
    "fullName": "محمد الأمين",
    "email": "student@example.com",
    "phone": "0661234567",
    "paymentMethod": "EDAHABIA"
  }
  ```
- **خيارات `paymentMethod` المتاحة:**
  - `EDAHABIA` / `CIB` / `CHARGILY`: توليد رابط دفع بالبطاقة الذهبية / CIB.
  - `FREE` / `SADAQA` / `CONTEST`: تفعيل فورياً وتخصيص كود وتوليد رابط نجاح مشفر.
  - `CASH` / `FLEXY` / `RECEIPT`: تسجيل الطلب قيد الانتظار `pending`.
- **مثال الاستجابة (201 Created - EDAHABIA):**
  ```json
  {
    "success": true,
    "message": "تم إنشاء طلب الشراء بنجاح، يرجى التوجه لرابط الدفع للإتمام.",
    "checkoutUrl": "https://pay.chargily.com/test/checkout/chk_12345",
    "data": {
      "serial_number": "CUST-522121",
      "customer_name": "محمد الأمين",
      "payment_status": "pending"
    }
  }
  ```

---

### 📩 استقبال إشعارات Webhook من Chargily Pay
`POST /api/purchase/webhook/chargily`

- **الوصف**: يتم استدعاؤه تلقائياً بواسطة Chargily عند إتمام أو فشل عملية الدفع.
- **الهيدر المطلوب**: `chargily-signature`
- **النتيجة**: تحديث حالة العميل إلى `paid` وتعيين كود تفعيل له تلقائياً.

---

## 3. فك تشفير روابط النجاح

### 🔓 فك تشفير توكين صفحة النجاح
`POST /api/purchase/decrypt-success`

- **الوصف**: فك تشفير البارامتر المشفر الممرر في رابط النجاح (`?data=...`) بأمان باستخدام AES-256.
- **جسم الطلب:**
  ```json
  {
    "token": "MmU1ZjAwNTEx..."
  }
  ```
- **الاستجابة:**
  ```json
  {
    "success": true,
    "data": {
      "orderId": "CUST-522121",
      "customerName": "محمد الأمين",
      "activationCode": "NJ-ACT-1001-MATH",
      "paymentMethod": "FREE",
      "status": "paid"
    }
  }
  ```

---

## 4. أكواد التفعيل

### 🔍 فك وفحص صحة كود التفعيل
`GET /api/activation-codes/validate/:code`
- **مثال**: `GET /api/activation-codes/validate/NJ-ACT-1001-MATH`
- **الاستجابة:**
  ```json
  {
    "success": true,
    "valid": true,
    "message": "كود التفعيل صالح وغير مستعمل",
    "data": {
      "code": "NJ-ACT-1001-MATH",
      "status": "unused"
    }
  }
  ```

### ➕ إضافة كود تفعيل فريد (يمنع التكرار)
`POST /api/activation-codes`
- **جسم الطلب:**
  ```json
  {
    "code": "NAJA7T-PASS-2026",
    "product_id": "BAC-MATH-2026"
  }
  ```

### ⚡ توليد أكواد تفعيل عشوائية فريدة دفعة واحدة
`POST /api/activation-codes/generate`
- **جسم الطلب:**
  ```json
  {
    "count": 20,
    "product_id": "BAC-MATH-2026"
  }
  ```

---

## 5. الكويزات والتلاميذ

### 📝 تسجيل إجابات تلميذ ورقم تسلسلي
`POST /api/students`
- **جسم الطلب:**
  ```json
  {
    "student_name": "إكرام الجزائري",
    "phone": "0550112233",
    "activation_code": "NJ-ACT-1001-MATH",
    "quiz_name": "امتحان البكالوريا التجريبي - مادة الرياضيات",
    "answers": {
      "q1": "الخيار أ",
      "q2": "الخيار ج",
      "essay": "النهاية تساوي زائد ما لا نهاية بناء على دراسة التغيرات"
    },
    "score": 18.5
  }
  ```
- **الاستجابة:**
  ```json
  {
    "success": true,
    "data": {
      "serial_number": "STU-511201",
      "student_name": "إكرام الجزائري"
    }
  }
  ```

---

## 6. المنتجات والأسعار

- **عرض المنتجات**: `GET /api/products`
- **إضافة منتج وسعر بالسيرفر**: `POST /api/products`
  ```json
  {
    "code": "BAC-ENGLISH-2026",
    "name": "دورة اللغة الإنجليزية للبكالوريا",
    "description": "شاملة للجهة النظرية والتطبيقية",
    "price": 3000
  }
  ```
- **تحديث منتج**: `PUT /api/products/:id`
- **حذف منتج**: `DELETE /api/products/:id`

---

## 7. العملاء والعمليات

- **عرض كل العملاء المسجلين**: `GET /api/customers`
- **البحث برقم تسلسلي العميل**: `GET /api/customers/CUST-522121`
- **تحديث عميل**: `PUT /api/customers/:id`
- **حذف عميل**: `DELETE /api/customers/:id`

---

## 8. تصفير وتفريغ قاعدة البيانات

### 🔄 تصفير البيانات أو جدول محدد
`POST /api/admin/reset`

- **تصفير وتفريغ كل الجداول وإعادة بذر البيانات الأولية:**
  ```json
  {
    "target": "all",
    "seed": true
  }
  ```

- **خيارات `target` المتاحة لتصفير جدول معين:**
  - `"all"`: تفريغ كل الجداول وإعادة بذرها.
  - `"customers"`: تفريغ جدول العملاء والعمليات فقط.
  - `"activation_codes"`: تفريغ جدول أكواد التفعيل فقط.
  - `"students"`: تفريغ جدول التلاميذ وإجابات الكويزات فقط.
  - `"products"`: تفريغ جدول المنتجات والأسعار فقط.

- **الاستجابة:**
  ```json
  {
    "success": true,
    "message": "تم تصفير وتفريغ جميع جداول قاعدة البيانات بالكامل! وتم بذر البيانات الأولية للدورات والأكواد مجدداً.",
    "target": "all"
  }
  ```
