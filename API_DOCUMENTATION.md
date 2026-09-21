# 📖 التوثيق النهائي المباشر والكامل لـ API منصة نجحت (Naja7t Server API v2.1)

هذا التوثيق يحتوي على شرح **جميع المسارات ونقاط النهاية (Endpoints)** بدون أي استثناء، مع تبيان نوع الطلب (HTTP Method)، الرابط، الهيدرات، جسم الطلب (JSON Request Body)، ونماذج الاستجابات (JSON Responses).

---

## 📍 الفهرس الشامل
1. [جدول المنتجات والأسعار (Products CRUD)](#1-جدول-المنتجات-والأسعار-products-crud)
2. [جدول العملاء والعمليات (Customers CRUD)](#2-جدول-العملاء-والعمليات-customers-crud)
3. [جدول أكواد التفعيل (Activation Codes CRUD)](#3-جدول-أكواد-التفعيل-activation-codes-crud)
4. [جدول التلاميذ والنتائج (Students CRUD)](#4-جدول-التلاميذ-والنتائج-students-crud)
5. [مسارات الشراء والدفع والتشفير (Purchase & Checkout API)](#5-مسارات-الشراء-والدفع-والتشفير-purchase--checkout-api)
6. [مسارات الإدارة والتصفير (Admin Reset API)](#6-مسارات-الإدارة-والتصفير-admin-reset-api)

---

## 1. جدول المنتجات والأسعار (Products CRUD)

### 🟢 1.1 جلب كافة المنتجات
- **HTTP Method**: `GET`
- **URL**: `http://localhost:5000/api/products`
- **Request Headers**: لا يوجد
- **Request Body**: لا يوجد
- **Response (200 OK)**:
```json
{
  "success": true,
  "count": 4,
  "data": [
    {
      "id": 1,
      "code": "BAC-MATH-2026",
      "name": "التحضير للبكالوريا - مادة الرياضيات",
      "description": "دورة الرياضيات الشاملة",
      "price": 4000,
      "is_active": true,
      "createdAt": "2026-09-20T22:30:00.000Z",
      "updatedAt": "2026-09-20T22:30:00.000Z"
    }
  ]
}
```

---

### 🟢 1.2 جلب منتج واحد محدد بالـ ID
- **HTTP Method**: `GET`
- **URL**: `http://localhost:5000/api/products/1`
- **Request Body**: لا يوجد
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "code": "BAC-MATH-2026",
    "name": "التحضير للبكالوريا - مادة الرياضيات",
    "description": "دورة الرياضيات الشاملة",
    "price": 4000,
    "is_active": true
  }
}
```

---

### 🟡 1.3 إنشاء منتج وسعر جديد
- **HTTP Method**: `POST`
- **URL**: `http://localhost:5000/api/products`
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "code": "BAC-ENGLISH-2026",
  "name": "دورة اللغة الإنجليزية للبكالوريا",
  "description": "شاملة للجهة النظرية والتطبيقية",
  "price": 3000,
  "is_active": true
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "تم إنشاء المنتج بنجاح",
  "data": {
    "id": 5,
    "code": "BAC-ENGLISH-2026",
    "name": "دورة اللغة الإنجليزية للبكالوريا",
    "description": "شاملة للجهة النظرية والتطبيقية",
    "price": 3000,
    "is_active": true
  }
}
```

---

### 🔵 1.4 تحديث منتج موجود
- **HTTP Method**: `PUT`
- **URL**: `http://localhost:5000/api/products/5`
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "price": 3500,
  "description": "تحديث الوصف والدورة الشاملة"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "تم تحديث المنتج بنجاح",
  "data": {
    "id": 5,
    "code": "BAC-ENGLISH-2026",
    "name": "دورة اللغة الإنجليزية للبكالوريا",
    "description": "تحديث الوصف والدورة الشاملة",
    "price": 3500,
    "is_active": true
  }
}
```

---

### 🔴 1.5 حذف منتج
- **HTTP Method**: `DELETE`
- **URL**: `http://localhost:5000/api/products/5`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "تم حذف المنتج بنجاح"
}
```

---

## 2. جدول العملاء والعمليات (Customers CRUD)

### 🟢 2.1 جلب جميع العملاء والعمليات
- **HTTP Method**: `GET`
- **URL**: `http://localhost:5000/api/customers`
- **Response (200 OK)**:
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": 1,
      "serial_number": "CUST-522121",
      "customer_name": "محمد الأمين",
      "phone": "0661234567",
      "email": "student@example.com",
      "product_id": "BAC-MATH-2026",
      "product_name": "التحضير للبكالوريا - مادة الرياضيات",
      "payment_method": "EDAHABIA",
      "payment_status": "paid",
      "activation_code": "NJ-ACT-1001-MATH"
    }
  ]
}
```

---

### 🟢 2.2 جلب عميل محدد بالـ ID أو بالرقم التسلسلي الفريد
- **HTTP Method**: `GET`
- **URL**: `http://localhost:5000/api/customers/CUST-522121`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "serial_number": "CUST-522121",
    "customer_name": "محمد الأمين",
    "payment_status": "paid"
  }
}
```

---

### 🟡 2.3 إنشاء سجل عميل جديد يدوي
- **HTTP Method**: `POST`
- **URL**: `http://localhost:5000/api/customers`
- **Request Body**:
```json
{
  "customer_name": "ياسين التلمساني",
  "phone": "0550112233",
  "email": "yassine@example.com",
  "product_id": "BAC-PHYSICS-2026",
  "product_name": "التحضير للبكالوريا - مادة الفيزياء",
  "payment_method": "CASH",
  "payment_status": "paid",
  "activation_code": "NJ-ACT-1002-PHYS"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "تم إضافة العميل بنجاح",
  "data": {
    "id": 2,
    "serial_number": "CUST-994821",
    "customer_name": "ياسين التلمساني",
    "payment_method": "CASH"
  }
}
```

