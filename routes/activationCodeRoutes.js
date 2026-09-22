const express = require('express');
const router = express.Router();
const {
  getAllActivationCodes,
  createActivationCode,
  updateActivationCode,
  generateBulkCodes,
  validateCode,
  deleteActivationCode
} = require('../controllers/activationCodeController');

router.get('/', getAllActivationCodes);
router.get('/validate/:code', validateCode);
router.post('/', createActivationCode);
router.put('/:id', updateActivationCode);
router.post('/generate', generateBulkCodes);
router.delete('/:id', deleteActivationCode);

module.exports = router;
