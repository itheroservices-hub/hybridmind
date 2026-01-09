const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const validateRequest = require('../middleware/validateRequest');

// Legacy endpoint (backward compatibility)
router.post('/', validateRequest('agent'), agentController.legacyExecute);

// New endpoints
router.post('/execute', validateRequest('agent'), agentController.execute);
router.post('/workflow/:workflowId', validateRequest('workflow'), agentController.executePreset);
router.get('/workflows', agentController.getWorkflows);
router.post('/compare', validateRequest('comparison'), agentController.compare);
router.post('/chain', validateRequest('comparison'), agentController.chain);

module.exports = router;