---

### 🔵 2.4 تحديث بيانات عميل
- **HTTP Method**: `PUT`
- **URL**: `http://localhost:5000/api/customers/2`
- **Request Body**:
```json
{
  "payment_status": "paid",
  "activation_code": "NJ-ACT-CUSTOM-99"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "تم تحديث العميل بنجاح",
  "data": {
    "id": 2,
    "payment_status": "paid",
    "activation_code": "NJ-ACT-CUSTOM-99"
  }
}
```

---

### 🔴 2.5 حذف عميل
- **HTTP Method**: `DELETE`
- **URL**: `http://localhost:5000/api/customers/2`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "تم حذف العميل بنجاح"
}
```

---

## 3. جدول أكواد التفعيل (Activation Codes CRUD)

### 🟢 3.1 جلب كافة أكواد التفعيل (مع تصفية الحالات)
- **HTTP Method**: `GET`
- **URL**: `http://localhost:5000/api/activation-codes`  *(يمكنك إضافة `?status=unused` أو `?status=used`)*
- **Response (200 OK)**:
```json
{
  "success": true,
  "count": 4,
  "data": [
    {
      "id": 1,
      "code": "NJ-ACT-1001-MATH",
      "status": "unused",
      "product_id": "BAC-MATH-2026",
      "used_by_customer_id": null
    }
  ]
}
```

---

### 🟢 3.2 فحص والتحقق من صحة كود التفعيل
- **HTTP Method**: `GET`
- **URL**: `http://localhost:5000/api/activation-codes/validate/NJ-ACT-1001-MATH`
- **Response (200 OK)**:
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

---

### 🟡 3.3 إضافة كود تفعيل واحد فريد (يمنع التكرار مطلقاً)
- **HTTP Method**: `POST`
- **URL**: `http://localhost:5000/api/activation-codes`
- **Request Body**:
```json
{
  "code": "NAJA7T-PASS-2026",
  "product_id": "BAC-MATH-2026"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "تم إضافة كود التفعيل بنجاح",
  "data": {
    "id": 5,
    "code": "NAJA7T-PASS-2026",
    "status": "unused"
  }
}
```
- **في حال محاولة إدخال نفس الكود مرة أخرى (400 Bad Request):**
```json
{
  "success": false,
  "error": "كود التفعيل هذا موجود مسبقاً وغير مسموح بتكرار الأكواد!"
}
```

---

### 🟡 3.4 توليد أكواد تفعيل عشوائية فريدة دفعة واحدة (Bulk Generate)
- **HTTP Method**: `POST`
- **URL**: `http://localhost:5000/api/activation-codes/generate`
- **Request Body**:
```json
{
  "count": 10,
  "product_id": "BAC-MATH-2026"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "تم توليد 10 كود تفعيل فريد بنجاح!",
  "data": [
    { "id": 6, "code": "NJ-8F1A-9C32", "status": "unused" },
    { "id": 7, "code": "NJ-4B90-11EF", "status": "unused" }
  ]
}
```

---

