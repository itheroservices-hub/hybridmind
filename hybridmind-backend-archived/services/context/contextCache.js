/**
 * Context Cache - Efficient caching for reusable context across agent chains
 * In-memory LRU cache with TTL support
 */

const logger = require('../../utils/logger');

class ContextCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100; // Max number of entries
    this.defaultTTL = options.defaultTTL || 300000; // 5 minutes default
    
    // LRU cache implementation
    this.cache = new Map();
    this.accessOrder = [];
    
    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0
    };

    // Cleanup interval
    this.cleanupInterval = setInterval(() => this._cleanup(), 60000); // Every minute
  }

  /**
   * Get cached value
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached value or null
   */
  async get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (this._isExpired(entry)) {
      this.cache.delete(key);
      this._removeFromAccessOrder(key);
      this.stats.misses++;
      return null;
    }

    // Update access time and order
    entry.lastAccess = Date.now();
    entry.accessCount++;
    this._updateAccessOrder(key);
    
    this.stats.hits++;
    logger.debug(`Cache hit for key: ${key}`);
    
    return entry.value;
  }

  /**
   * Set cached value
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in ms (optional)
   * @returns {Promise<void>}
   */
  async set(key, value, ttl = null) {
    // Check if we need to evict
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this._evictLRU();
    }

    const entry = {
      value,
      createdAt: Date.now(),
      lastAccess: Date.now(),
      accessCount: 0,
      ttl: ttl || this.defaultTTL,
      size: this._estimateSize(value)
    };

    this.cache.set(key, entry);
    this._updateAccessOrder(key);
    
    this.stats.sets++;
    logger.debug(`Cache set for key: ${key} (TTL: ${entry.ttl}ms)`);
  }

  /**
   * Check if key exists and is valid
   * @param {string} key - Cache key
   * @returns {Promise<boolean>}
   */
  async has(key) {
    const entry = this.cache.get(key);
    return entry && !this._isExpired(entry);
  }

  /**
   * Delete cached value
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this._removeFromAccessOrder(key);
      logger.debug(`Cache deleted for key: ${key}`);
    }
    return deleted;
  }

  /**
   * Clear entire cache
   * @returns {Promise<void>}
   */
  async clear() {
    this.cache.clear();
    this.accessOrder = [];
    logger.info('Cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? this.stats.hits / (this.stats.hits + this.stats.misses)
      : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: hitRate.toFixed(3),
      evictions: this.stats.evictions,
      sets: this.stats.sets,
      estimatedMemory: this._estimateTotalSize()
    };
  }

  /**
   * Get all cache keys
   * @returns {Promise<Array>}
   */
  async keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache entries (for debugging)
   * @returns {Promise<Array>}
   */
  async entries() {
    const entries = [];
    for (const [key, entry] of this.cache.entries()) {
      if (!this._isExpired(entry)) {
        entries.push({
          key,
          createdAt: entry.createdAt,
          lastAccess: entry.lastAccess,
          accessCount: entry.accessCount,
          ttl: entry.ttl,
          size: entry.size,
          age: Date.now() - entry.createdAt
        });
      }
    }
    return entries;
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0
    };
    logger.info('Cache statistics reset');
  }

  /**
   * Destroy cache and cleanup
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
    this.accessOrder = [];
    logger.info('Cache destroyed');
  }

  // ============ Private Helper Methods ============

  /**
   * Check if entry is expired
   */
  _isExpired(entry) {
    if (!entry.ttl) return false;
    return Date.now() - entry.createdAt > entry.ttl;
  }

  /**
   * Evict least recently used entry
   */
  _evictLRU() {
    if (this.accessOrder.length === 0) return;

    // Remove oldest (first in array)
    const keyToEvict = this.accessOrder[0];
    this.cache.delete(keyToEvict);
    this.accessOrder.shift();
    
    this.stats.evictions++;
    logger.debug(`Evicted LRU entry: ${keyToEvict}`);
  }

  /**
   * Update access order for LRU
   */
  _updateAccessOrder(key) {
    // Remove from current position
    this._removeFromAccessOrder(key);
    // Add to end (most recently used)
    this.accessOrder.push(key);
  }

  /**
   * Remove key from access order
   */
  _removeFromAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Cleanup expired entries
   */
  _cleanup() {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (this._isExpired(entry)) {
        this.cache.delete(key);
        this._removeFromAccessOrder(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} expired cache entries`);
    }
  }

  /**
   * Estimate size of cached value in bytes
   */
  _estimateSize(value) {
    if (typeof value === 'string') {
      return value.length * 2; // UTF-16 = 2 bytes per char
    }

    if (typeof value === 'object' && value !== null) {
      try {
        return JSON.stringify(value).length * 2;
      } catch (e) {
        return 1000; // Default estimate
      }
    }

    return 100; // Default for primitives
  }

  /**
   * Estimate total cache size in bytes
   */
  _estimateTotalSize() {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.size;
    }
    return total;
  }

  /**
   * Get formatted memory size
   */
  _formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
}

module.exports = ContextCache;
