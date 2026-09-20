const express = require('express');
const router = express.Router();
const {
  getAllCustomers,
  getCustomerById,
  createCustomerRecord,
  updateCustomerRecord,
  deleteCustomerRecord
} = require('../controllers/customerController');

router.get('/', getAllCustomers);
router.get('/:id', getCustomerById);
router.post('/', createCustomerRecord);
router.put('/:id', updateCustomerRecord);
router.delete('/:id', deleteCustomerRecord);

module.exports = router;
