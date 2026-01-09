const express = require('express');
const router = express.Router();
const modelsController = require('../controllers/modelsController');

router.get('/', modelsController.getAll);
router.get('/:modelId', modelsController.getById);
router.get('/capability/:capability', modelsController.byCapability);
router.post('/recommend', modelsController.recommend);

module.exports = router;
