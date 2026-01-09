const express = require('express');
const router = express.Router();
const runController = require('../controllers/runController');
const validateRequest = require('../middleware/validateRequest');

// Legacy endpoint (backward compatibility)
router.post('/', validateRequest('run'), runController.execute);

// New explicit endpoints
router.post('/single', validateRequest('run'), runController.executeSingle);
router.post('/chain', validateRequest('run'), runController.executeChain);
router.post('/parallel', validateRequest('comparison'), runController.executeParallel);

module.exports = router;
