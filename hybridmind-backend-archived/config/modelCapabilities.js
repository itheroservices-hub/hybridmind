/**
 * Model Capabilities Database
 * 
 * Comprehensive database of AI model strengths, weaknesses, costs, and optimal use cases.
 * Used for intelligent model selection in multi-model agent chains.
 */

/**
 * Model capability ratings (1-10 scale)
 */
const MODEL_CAPABILITIES = {
  // OpenAI Models
  'openai/o1': {
    provider: 'openai',
    name: 'GPT o1',
    category: 'reasoning',
    capabilities: {
      reasoning: 10,
      planning: 10,
      codeGeneration: 7,
      codeReview: 9,
      documentation: 8,
      research: 9,
      creativity: 8,
      speed: 3,
      costEfficiency: 2
    },
    strengths: [
      'Deep reasoning and logic',
      'Complex problem solving',
      'Strategic planning',
      'Edge case identification',
      'Multi-step analysis'
    ],
    weaknesses: [
      'Slower response times',
      'Higher cost per token',
      'Overkill for simple tasks'
    ],
    pricing: {
      input: 15.0,   // per 1M tokens
      output: 60.0
    },
    contextWindow: 128000,
    bestFor: ['planner', 'analyst', 'architect', 'strategist'],
    notRecommendedFor: ['simple-tasks', 'bulk-generation', 'real-time']
  },

  'openai/gpt-4-turbo': {
    provider: 'openai',
    name: 'GPT-4 Turbo',
    category: 'general',
    capabilities: {
      reasoning: 9,
      planning: 9,
      codeGeneration: 8,
      codeReview: 9,
      documentation: 9,
      research: 8,
      creativity: 9,
      speed: 6,
      costEfficiency: 4
    },
    strengths: [
      'Excellent all-rounder',
      'Strong reasoning',
      'Good code quality',
      'Detailed explanations'
    ],
    weaknesses: [
      'Expensive',
      'Slower than specialized models',
      'Not best-in-class for any one thing'
    ],
    pricing: {
      input: 10.0,
      output: 30.0
    },
    contextWindow: 128000,
    bestFor: ['reviewer', 'analyst', 'documenter', 'general'],
    notRecommendedFor: ['bulk-coding', 'speed-critical']
  },

  'openai/gpt-3.5-turbo': {
    provider: 'openai',
    name: 'GPT-3.5 Turbo',
    category: 'fast',
    capabilities: {
      reasoning: 6,
      planning: 6,
      codeGeneration: 7,
      codeReview: 6,
      documentation: 7,
      research: 6,
      creativity: 7,
      speed: 9,
      costEfficiency: 9
    },
    strengths: [
      'Very fast',
      'Cost effective',
      'Good for simple tasks',
      'Low latency'
    ],
    weaknesses: [
      'Limited reasoning',
      'Misses edge cases',
      'Less detailed'
    ],
    pricing: {
      input: 0.5,
      output: 1.5
    },
    contextWindow: 16000,
    bestFor: ['simple-tasks', 'formatting', 'quick-responses'],
    notRecommendedFor: ['complex-reasoning', 'architecture', 'review']
  },

  // Anthropic Models
  'anthropic/claude-3-opus': {
    provider: 'anthropic',
    name: 'Claude 3 Opus',
    category: 'premium',
    capabilities: {
      reasoning: 9,
      planning: 9,
      codeGeneration: 8,
      codeReview: 10,
      documentation: 10,
      research: 9,
      creativity: 9,
      speed: 5,
      costEfficiency: 3
    },
    strengths: [
      'Best-in-class code review',
      'Exceptional documentation',
      'Deep understanding',
      'Excellent explanations',
      'Strong safety/security awareness'
    ],
    weaknesses: [
      'Very expensive',
      'Slower',
      'Can be overly cautious'
    ],
    pricing: {
      input: 15.0,
      output: 75.0
    },
    contextWindow: 200000,
    bestFor: ['reviewer', 'documenter', 'security-analyst', 'mentor'],
    notRecommendedFor: ['bulk-generation', 'speed-critical', 'simple-tasks']
  },

  'anthropic/claude-3.5-sonnet': {
    provider: 'anthropic',
    name: 'Claude 3.5 Sonnet',
    category: 'balanced',
    capabilities: {
      reasoning: 8,
      planning: 8,
      codeGeneration: 9,
      codeReview: 9,
      documentation: 9,
      research: 8,
      creativity: 8,
      speed: 7,
      costEfficiency: 7
    },
    strengths: [
      'Excellent balance',
      'Great code generation',
      'Strong review capabilities',
      'Good documentation',
      'Reliable performance'
    ],
    weaknesses: [
      'Not cheapest',
      'Not fastest for simple tasks'
    ],
    pricing: {
      input: 3.0,
      output: 15.0
    },
    contextWindow: 200000,
    bestFor: ['builder', 'reviewer', 'documenter', 'general'],
    notRecommendedFor: ['budget-critical', 'ultra-fast-needed']
  },

  'anthropic/claude-3-haiku': {
    provider: 'anthropic',
    name: 'Claude 3 Haiku',
    category: 'fast',
    capabilities: {
      reasoning: 7,
      planning: 6,
      codeGeneration: 7,
      codeReview: 7,
      documentation: 7,
      research: 6,
      creativity: 7,
      speed: 9,
      costEfficiency: 9
    },
    strengths: [
      'Very fast',
      'Cost effective',
      'Good quality for price',
      'Low latency'
    ],
    weaknesses: [
      'Less capable than Sonnet',
      'Simpler reasoning'
    ],
    pricing: {
      input: 0.25,
      output: 1.25
    },
    contextWindow: 200000,
    bestFor: ['simple-tasks', 'formatting', 'quick-fixes'],
    notRecommendedFor: ['complex-reasoning', 'architecture']
  },

  // DeepSeek Models
  'deepseek/qwen-3-480b-coder': {
    provider: 'deepseek',
    name: 'Qwen 3 480B Coder',
    category: 'specialist',
    capabilities: {
      reasoning: 7,
      planning: 6,
      codeGeneration: 10,
      codeReview: 7,
      documentation: 6,
      research: 5,
      creativity: 7,
      speed: 8,
      costEfficiency: 9
    },
    strengths: [
      'Best-in-class code generation',
      'Very fast coding',
      'Cost effective',
      'Specialized for programming',
      'Multiple languages'
    ],
    weaknesses: [
      'Weaker reasoning',
      'Not great for planning',
      'Documentation could be better',
      'Limited non-coding tasks'
    ],
    pricing: {
      input: 2.0,
      output: 6.0
    },
    contextWindow: 32000,
    bestFor: ['builder', 'coder', 'implementer', 'refactorer'],
    notRecommendedFor: ['planning', 'research', 'documentation', 'review']
  },

  // Google Models
  'google/gemini-pro-1.5': {
    provider: 'google',
    name: 'Gemini Pro 1.5',
    category: 'balanced',
    capabilities: {
      reasoning: 8,
      planning: 7,
      codeGeneration: 8,
      codeReview: 7,
      documentation: 9,
      research: 9,
      creativity: 8,
      speed: 7,
      costEfficiency: 8
    },
    strengths: [
      'Excellent documentation',
      'Strong research capabilities',
      'Good all-rounder',
      'Large context window',
      'Cost effective'
    ],
    weaknesses: [
      'Not best-in-class for coding',
      'Sometimes verbose'
    ],
    pricing: {
      input: 1.25,
      output: 5.0
    },
    contextWindow: 1000000,
    bestFor: ['documenter', 'researcher', 'analyst', 'general'],
    notRecommendedFor: ['specialized-coding', 'speed-critical']
  },

  // Groq Models (ultra-fast)
  'groq/llama-3.1-70b-versatile': {
    provider: 'groq',
    name: 'Llama 3.1 70B',
    category: 'fast',
    capabilities: {
      reasoning: 7,
      planning: 6,
      codeGeneration: 8,
      codeReview: 6,
      documentation: 7,
      research: 6,
      creativity: 7,
      speed: 10,
      costEfficiency: 10
    },
    strengths: [
      'Ultra-fast (100ms TTFB)',
      'Very cheap',
      'Good code generation',
      'Real-time capable'
    ],
    weaknesses: [
      'Limited reasoning depth',
      'Simpler than GPT-4',
      'Less reliable for complex tasks'
    ],
    pricing: {
      input: 0.59,
      output: 0.79
    },
    contextWindow: 128000,
    bestFor: ['simple-tasks', 'real-time', 'bulk-generation', 'formatting'],
    notRecommendedFor: ['complex-reasoning', 'architecture', 'critical-review']
  },

  'groq/llama-3.1-8b-instant': {
    provider: 'groq',
    name: 'Llama 3.1 8B Instant',
    category: 'ultra-fast',
    capabilities: {
      reasoning: 5,
      planning: 4,
      codeGeneration: 6,
      codeReview: 5,
      documentation: 6,
      research: 5,
      creativity: 6,
      speed: 10,
      costEfficiency: 10
    },
    strengths: [
      'Fastest model available',
      'Extremely cheap',
      'Good for trivial tasks',
      'Sub-second responses'
    ],
    weaknesses: [
      'Limited capabilities',
      'Not suitable for complex work',
      'Basic reasoning only'
    ],
    pricing: {
      input: 0.05,
      output: 0.08
    },
    contextWindow: 8000,
    bestFor: ['trivial-tasks', 'formatting', 'simple-fixes', 'batch-processing'],
    notRecommendedFor: ['anything-complex', 'reasoning', 'planning', 'review']
  }
};

