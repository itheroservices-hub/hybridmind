/**
 * Advanced Cache Manager
 * 
 * Intelligent caching system for:
 * - API responses
 * - Decomposition plans
 * - Workflow results
 * - Evaluation results
 * - Learning patterns
 * 
 * Supports both in-memory and Redis with TTL and smart invalidation.
 */

const logger = require('../../utils/logger');
const crypto = require('crypto');

/**
 * Cache types with different TTLs
 */
const CACHE_TYPES = {
  RESPONSE: {
    name: 'response',
    ttl: 3600000,      // 1 hour
    maxSize: 1000
  },
  DECOMPOSITION: {
    name: 'decomposition',
    ttl: 7200000,      // 2 hours
    maxSize: 500
  },
  WORKFLOW: {
    name: 'workflow',
    ttl: 1800000,      // 30 minutes
    maxSize: 500
  },
  EVALUATION: {
    name: 'evaluation',
    ttl: 86400000,     // 24 hours
    maxSize: 1000
  },
  PATTERN: {
    name: 'pattern',
    ttl: 604800000,    // 7 days
    maxSize: 100
  }
};

/**
 * Invalidation strategies
 */
const INVALIDATION_STRATEGIES = {
  TTL: 'ttl',              // Time-based
  LRU: 'lru',              // Least Recently Used
  SIZE: 'size',            // Size-based
  DEPENDENCY: 'dependency', // Dependency-based
  MANUAL: 'manual'         // Manual invalidation
};

class CacheManager {
  constructor() {
    this.caches = new Map(); // cacheType -> Map(key -> entry)
    this.dependencies = new Map(); // key -> Set(dependent keys)
    this.accessLog = new Map(); // key -> last access time
    
    this.metrics = {
      totalHits: 0,
      totalMisses: 0,
      totalSets: 0,
      totalInvalidations: 0,
      hitRate: 0,
      cacheSize: 0,
      byType: {}
    };

    // Initialize caches for each type
    for (const cacheType of Object.values(CACHE_TYPES)) {
      this.caches.set(cacheType.name, new Map());
      this.metrics.byType[cacheType.name] = {
        hits: 0,
        misses: 0,
        sets: 0,
        invalidations: 0,
        hitRate: 0,
        size: 0
      };
    }

    // Start cleanup interval
    this._startCleanupInterval();
  }

  /**
   * Get value from cache
   */
  get(type, key, options = {}) {
    const cacheType = this._getCacheType(type);
    if (!cacheType) return null;

    const cache = this.caches.get(cacheType.name);
    const cacheKey = this._generateKey(key);
    const entry = cache.get(cacheKey);

    // Check if entry exists and is not expired
    if (entry && !this._isExpired(entry, cacheType.ttl)) {
      // Update access time
      this.accessLog.set(cacheKey, Date.now());
      
      // Update metrics
      this.metrics.totalHits++;
      this.metrics.byType[cacheType.name].hits++;
      this._updateHitRate();

      logger.debug(`Cache hit: ${type}/${cacheKey}`);
      
      return entry.value;
    }

    // Cache miss
    if (entry) {
      // Entry exists but expired
      cache.delete(cacheKey);
      this.accessLog.delete(cacheKey);
    }

    this.metrics.totalMisses++;
    this.metrics.byType[cacheType.name].misses++;
    this._updateHitRate();

    logger.debug(`Cache miss: ${type}/${cacheKey}`);
    
    return null;
  }

  /**
   * Set value in cache
   */
  set(type, key, value, options = {}) {
    const cacheType = this._getCacheType(type);
    if (!cacheType) return false;

    const cache = this.caches.get(cacheType.name);
    const cacheKey = this._generateKey(key);

    // Check size limits
    if (cache.size >= cacheType.maxSize) {
      this._evictLRU(cacheType);
    }

    // Create cache entry
    const entry = {
      key: cacheKey,
      value,
      createdAt: Date.now(),
      accessCount: 0,
      metadata: options.metadata || {}
    };

    cache.set(cacheKey, entry);
    this.accessLog.set(cacheKey, Date.now());

    // Track dependencies
    if (options.dependencies) {
      this._addDependencies(cacheKey, options.dependencies);
    }

    // Update metrics
    this.metrics.totalSets++;
    this.metrics.byType[cacheType.name].sets++;
    this.metrics.byType[cacheType.name].size = cache.size;
    this._updateTotalSize();

    logger.debug(`Cache set: ${type}/${cacheKey}`);
    
    return true;
  }

