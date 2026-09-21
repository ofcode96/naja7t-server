const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// 1. جدول المنتجات (Products)
const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  code: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  chargily_product_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  chargily_price_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'products',
  timestamps: true
});

// 2. جدول العملاء والعمليات (Customers & Purchases) مع دعم الريفر والبيانات الكاملة
const Customer = sequelize.define('Customer', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  serial_number: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  customer_name: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'طالب نجحت'
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  ref: {
    type: DataTypes.STRING, // كود الإحالة / الريفر (Referral)
    allowNull: true
  },
  product_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  product_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  payment_method: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'EDAHABIA'
  },
  payment_status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending'
  },
  activation_code: {
    type: DataTypes.STRING,
    allowNull: true
  },
  chargily_checkout_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  checkout_url: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'customers',
  timestamps: true
});

// 3. جدول أكواد التفعيل (Activation Codes)
const ActivationCode = sequelize.define('ActivationCode', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  code: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('unused', 'used'),
    defaultValue: 'unused',
    allowNull: false
  },
  product_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  used_by_customer_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  used_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'activation_codes',
  timestamps: true
});

// 4. جدول التلاميذ والكويزات (Students & Quiz Submissions)
const Student = sequelize.define('Student', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  serial_number: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  student_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  activation_code: {
    type: DataTypes.STRING,
    allowNull: true
  },
  quiz_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  answers: {
    type: DataTypes.JSON,
    allowNull: true
  },
  score: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0
  }
}, {
  tableName: 'students',
  timestamps: true
});

module.exports = {
  Product,
  Customer,
  ActivationCode,
  Student
};
