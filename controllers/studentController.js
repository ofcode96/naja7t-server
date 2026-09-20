const { Student, ActivationCode } = require('../models');

// GET /api/students - جلب كافة التلاميذ وإجابات الكويزات
const getAllStudents = async (req, res) => {
  try {
    const students = await Student.findAll({ order: [['createdAt', 'DESC']] });
    return res.status(200).json({ success: true, count: students.length, data: students });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/students/:id - جلب تلميذ محدد بالـ ID أو بالرقم التسلسلي
const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    const student = isNaN(id)
      ? await Student.findOne({ where: { serial_number: id } })
      : await Student.findByPk(id);

    if (!student) {
      return res.status(404).json({ success: false, error: 'سجل التلميذ غير موجود' });
    }
    return res.status(200).json({ success: true, data: student });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/students - إدخال تلميذ جديد وإجابات الكويز
const createStudent = async (req, res) => {
  try {
    const { student_name, phone, activation_code, quiz_name, answers, score } = req.body;

    if (!student_name || !student_name.trim()) {
      return res.status(400).json({ success: false, error: 'يرجى تقديم اسم التلميذ' });
    }

    // إذا تم تقديم كود تفعيل فحص صحته وتحديث حالته إلى مستعمل
    if (activation_code) {
      const cleanCode = activation_code.trim().toUpperCase();
      const codeRecord = await ActivationCode.findOne({ where: { code: cleanCode } });
      
      if (codeRecord) {
        if (codeRecord.status === 'used') {
          return res.status(400).json({ success: false, error: 'كود التفعيل مستعمل مسبقاً' });
        }
        // تحديث كود التفعيل كمستعمل
        codeRecord.status = 'used';
        codeRecord.used_at = new Date();
        await codeRecord.save();
      }
    }

    // توليد رقم تسلسلي فريد للتلميذ STU-XXXXX
    const randomSerial = `STU-${Math.floor(100000 + Math.random() * 900000)}`;

    const student = await Student.create({
      serial_number: randomSerial,
      student_name: student_name.trim(),
      phone: phone ? phone.trim() : null,
      activation_code: activation_code ? activation_code.trim().toUpperCase() : null,
      quiz_name: quiz_name || 'General Quiz',
      answers: answers || {}, // إدخال JSON ضخم
      score: Number(score) || 0
    });

    return res.status(201).json({
      success: true,
      message: 'تم تسجل بيانات التلميذ وإجابات الكويز بنجاح!',
      data: student
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

// PUT /api/students/:id - تحديث تلميذ
const updateStudent = async (req, res) => {
  try {
    const student = await Student.findByPk(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, error: 'سجل التلميذ غير موجود' });
    }
    await student.update(req.body);
    return res.status(200).json({ success: true, message: 'تم تحديث سجل التلميذ بنجاح', data: student });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

// DELETE /api/students/:id - حذف سجل تلميذ
const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findByPk(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, error: 'سجل التلميذ غير موجود' });
    }
    await student.destroy();
    return res.status(200).json({ success: true, message: 'تم حذف سجل التلميذ بنجاح' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  getAllStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent
};
