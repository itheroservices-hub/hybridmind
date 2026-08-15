/**
 * User Override System
 * 
 * Allows users to configure model selection preferences via VS Code settings.
 * Supports:
 * - Auto/Manual/Template mode selection
 * - Custom model assignments for each role
 * - Budget and performance preferences
 * - Custom chain templates
 */

const logger = require('../../utils/logger');

class UserOverrideSystem {
  constructor() {
    this.userPreferences = new Map();
    this.customChains = new Map();
  }

  /**
   * Load user preferences from VS Code settings
   */
  loadPreferences(userId, vscodeSettings) {
    const prefs = {
      // Model selection mode
      mode: vscodeSettings.get('hybridmind.modelSelection.mode', 'auto'),
      
      // Budget preference
      budget: vscodeSettings.get('hybridmind.modelSelection.budget', 'medium'),
      
      // Prioritization (speed, quality, cost, balanced)
      prioritize: vscodeSettings.get('hybridmind.modelSelection.prioritize', 'balanced'),
      
      // Manual model assignments
      manualModels: {
        planner: vscodeSettings.get('hybridmind.models.planner', null),
        builder: vscodeSettings.get('hybridmind.models.builder', null),
        reviewer: vscodeSettings.get('hybridmind.models.reviewer', null),
        optimizer: vscodeSettings.get('hybridmind.models.optimizer', null),
        researcher: vscodeSettings.get('hybridmind.models.researcher', null),
        analyst: vscodeSettings.get('hybridmind.models.analyst', null),
        documenter: vscodeSettings.get('hybridmind.models.documenter', null),
        tester: vscodeSettings.get('hybridmind.models.tester', null),
        debugger: vscodeSettings.get('hybridmind.models.debugger', null),
        architect: vscodeSettings.get('hybridmind.models.architect', null)
      },
      
      // Default template
      defaultTemplate: vscodeSettings.get('hybridmind.modelSelection.defaultTemplate', null),
      
      // Auto-upgrade to better models when available
      autoUpgrade: vscodeSettings.get('hybridmind.modelSelection.autoUpgrade', false),
      
      // Fallback behavior when preferred model unavailable
      fallbackStrategy: vscodeSettings.get('hybridmind.modelSelection.fallbackStrategy', 'auto-select')
    };

    this.userPreferences.set(userId, prefs);
    logger.info(`Loaded preferences for user ${userId}`);
    
    return prefs;
  }

  /**
   * Get user preferences
   */
  getPreferences(userId) {
    return this.userPreferences.get(userId) || this._getDefaultPreferences();
  }

  /**
   * Update user preferences
   */
  updatePreferences(userId, updates) {
    const current = this.getPreferences(userId);
    const updated = { ...current, ...updates };
    this.userPreferences.set(userId, updated);
    
    logger.info(`Updated preferences for user ${userId}`, updates);
    return updated;
  }

  /**
   * Apply user overrides to chain config
   */
  applyOverrides(userId, chainConfig, tier) {
    const prefs = this.getPreferences(userId);
    
    // Apply mode override
    if (prefs.mode !== 'auto') {
      chainConfig.mode = prefs.mode;
    }

    // Apply template override
    if (prefs.defaultTemplate && chainConfig.mode === 'template') {
      chainConfig.template = prefs.defaultTemplate;
    }

    // Apply manual model overrides
    if (prefs.mode === 'manual') {
      chainConfig.models = {};
      
      for (const [role, modelId] of Object.entries(prefs.manualModels)) {
        if (modelId) {
          // Validate model is available for user's tier
          if (this._isModelAvailableForTier(modelId, tier)) {
            chainConfig.models[role] = modelId;
          } else {
            logger.warn(`Model ${modelId} not available for tier ${tier}, using auto-selection`);
          }
        }
      }
    }

    // Apply budget and prioritization
    chainConfig.budget = prefs.budget;
    chainConfig.prioritize = prefs.prioritize;

    return chainConfig;
  }

