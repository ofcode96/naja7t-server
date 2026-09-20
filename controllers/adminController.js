const { Product, Customer, ActivationCode, Student } = require('../models');

/**
 * تصفير وتفريغ قاعدة البيانات أو جداول محددة
 * POST /api/admin/reset
 */
const resetDatabase = async (req, res) => {
  try {
    const { target = 'all', seed = true } = req.body;

    let message = '';

    switch (target.toLowerCase()) {
      case 'customers':
        await Customer.destroy({ where: {} });
        message = 'تم تصفير وتفريغ جدول العملاء والعمليات بنجاح!';
        break;

      case 'activation_codes':
      case 'activation-codes':
        await ActivationCode.destroy({ where: {} });
        message = 'تم تصفير وتفريغ جدول أكواد التفعيل بنجاح!';
        break;

      case 'students':
        await Student.destroy({ where: {} });
        message = 'تم تصفير وتفريغ جدول التلاميذ وإجابات الكويزات بنجاح!';
        break;

      case 'products':
        await Product.destroy({ where: {} });
        message = 'تم تصفير وتفريغ جدول المنتجات بنجاح!';
        break;

      case 'all':
      default:
        await Customer.destroy({ where: {} });
        await ActivationCode.destroy({ where: {} });
        await Student.destroy({ where: {} });
        await Product.destroy({ where: {} });
        message = 'تم تصفير وتفريغ جميع جداول قاعدة البيانات بالكامل!';

        if (seed) {
          await Product.bulkCreate([
            { code: 'BAC-MATH-2026', name: 'التحضير للبكالوريا - مادة الرياضيات', description: 'دورة الرياضيات الشاملة', price: 4000 },
            { code: 'BAC-PHYSICS-2026', name: 'التحضير للبكالوريا - مادة الفيزياء', description: 'دورة الفيزياء الشاملة', price: 4500 },
            { code: 'BAC-SCIENCE-2026', name: 'التحضير للبكالوريا - مادة العلوم', description: 'دورة العلوم الشاملة', price: 4000 },
            { code: 'FULL-PACK-2026', name: 'الباك الشامل - جميع المواد العلمية', description: 'عرض الشامل لكل المواد', price: 10000 }
          ]);

          await ActivationCode.bulkCreate([
            { code: 'NJ-ACT-1001-MATH', status: 'unused', product_id: 'BAC-MATH-2026' },
            { code: 'NJ-ACT-1002-PHYS', status: 'unused', product_id: 'BAC-PHYSICS-2026' },
            { code: 'NJ-ACT-1003-SCIE', status: 'unused', product_id: 'BAC-SCIENCE-2026' },
            { code: 'NJ-ACT-1004-PACK', status: 'unused', product_id: 'FULL-PACK-2026' }
          ]);
          message += ' وتم بذر البيانات الأولية للدورات والأكواد مجدداً.';
        }
        break;
    }

    return res.status(200).json({
      success: true,
      message,
      target
    });

  } catch (error) {
    console.error('خطأ في تصفير قاعدة البيانات:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  resetDatabase
};
