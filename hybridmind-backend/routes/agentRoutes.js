const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const validateRequest = require('../middleware/validateRequest');
const tierValidator = require('../middleware/tierValidator');

// Legacy endpoint (backward compatibility)
router.post('/', tierValidator.validateTier, validateRequest('agent'), agentController.legacyExecute);

// New endpoints
router.post('/execute', tierValidator.validateTier, validateRequest('agent'), agentController.execute);
router.post('/workflow/:workflowId', tierValidator.requireFeature('agentic-chains'), validateRequest('workflow'), agentController.executePreset);
router.get('/workflows', tierValidator.validateTier, agentController.getWorkflows);
router.post('/compare', tierValidator.requireFeature('agentic-chains'), validateRequest('comparison'), agentController.compare);
router.post('/chain', tierValidator.requireFeature('agentic-chains'), validateRequest('comparison'), agentController.chain);

// Autonomous execution endpoints
router.post('/plan', tierValidator.requireFeature('multi-step-autonomous'), validateRequest('agent'), agentController.initializePlan);
router.post('/next', tierValidator.requireFeature('multi-step-autonomous'), agentController.executeNext);
router.post('/undo', tierValidator.requireFeature('multi-step-autonomous'), agentController.undo);
router.get('/status', tierValidator.validateTier, agentController.getStatus);
router.post('/step/:stepIndex', tierValidator.requireFeature('multi-step-autonomous'), agentController.executeStepByIndex);

module.exports = router;
