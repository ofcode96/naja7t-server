const express = require('express');
const router = express.Router();
const {
  getAllCustomers,
  getCustomerById,
  createCustomerRecord,
  updateCustomerRecord,
  deleteCustomerRecord,
  resendCustomerEmail
} = require('../controllers/customerController');

router.get('/', getAllCustomers);
router.get('/:id', getCustomerById);
router.post('/', createCustomerRecord);
router.post('/:id/resend-email', resendCustomerEmail);
router.put('/:id', updateCustomerRecord);
router.delete('/:id', deleteCustomerRecord);

module.exports = router;
