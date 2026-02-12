const express = require('express');
const router = express.Router();
const runController = require('../controllers/runController');
const validateRequest = require('../middleware/validateRequest');
const tierValidator = require('../middleware/tierValidator');

// Legacy endpoint (backward compatibility)
router.post('/', validateRequest('run'), tierValidator.validateTier, runController.execute);

// New explicit endpoints with tier validation
router.post('/single', validateRequest('run'), tierValidator.validateTier, runController.executeSingle);
router.post('/chain', validateRequest('run'), tierValidator.validateTier, tierValidator.validateWorkflowAccess, runController.executeChain);
router.post('/parallel', validateRequest('comparison'), tierValidator.validateTier, tierValidator.validateWorkflowAccess, runController.executeParallel);
router.post('/all-to-all', validateRequest('comparison'), tierValidator.validateTier, tierValidator.validateWorkflowAccess, runController.executeAllToAll);

module.exports = router;