  /**
   * Save custom chain template
   */
  saveCustomChain(userId, chainName, chainConfig) {
    const userChains = this.customChains.get(userId) || {};
    userChains[chainName] = {
      ...chainConfig,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.customChains.set(userId, userChains);
    logger.info(`Saved custom chain '${chainName}' for user ${userId}`);
    
    return userChains[chainName];
  }

  /**
   * Get custom chain template
   */
  getCustomChain(userId, chainName) {
    const userChains = this.customChains.get(userId) || {};
    return userChains[chainName];
  }

  /**
   * List custom chains
   */
  listCustomChains(userId) {
    const userChains = this.customChains.get(userId) || {};
    return Object.entries(userChains).map(([name, config]) => ({
      name,
      mode: config.mode,
      models: config.models,
      createdAt: config.createdAt
    }));
  }

  /**
   * Delete custom chain
   */
  deleteCustomChain(userId, chainName) {
    const userChains = this.customChains.get(userId) || {};
    const existed = chainName in userChains;
    
    if (existed) {
      delete userChains[chainName];
      this.customChains.set(userId, userChains);
      logger.info(`Deleted custom chain '${chainName}' for user ${userId}`);
    }
    
    return existed;
  }

  /**
   * Get VS Code settings schema
   */
  getVSCodeSettingsSchema() {
    return {
      'hybridmind.modelSelection.mode': {
        type: 'string',
        enum: ['auto', 'manual', 'template'],
        default: 'auto',
        description: 'How models are selected for agent chains',
        enumDescriptions: [
          'Automatically select best models based on task requirements',
          'Manually specify which models to use for each role',
          'Use pre-configured chain templates'
        ]
      },
      'hybridmind.modelSelection.budget': {
        type: 'string',
        enum: ['low', 'medium', 'high', 'unlimited'],
        default: 'medium',
        description: 'Budget preference for model selection'
      },
      'hybridmind.modelSelection.prioritize': {
        type: 'string',
        enum: ['speed', 'quality', 'cost', 'balanced'],
        default: 'balanced',
        description: 'What to prioritize when selecting models'
      },
      'hybridmind.modelSelection.defaultTemplate': {
        type: 'string',
        enum: [
          'coding-standard',
          'coding-premium',
          'coding-budget',
          'research-deep',
          'review-comprehensive',
          'quick-fix'
        ],
        default: null,
        description: 'Default chain template to use'
      },
      'hybridmind.modelSelection.autoUpgrade': {
        type: 'boolean',
        default: false,
        description: 'Automatically upgrade to better models when available'
      },
      'hybridmind.modelSelection.fallbackStrategy': {
        type: 'string',
        enum: ['auto-select', 'use-default', 'fail'],
        default: 'auto-select',
        description: 'What to do when preferred model is unavailable'
      },
      'hybridmind.models.planner': {
        type: 'string',
        default: null,
        description: 'Model to use for planning role'
      },
      'hybridmind.models.builder': {
        type: 'string',
        default: null,
        description: 'Model to use for code building role'
      },
      'hybridmind.models.reviewer': {
        type: 'string',
        default: null,
        description: 'Model to use for code review role'
      },
      'hybridmind.models.optimizer': {
        type: 'string',
        default: null,
        description: 'Model to use for optimization role'
      },
      'hybridmind.models.researcher': {
        type: 'string',
        default: null,
        description: 'Model to use for research role'
      },
      'hybridmind.models.analyst': {
        type: 'string',
        default: null,
        description: 'Model to use for analysis role'
      },
      'hybridmind.models.documenter': {
        type: 'string',
        default: null,
        description: 'Model to use for documentation role'
      },
      'hybridmind.models.tester': {
        type: 'string',
        default: null,
        description: 'Model to use for testing role'
      },
      'hybridmind.models.debugger': {
        type: 'string',
        default: null,
        description: 'Model to use for debugging role'
      },
      'hybridmind.models.architect': {
        type: 'string',
        default: null,
        description: 'Model to use for architecture role'
      }
    };
  }

  /**
   * Generate VS Code settings JSON
   */
  generateSettingsTemplate() {
    return {
      'hybridmind.modelSelection.mode': 'auto',
      'hybridmind.modelSelection.budget': 'medium',
      'hybridmind.modelSelection.prioritize': 'balanced',
      'hybridmind.modelSelection.defaultTemplate': null,
      'hybridmind.modelSelection.autoUpgrade': false,
      'hybridmind.modelSelection.fallbackStrategy': 'auto-select',
      
      // Example manual model assignments (commented out)
      // 'hybridmind.models.planner': 'openai/o1',
      // 'hybridmind.models.builder': 'deepseek/qwen-3-480b-coder',
      // 'hybridmind.models.reviewer': 'anthropic/claude-3.5-sonnet',
      // 'hybridmind.models.optimizer': 'deepseek/deepseek-chat',
      // 'hybridmind.models.researcher': 'google/gemini-2.5-flash',
      // 'hybridmind.models.documenter': 'anthropic/claude-3.5-sonnet'
    };
  }

  /**
   * Check if model is available for tier
   */
  _isModelAvailableForTier(modelId, tier) {
    const tierModels = {
      'free': [
        'groq/llama-3.1-8b-instant',
        'groq/llama-3.1-70b-versatile',
        'openai/gpt-3.5-turbo'
      ],
      'pro': [
        'groq/llama-3.1-8b-instant',
        'groq/llama-3.1-70b-versatile',
        'openai/gpt-3.5-turbo',
        'openai/gpt-4-turbo',
        'anthropic/claude-3.5-sonnet',
        'anthropic/claude-3-haiku',
        'deepseek/qwen-3-480b-coder',
        'google/gemini-pro-1.5'
      ],
      'proPlus': ['*'] // All models
    };

    const availableModels = tierModels[tier] || tierModels.free;
    return availableModels.includes('*') || availableModels.includes(modelId);
  }

  /**
   * Get default preferences
   */
  _getDefaultPreferences() {
    return {
      mode: 'auto',
      budget: 'medium',
      prioritize: 'balanced',
      manualModels: {},
      defaultTemplate: null,
      autoUpgrade: false,
      fallbackStrategy: 'auto-select'
    };
  }
}

// Singleton instance
module.exports = new UserOverrideSystem();