### 🔴 3.5 حذف كود تفعيل
- **HTTP Method**: `DELETE`
- **URL**: `http://localhost:5000/api/activation-codes/5`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "تم حذف كود التفعيل بنجاح"
}
```

---

## 4. جدول التلاميذ والنتائج (Students CRUD)

### 🟢 4.1 جلب كافة التلاميذ وإجابات الكويزات
- **HTTP Method**: `GET`
- **URL**: `http://localhost:5000/api/students`
- **Response (200 OK)**:
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": 1,
      "serial_number": "STU-511201",
      "student_name": "إكرام الجزائري",
      "phone": "0550112233",
      "activation_code": "NJ-ACT-1001-MATH",
      "quiz_name": "امتحان البكالوريا التجريبي - مادة الرياضيات",
      "answers": {
        "q1": "الخيار أ",
        "q2": "الخيار ج",
        "essay": "النهاية تساوي زائد ما لا نهاية"
      },
      "score": 18.5
    }
  ]
}
```

---

### 🟢 4.2 جلب تلميذ محدد بالـ ID أو الرقم التسلسلي STU-XXXXXX
- **HTTP Method**: `GET`
- **URL**: `http://localhost:5000/api/students/STU-511201`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "serial_number": "STU-511201",
    "student_name": "إكرام الجزائري",
    "score": 18.5
  }
}
```

---

### 🟡 4.3 إضافة تلميذ وتسجيل إجابات الكويز (JSON Payload)
- **HTTP Method**: `POST`
- **URL**: `http://localhost:5000/api/students`
- **Request Body**:
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
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "تم تسجل بيانات التلميذ وإجابات الكويز بنجاح!",
  "data": {
    "id": 1,
    "serial_number": "STU-511201",
    "student_name": "إكرام الجزائري",
    "activation_code": "NJ-ACT-1001-MATH",
    "quiz_name": "امتحان البكالوريا التجريبي - مادة الرياضيات",
    "score": 18.5
  }
}
```

---

### 🔵 4.4 تحديث سجل تلميذ أو تعديل النتيجة
- **HTTP Method**: `PUT`
- **URL**: `http://localhost:5000/api/students/1`
- **Request Body**:
```json
{
  "score": 19.5
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "تم تحديث سجل التلميذ بنجاح",
  "data": {
    "id": 1,
    "score": 19.5
  }
}
```

---

### 🔴 4.5 حذف سجل تلميذ
- **HTTP Method**: `DELETE`
- **URL**: `http://localhost:5000/api/students/1`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "تم حذف سجل التلميذ بنجاح"
}
```

---

## 5. مسارات الشراء والدفع والتشفير (Purchase & Checkout API)

### 💳 5.1 معالجة طلب الشراء
- **HTTP Method**: `POST`
- **URL**: `http://localhost:5000/api/purchase/checkout`
- **Request Body (Chargily Pay):**
```json
{
  "courseId": "BAC-MATH-2026",
  "fullName": "محمد الأمين",
  "email": "student@example.com",
  "paymentMethod": "EDAHABIA"
}
```
- **Response (201 Created):**
```json
{
  "success": true,
  "message": "تم إنشاء طلب الشراء بنجاح، يرجى التوجه لرابط الدفع للإتمام.",
  "checkoutUrl": "https://pay.chargily.com/test/checkout/chk_12345",
  "data": {
    "serial_number": "CUST-522121",
    "payment_status": "pending"
  }
}
```

- **Request Body (مجاناً FREE):**
```json
{
  "courseId": "BAC-MATH-2026",
  "fullName": "محمد الأمين",
  "paymentMethod": "FREE"
}
```
- **Response (201 Created):**
```json
{
  "success": true,
  "message": "تم تفعيل الطلب بنجاح مجاناً!",
  "redirectUrl": "https://naja7t.com/payment/success?data=MmU1ZjAwNTEx...",
  "data": {
    "serial_number": "CUST-522121",
    "activation_code": "NJ-ACT-1001-MATH"
  }
}
```

---

### 🔓 5.2 فك تشفير توكين صفحة النجاح (AES-256)
- **HTTP Method**: `POST`
- **URL**: `http://localhost:5000/api/purchase/decrypt-success`
- **Request Body:**
```json
{
  "token": "MmU1ZjAwNTExMTM4MDVjMDdhNjAyODc6..."
}
```
- **Response (200 OK):**
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

## 6. مسارات الإدارة والتصفير (Admin Reset API)

### 🔄 6.1 تصفير وتفريغ قاعدة البيانات أو جداول محددة
- **HTTP Method**: `POST`
- **URL**: `http://localhost:5000/api/admin/reset`

#### أ) تصفير وتفريغ الكل مع إعادة بذر البيانات الأولية:
- **Request Body:**
```json
{
  "target": "all",
  "seed": true
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "تم تصفير وتفريغ جميع جداول قاعدة البيانات بالكامل! وتم بذر البيانات الأولية للدورات والأكواد مجدداً.",
  "target": "all"
}
```

#### ب) تصفير جدول محدد فقط:
- **تفريغ العملاء فقط**: `{ "target": "customers" }`
- **تفريغ أكواد التفعيل فقط**: `{ "target": "activation_codes" }`
- **تفريغ الكويزات فقط**: `{ "target": "students" }`
- **تفريغ المنتجات والأسعار فقط**: `{ "target": "products" }`