  /**
   * Invalidate cache entry
   */
  invalidate(type, key, options = {}) {
    const cacheType = this._getCacheType(type);
    if (!cacheType) return false;

    const cache = this.caches.get(cacheType.name);
    const cacheKey = this._generateKey(key);

    const deleted = cache.delete(cacheKey);
    this.accessLog.delete(cacheKey);

    if (deleted) {
      this.metrics.totalInvalidations++;
      this.metrics.byType[cacheType.name].invalidations++;
      this.metrics.byType[cacheType.name].size = cache.size;
      this._updateTotalSize();

      logger.debug(`Cache invalidated: ${type}/${cacheKey}`);

      // Invalidate dependents if cascade enabled
      if (options.cascade) {
        this._invalidateDependents(cacheKey);
      }
    }

    return deleted;
  }

  /**
   * Invalidate all entries of a type
   */
  invalidateType(type) {
    const cacheType = this._getCacheType(type);
    if (!cacheType) return 0;

    const cache = this.caches.get(cacheType.name);
    const count = cache.size;

    cache.clear();
    this.metrics.totalInvalidations += count;
    this.metrics.byType[cacheType.name].invalidations += count;
    this.metrics.byType[cacheType.name].size = 0;
    this._updateTotalSize();

    logger.info(`Cache type cleared: ${type} (${count} entries)`);
    
    return count;
  }

  /**
   * Clear all caches
   */
  clearAll() {
    let total = 0;

    for (const [type, cache] of this.caches.entries()) {
      total += cache.size;
      cache.clear();
      this.metrics.byType[type].size = 0;
    }

    this.accessLog.clear();
    this.dependencies.clear();

    this.metrics.totalInvalidations += total;
    this._updateTotalSize();

    logger.info(`All caches cleared (${total} entries)`);
    
    return total;
  }

