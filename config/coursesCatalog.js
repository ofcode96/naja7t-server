/**
 * كتالوج الدورات والأسعار المعتمدة محلياً على السيرفر
 * يمنع التلاعب بالأسعار من طرف العميل في الـ Frontend
 */
const coursesCatalog = {
  'BAC-MATH-2026': {
    id: 'BAC-MATH-2026',
    title: 'التحضير للبكالوريا - مادة الرياضيات',
    price: 4000,
    currency: 'DZD'
  },
  'BAC-PHYSICS-2026': {
    id: 'BAC-PHYSICS-2026',
    title: 'التحضير للبكالوريا - مادة الفيزياء',
    price: 4500,
    currency: 'DZD'
  },
  'BAC-SCIENCE-2026': {
    id: 'BAC-SCIENCE-2026',
    title: 'التحضير للبكالوريا - مادة العلوم الطبيعية',
    price: 4000,
    currency: 'DZD'
  },
  'FULL-PACK-2026': {
    id: 'FULL-PACK-2026',
    title: 'الباك الشامل - جميع المواد العلمية',
    price: 10000,
    currency: 'DZD'
  }
};

/**
 * الحصول على السعر المحمي للدورة من السيرفر مباشرة
 * @param {string} courseId معرف الدورة
 * @returns {object} تفاصيل السعر والعنوان المعتمد
 */
function getTrustedCourseDetails(courseId) {
  if (courseId && coursesCatalog[courseId]) {
    return coursesCatalog[courseId];
  }

  // في حال تقديم دورة غير موجودة بالكتالوج نستخدم دورة عامة بسعر افتراضي محدد بالسيرفر
  return {
    id: courseId || 'GENERIC-COURSE',
    title: 'دورة منصة نجحت التعليمية',
    price: 3500,
    currency: 'DZD'
  };
}

module.exports = {
  coursesCatalog,
  getTrustedCourseDetails
};
