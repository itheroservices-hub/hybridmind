/**
 * Library Whitelist Manager
 * 
 * Manages whitelisted libraries and modules for secure code execution.
 * Configurable per language and tier.
 */

const logger = require('../../utils/logger');

/**
 * Default whitelists per language
 */
const DEFAULT_WHITELISTS = {
  javascript: {
    // Safe built-in modules
    builtins: [
      'assert', 'buffer', 'crypto', 'events', 'http', 'https',
      'path', 'querystring', 'stream', 'string_decoder', 'url',
      'util', 'zlib'
    ],
    
    // Common safe npm packages
    packages: [
      'lodash', 'moment', 'axios', 'mathjs', 'date-fns',
      'uuid', 'validator', 'joi', 'yup', 'ramda',
      'immutable', 'big.js', 'decimal.js', 'dayjs'
    ],
    
    // Always blocked
    blocked: [
      'child_process', 'cluster', 'fs', 'net', 'dgram',
      'dns', 'os', 'process', 'v8', 'vm', 'worker_threads'
    ]
  },

  python: {
    // Safe standard library
    builtins: [
      'math', 'random', 'datetime', 'json', 'collections',
      'itertools', 'functools', 're', 'string', 'decimal',
      'fractions', 'statistics', 'heapq', 'bisect', 'copy',
      'pprint', 'enum', 'typing', 'dataclasses'
    ],
    
    // Common safe packages
    packages: [
      'numpy', 'pandas', 'matplotlib', 'scipy', 'scikit-learn',
      'requests', 'beautifulsoup4', 'lxml', 'pillow', 'arrow'
    ],
    
    // Always blocked
    blocked: [
      'os', 'sys', 'subprocess', 'shutil', 'socket', 'urllib',
      'pickle', 'shelve', 'multiprocessing', 'threading',
      'ctypes', '__builtin__', 'imp', 'importlib'
    ]
  }
};

/**
 * Tier-based library limits
 */
const TIER_LIMITS = {
  free: {
    maxBuiltins: 5,
    maxPackages: 3,
    allowNetworking: false,
    allowFileSystem: false
  },
  pro: {
    maxBuiltins: 15,
    maxPackages: 10,
    allowNetworking: true,
    allowFileSystem: false
  },
  proPlus: {
    maxBuiltins: -1,  // unlimited
    maxPackages: -1,  // unlimited
    allowNetworking: true,
    allowFileSystem: true
  }
};

class LibraryWhitelist {
  constructor() {
    // Custom whitelists (user/admin configured)
    this.customWhitelists = {
      javascript: { builtins: [], packages: [], blocked: [] },
      python: { builtins: [], packages: [], blocked: [] }
    };
    
    this.stats = {
      totalChecks: 0,
      allowed: 0,
      blocked: 0,
      byLanguage: {},
      blockedModules: {}
    };
  }

  /**
   * Check if a module is allowed
   */
  isAllowed({
    module,
    language,
    tier = 'free',
    customWhitelist = null
  }) {
    this.stats.totalChecks++;
    
    language = language.toLowerCase();
    
    // Track by language
    if (!this.stats.byLanguage[language]) {
      this.stats.byLanguage[language] = { allowed: 0, blocked: 0 };
    }

    const whitelist = customWhitelist || this._getWhitelist(language);
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;

    // Check if blocked
    if (this._isBlocked(module, language, whitelist)) {
      this.stats.blocked++;
      this.stats.byLanguage[language].blocked++;
      
      // Track which modules are being blocked
      this.stats.blockedModules[module] = (this.stats.blockedModules[module] || 0) + 1;
      
      logger.warn(`Module blocked: ${module} (language: ${language}, tier: ${tier})`);
      
      return {
        allowed: false,
        reason: 'blocked',
        message: `Module '${module}' is blocked for security reasons`
      };
    }

    // Check if in whitelist
    const isBuiltin = whitelist.builtins.includes(module);
    const isPackage = whitelist.packages.includes(module);

    if (!isBuiltin && !isPackage) {
      this.stats.blocked++;
      this.stats.byLanguage[language].blocked++;
      this.stats.blockedModules[module] = (this.stats.blockedModules[module] || 0) + 1;
      
      logger.warn(`Module not in whitelist: ${module} (language: ${language})`);
      
      return {
        allowed: false,
        reason: 'not_whitelisted',
        message: `Module '${module}' is not in the whitelist`,
        availableModules: this._getAvailableModules(language, tier)
      };
    }

    // Check tier limits
    if (isBuiltin && limits.maxBuiltins !== -1) {
      // Would need to track usage per execution for this
    }

    // Check networking restriction
    const networkingModules = ['http', 'https', 'axios', 'requests', 'urllib'];
    if (networkingModules.includes(module) && !limits.allowNetworking) {
      this.stats.blocked++;
      this.stats.byLanguage[language].blocked++;
      
      return {
        allowed: false,
        reason: 'tier_restriction',
        message: `Networking modules not allowed in '${tier}' tier. Upgrade to Pro for network access.`
      };
    }

    // Check file system restriction
    const fsModules = ['fs', 'path', 'os'];
    if (fsModules.includes(module) && !limits.allowFileSystem) {
      this.stats.blocked++;
      this.stats.byLanguage[language].blocked++;
      
      return {
        allowed: false,
        reason: 'tier_restriction',
        message: `File system modules not allowed in '${tier}' tier. Upgrade to Pro Plus for file access.`
      };
    }

    this.stats.allowed++;
    this.stats.byLanguage[language].allowed++;
    
    return {
      allowed: true,
      isBuiltin,
      isPackage
    };
  }