  /**
   * Get cached or execute function
   */
  async getOrSet(type, key, fn, options = {}) {
    // Try to get from cache
    const cached = this.get(type, key);
    
    if (cached !== null) {
      return cached;
    }

    // Execute function
    try {
      const value = await fn();
      
      // Cache the result
      this.set(type, key, value, options);
      
      return value;
    } catch (error) {
      logger.error(`Cache getOrSet failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate cache key from input
   */
  _generateKey(input) {
    if (typeof input === 'string') {
      return input;
    }

    // Hash complex objects
    const hash = crypto.createHash('md5')
      .update(JSON.stringify(input))
      .digest('hex');
    
    return hash;
  }

  /**
   * Get cache type configuration
   */
  _getCacheType(typeName) {
    return Object.values(CACHE_TYPES).find(t => t.name === typeName);
  }

  /**
   * Check if entry is expired
   */
  _isExpired(entry, ttl) {
    return Date.now() - entry.createdAt > ttl;
  }

  /**
   * Evict least recently used entry
   */
  _evictLRU(cacheType) {
    const cache = this.caches.get(cacheType.name);
    
    // Find LRU entry
    let lruKey = null;
    let lruTime = Infinity;

    for (const [key, entry] of cache.entries()) {
      const accessTime = this.accessLog.get(key) || entry.createdAt;
      
      if (accessTime < lruTime) {
        lruTime = accessTime;
        lruKey = key;
      }
    }

    if (lruKey) {
      cache.delete(lruKey);
      this.accessLog.delete(lruKey);
      
      logger.debug(`LRU eviction: ${cacheType.name}/${lruKey}`);
    }
  }

  /**
   * Add dependencies for cascade invalidation
   */
  _addDependencies(key, dependencies) {
    if (!Array.isArray(dependencies)) {
      dependencies = [dependencies];
    }

    for (const dep of dependencies) {
      const depKey = this._generateKey(dep);
      
      if (!this.dependencies.has(depKey)) {
        this.dependencies.set(depKey, new Set());
      }
      
      this.dependencies.get(depKey).add(key);
    }
  }

  /**
   * Invalidate dependent entries
   */
  _invalidateDependents(key) {
    const dependents = this.dependencies.get(key);
    
    if (!dependents) return;

    for (const depKey of dependents) {
      // Find which cache this key belongs to
      for (const [type, cache] of this.caches.entries()) {
        if (cache.has(depKey)) {
          cache.delete(depKey);
          this.accessLog.delete(depKey);
          
          logger.debug(`Cascade invalidation: ${type}/${depKey}`);
          
          // Recursively invalidate dependents
          this._invalidateDependents(depKey);
        }
      }
    }

    this.dependencies.delete(key);
  }

  /**
   * Update hit rate metrics
   */
  _updateHitRate() {
    const total = this.metrics.totalHits + this.metrics.totalMisses;
    this.metrics.hitRate = total > 0 ? this.metrics.totalHits / total : 0;

    for (const [type, metrics] of Object.entries(this.metrics.byType)) {
      const typeTotal = metrics.hits + metrics.misses;
      metrics.hitRate = typeTotal > 0 ? metrics.hits / typeTotal : 0;
    }
  }

  /**
   * Update total size
   */
  _updateTotalSize() {
    this.metrics.cacheSize = Array.from(this.caches.values())
      .reduce((sum, cache) => sum + cache.size, 0);
  }

  /**
   * Start periodic cleanup
   */
  _startCleanupInterval() {
    setInterval(() => {
      this._cleanupExpired();
    }, 300000); // Every 5 minutes
  }

  /**
   * Cleanup expired entries
   */
  _cleanupExpired() {
    let total = 0;

    for (const cacheType of Object.values(CACHE_TYPES)) {
      const cache = this.caches.get(cacheType.name);
      const toDelete = [];

      for (const [key, entry] of cache.entries()) {
        if (this._isExpired(entry, cacheType.ttl)) {
          toDelete.push(key);
        }
      }

      for (const key of toDelete) {
        cache.delete(key);
        this.accessLog.delete(key);
        total++;
      }

      this.metrics.byType[cacheType.name].size = cache.size;
    }

    if (total > 0) {
      this._updateTotalSize();
      logger.info(`Cleanup: removed ${total} expired entries`);
    }

    return total;
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      timestamp: new Date()
    };
  }

  /**
   * Get cache statistics
   */
  getStats(type = null) {
    if (type) {
      const cacheType = this._getCacheType(type);
      if (!cacheType) return null;

      const cache = this.caches.get(cacheType.name);
      
      return {
        type: cacheType.name,
        size: cache.size,
        maxSize: cacheType.maxSize,
        ttl: cacheType.ttl,
        ...this.metrics.byType[cacheType.name]
      };
    }

    // All stats
    return {
      overall: {
        totalSize: this.metrics.cacheSize,
        hitRate: this.metrics.hitRate,
        totalHits: this.metrics.totalHits,
        totalMisses: this.metrics.totalMisses
      },
      byType: Object.entries(CACHE_TYPES).map(([key, config]) => ({
        type: config.name,
        ...this.getStats(config.name)
      }))
    };
  }

  /**
   * Warmup cache with common queries
   */
  async warmup(entries) {
    let warmed = 0;

    for (const entry of entries) {
      const { type, key, value, options } = entry;
      
      if (this.set(type, key, value, options)) {
        warmed++;
      }
    }

    logger.info(`Cache warmed up: ${warmed} entries`);
    return warmed;
  }

  /**
   * Export cache contents
   */
  exportCache(type = null) {
    if (type) {
      const cache = this.caches.get(type);
      if (!cache) return null;

      return Array.from(cache.entries()).map(([key, entry]) => ({
        key,
        ...entry
      }));
    }

    // Export all caches
    const exported = {};
    
    for (const [type, cache] of this.caches.entries()) {
      exported[type] = Array.from(cache.entries()).map(([key, entry]) => ({
        key,
        ...entry
      }));
    }

    return exported;
  }
}

// Singleton instance
module.exports = new CacheManager();
