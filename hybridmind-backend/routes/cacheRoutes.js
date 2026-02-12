/**
 * Cache Routes
 * 
 * API endpoints for advanced caching system
 */

const express = require('express');
const router = express.Router();
const cacheManager = require('../services/caching/cacheManager');
const { validateTier } = require('../middleware/tierValidator');
const logger = require('../utils/logger');

/**
 * GET /api/cache/stats
 * Get cache statistics
 */
router.get('/stats', validateTier, (req, res) => {
  const type = req.query.type;
  const stats = cacheManager.getStats(type);

  res.json({
    success: true,
    stats
  });
});

/**
 * GET /api/cache/metrics
 * Get cache metrics
 */
router.get('/metrics', validateTier, (req, res) => {
  const metrics = cacheManager.getMetrics();

  res.json({
    success: true,
    metrics
  });
});

/**
 * POST /api/cache/invalidate
 * Invalidate cache entry
 */
router.post('/invalidate', validateTier, (req, res) => {
  try {
    const { type, key, cascade } = req.body;

    if (!type || !key) {
      return res.status(400).json({
        error: 'Type and key required'
      });
    }

    const deleted = cacheManager.invalidate(type, key, { cascade });

    res.json({
      success: true,
      deleted
    });

  } catch (error) {
    logger.error('Cache invalidation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/cache/invalidate-type
 * Invalidate all entries of a type
 */
router.post('/invalidate-type', validateTier, (req, res) => {
  try {
    const { type } = req.body;

    if (!type) {
      return res.status(400).json({
        error: 'Type required'
      });
    }

    const count = cacheManager.invalidateType(type);

    res.json({
      success: true,
      count
    });

  } catch (error) {
    logger.error('Cache type invalidation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/cache/clear
 * Clear all caches
 */
router.post('/clear', validateTier, (req, res) => {
  try {
    const count = cacheManager.clearAll();

    res.json({
      success: true,
      message: 'All caches cleared',
      count
    });

  } catch (error) {
    logger.error('Cache clear error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/cache/warmup
 * Warmup cache with entries
 */
router.post('/warmup', validateTier, async (req, res) => {
  try {
    const { entries } = req.body;

    if (!entries || !Array.isArray(entries)) {
      return res.status(400).json({
        error: 'Entries array required'
      });
    }

    const warmed = await cacheManager.warmup(entries);

    res.json({
      success: true,
      warmed
    });

  } catch (error) {
    logger.error('Cache warmup error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/cache/export
 * Export cache contents
 */
router.get('/export', validateTier, (req, res) => {
  const type = req.query.type;
  const data = cacheManager.exportCache(type);

  res.json({
    success: true,
    data
  });
});

module.exports = router;