  /**
   * Check if module is blocked
   */
  _isBlocked(module, language, whitelist) {
    const blocked = whitelist.blocked || [];
    
    // Exact match
    if (blocked.includes(module)) {
      return true;
    }

    // Partial match (e.g., 'child_process/exec' matches 'child_process')
    const moduleParts = module.split('/');
    if (blocked.includes(moduleParts[0])) {
      return true;
    }

    return false;
  }

  /**
   * Get whitelist for language
   */
  _getWhitelist(language) {
    const defaultWhitelist = DEFAULT_WHITELISTS[language] || { builtins: [], packages: [], blocked: [] };
    const customWhitelist = this.customWhitelists[language] || { builtins: [], packages: [], blocked: [] };

    return {
      builtins: [...new Set([...defaultWhitelist.builtins, ...customWhitelist.builtins])],
      packages: [...new Set([...defaultWhitelist.packages, ...customWhitelist.packages])],
      blocked: [...new Set([...defaultWhitelist.blocked, ...customWhitelist.blocked])]
    };
  }

  /**
   * Get available modules for a tier
   */
  _getAvailableModules(language, tier) {
    const whitelist = this._getWhitelist(language);
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;

    let builtins = whitelist.builtins;
    let packages = whitelist.packages;

    // Filter out networking if not allowed
    if (!limits.allowNetworking) {
      const networkingModules = ['http', 'https', 'axios', 'requests', 'urllib'];
      builtins = builtins.filter(m => !networkingModules.includes(m));
      packages = packages.filter(m => !networkingModules.includes(m));
    }

    // Filter out file system if not allowed
    if (!limits.allowFileSystem) {
      const fsModules = ['fs', 'path', 'os'];
      builtins = builtins.filter(m => !fsModules.includes(m));
      packages = packages.filter(m => !fsModules.includes(m));
    }

    return {
      builtins,
      packages,
      total: builtins.length + packages.length
    };
  }

  /**
   * Add module to whitelist
   */
  addToWhitelist({
    module,
    language,
    type = 'package' // 'builtin' or 'package'
  }) {
    language = language.toLowerCase();
    
    if (!this.customWhitelists[language]) {
      this.customWhitelists[language] = { builtins: [], packages: [], blocked: [] };
    }

    const list = type === 'builtin' 
      ? this.customWhitelists[language].builtins
      : this.customWhitelists[language].packages;

    if (!list.includes(module)) {
      list.push(module);
      logger.info(`Added ${module} to ${language} ${type} whitelist`);
      return true;
    }

    return false;
  }

  /**
   * Block module
   */
  blockModule({
    module,
    language
  }) {
    language = language.toLowerCase();
    
    if (!this.customWhitelists[language]) {
      this.customWhitelists[language] = { builtins: [], packages: [], blocked: [] };
    }

    if (!this.customWhitelists[language].blocked.includes(module)) {
      this.customWhitelists[language].blocked.push(module);
      logger.info(`Blocked ${module} for ${language}`);
      return true;
    }

    return false;
  }

  /**
   * Get whitelist for language
   */
  getWhitelist(language) {
    return this._getWhitelist(language.toLowerCase());
  }

  /**
   * Get tier limits
   */
  getTierLimits(tier) {
    return TIER_LIMITS[tier] || TIER_LIMITS.free;
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      ...this.stats,
      allowRate: this.stats.totalChecks > 0
        ? (this.stats.allowed / this.stats.totalChecks * 100).toFixed(2) + '%'
        : '0%',
      topBlockedModules: Object.entries(this.stats.blockedModules)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([module, count]) => ({ module, count }))
    };
  }
}

// Singleton instance
module.exports = new LibraryWhitelist();