/**
 * Task type to capability mapping
 */
const TASK_CAPABILITY_REQUIREMENTS = {
  'planning': {
    primary: 'planning',
    secondary: ['reasoning'],
    minimum: 7
  },
  'architecture': {
    primary: 'planning',
    secondary: ['reasoning', 'codeGeneration'],
    minimum: 8
  },
  'code-generation': {
    primary: 'codeGeneration',
    secondary: ['reasoning'],
    minimum: 7
  },
  'code-review': {
    primary: 'codeReview',
    secondary: ['reasoning', 'codeGeneration'],
    minimum: 8
  },
  'documentation': {
    primary: 'documentation',
    secondary: ['codeGeneration'],
    minimum: 7
  },
  'research': {
    primary: 'research',
    secondary: ['reasoning'],
    minimum: 7
  },
  'refactoring': {
    primary: 'codeGeneration',
    secondary: ['codeReview', 'reasoning'],
    minimum: 7
  },
  'debugging': {
    primary: 'reasoning',
    secondary: ['codeGeneration', 'codeReview'],
    minimum: 7
  },
  'simple-task': {
    primary: 'speed',
    secondary: ['costEfficiency'],
    minimum: 5
  }
};

/**
 * Pre-configured model combinations for common workflows
 */
const MODEL_CHAIN_TEMPLATES = {
  'coding-standard': {
    name: 'Standard Coding Chain',
    description: 'Balanced speed and quality for feature development',
    roles: {
      planner: 'anthropic/claude-3.5-sonnet',
      builder: 'deepseek/qwen-3-480b-coder',
      reviewer: 'anthropic/claude-3.5-sonnet'
    },
    estimatedCost: 'medium',
    estimatedSpeed: 'fast'
  },
  
  'coding-premium': {
    name: 'Premium Coding Chain',
    description: 'Highest quality for critical features',
    roles: {
      planner: 'openai/o1',
      builder: 'anthropic/claude-3.5-sonnet',
      reviewer: 'anthropic/claude-3-opus',
      documenter: 'google/gemini-pro-1.5'
    },
    estimatedCost: 'high',
    estimatedSpeed: 'slow'
  },
  
  'coding-budget': {
    name: 'Budget Coding Chain',
    description: 'Cost-effective for simple features',
    roles: {
      planner: 'groq/llama-3.1-70b-versatile',
      builder: 'deepseek/qwen-3-480b-coder',
      reviewer: 'groq/llama-3.1-70b-versatile'
    },
    estimatedCost: 'low',
    estimatedSpeed: 'ultra-fast'
  },
  
  'research-deep': {
    name: 'Deep Research Chain',
    description: 'Comprehensive analysis and documentation',
    roles: {
      researcher: 'google/gemini-pro-1.5',
      analyst: 'openai/o1',
      documenter: 'anthropic/claude-3-opus'
    },
    estimatedCost: 'high',
    estimatedSpeed: 'slow'
  },
  
  'review-comprehensive': {
    name: 'Comprehensive Code Review',
    description: 'Multi-perspective code analysis',
    roles: {
      reviewer1: 'anthropic/claude-3-opus',
      reviewer2: 'openai/gpt-4-turbo',
      synthesizer: 'anthropic/claude-3.5-sonnet'
    },
    estimatedCost: 'high',
    estimatedSpeed: 'slow'
  },
  
  'quick-fix': {
    name: 'Quick Fix Chain',
    description: 'Fast turnaround for simple changes',
    roles: {
      analyzer: 'groq/llama-3.1-70b-versatile',
      fixer: 'groq/llama-3.1-70b-versatile'
    },
    estimatedCost: 'very-low',
    estimatedSpeed: 'instant'
  }
};

module.exports = {
  MODEL_CAPABILITIES,
  TASK_CAPABILITY_REQUIREMENTS,
  MODEL_CHAIN_TEMPLATES
};
