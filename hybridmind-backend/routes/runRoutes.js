const express = require('express');
const router = express.Router();
const runController = require('../controllers/runController');
const validateRequest = require('../middleware/validateRequest');
const tierValidator = require('../middleware/tierValidator');

/**
 * Middleware: Set workflow mode from route path before tier validation
 * This ensures validateWorkflowAccess can detect the workflow type even if
 * the extension doesn't send workflow/mode in the body
 */
function setWorkflowModeFromRoute(req, res, next) {
  // Extract workflow mode from route path
  if (req.path.includes('/chain/stream')) {
    req.workflowMode = 'chain';
  } else if (req.path.includes('/chain')) {
    req.workflowMode = 'chain';
  } else if (req.path.includes('/parallel')) {
    req.workflowMode = 'parallel';
  } else if (req.path.includes('/all-to-all')) {
    req.workflowMode = 'all-to-all';
  } else if (req.path.includes('/single')) {
    req.workflowMode = 'single';
  } else {
    // Legacy endpoint or unknown - default to single
    req.workflowMode = 'single';
  }
  next();
}

// Legacy endpoint (backward compatibility)
router.post('/', validateRequest('run'), setWorkflowModeFromRoute, tierValidator.validateTier, runController.execute);

// New explicit endpoints with tier validation
router.post('/single', validateRequest('run'), setWorkflowModeFromRoute, tierValidator.validateTier, runController.executeSingle);
router.post('/chain', validateRequest('run'), setWorkflowModeFromRoute, tierValidator.validateTier, tierValidator.validateWorkflowAccess, runController.executeChain.bind(runController));
router.post('/chain/stream', validateRequest('run'), setWorkflowModeFromRoute, tierValidator.validateTier, tierValidator.validateWorkflowAccess, runController.executeChainStream.bind(runController));
router.post('/chain/kill/:streamId', tierValidator.validateTier, runController.killChainStream.bind(runController));
router.post('/parallel', validateRequest('comparison'), setWorkflowModeFromRoute, tierValidator.validateTier, tierValidator.validateWorkflowAccess, runController.executeParallel);
router.post('/all-to-all', validateRequest('comparison'), setWorkflowModeFromRoute, tierValidator.validateTier, tierValidator.validateWorkflowAccess, runController.executeAllToAll);

module.exports = router;
