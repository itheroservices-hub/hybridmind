/**
 * Model configuration and capabilities
 */

const models = {
  'gpt-4': {
    provider: 'openai',
    name: 'GPT-4',
    maxTokens: 8192,
    capabilities: ['code-generation', 'analysis', 'refactoring', 'explanation'],
    strengths: ['reasoning', 'complex-tasks', 'multi-step'],
    costTier: 'high',
    speed: 'medium'
  },
  'gpt-4-turbo': {
    provider: 'openai',
    name: 'GPT-4 Turbo',
    maxTokens: 128000,
    capabilities: ['code-generation', 'analysis', 'refactoring', 'explanation'],
    strengths: ['reasoning', 'large-context', 'speed'],
    costTier: 'high',
    speed: 'fast'
  },
  'gpt-3.5-turbo': {
    provider: 'openai',
    name: 'GPT-3.5 Turbo',
    maxTokens: 16385,
    capabilities: ['code-generation', 'simple-analysis', 'explanation'],
    strengths: ['speed', 'cost-effective'],
    costTier: 'low',
    speed: 'fast'
  },
  'claude-3-opus': {
    provider: 'anthropic',
    name: 'Claude 3 Opus',
    maxTokens: 200000,
    capabilities: ['code-generation', 'analysis', 'refactoring', 'explanation', 'code-review'],
    strengths: ['accuracy', 'large-context', 'detailed-analysis'],
    costTier: 'high',
    speed: 'medium'
  },
  'claude-3-sonnet': {
    provider: 'anthropic',
    name: 'Claude 3 Sonnet',
    maxTokens: 200000,
    capabilities: ['code-generation', 'analysis', 'refactoring', 'explanation'],
    strengths: ['balanced', 'large-context'],
    costTier: 'medium',
    speed: 'fast'
  },
  'claude-3-haiku': {
    provider: 'anthropic',
    name: 'Claude 3 Haiku',
    maxTokens: 200000,
    capabilities: ['code-generation', 'simple-analysis', 'explanation'],
    strengths: ['speed', 'cost-effective'],
    costTier: 'low',
    speed: 'very-fast'
  },
  'qwen-max': {
    provider: 'qwen',
    name: 'Qwen Max',
    maxTokens: 8192,
    capabilities: ['code-generation', 'analysis', 'multilingual'],
    strengths: ['chinese-code', 'cost-effective'],
    costTier: 'low',
    speed: 'fast'
  },
  'qwen-plus': {
    provider: 'qwen',
    name: 'Qwen Plus',
    maxTokens: 32768,
    capabilities: ['code-generation', 'analysis', 'multilingual'],
    strengths: ['balanced', 'large-context'],
    costTier: 'low',
    speed: 'medium'
  },
  // Groq models (ultra-fast inference)
  'llama-3.3-70b': {
    provider: 'groq',
    name: 'Llama 3.3 70B',
    maxTokens: 32768,
    capabilities: ['code-generation', 'analysis', 'refactoring', 'explanation'],
    strengths: ['ultra-fast', 'cost-effective', 'reasoning'],
    costTier: 'low',
    speed: 'ultra-fast'
  },
  'llama-3.1-70b': {
    provider: 'groq',
    name: 'Llama 3.1 70B',
    maxTokens: 131072,
    capabilities: ['code-generation', 'analysis', 'large-context'],
    strengths: ['ultra-fast', 'large-context', 'cost-effective'],
    costTier: 'low',
    speed: 'ultra-fast'
  },
  'mixtral-8x7b': {
    provider: 'groq',
    name: 'Mixtral 8x7B',
    maxTokens: 32768,
    capabilities: ['code-generation', 'analysis', 'multilingual'],
    strengths: ['ultra-fast', 'multilingual', 'cost-effective'],
    costTier: 'low',
    speed: 'ultra-fast'
  },
  // DeepSeek models (coding specialists)
  'deepseek-chat': {
    provider: 'deepseek',
    name: 'DeepSeek Chat',
    maxTokens: 64000,
    capabilities: ['code-generation', 'analysis', 'refactoring', 'debugging'],
    strengths: ['coding-specialist', 'large-context', 'cost-effective'],
    costTier: 'very-low',
    speed: 'fast'
  },
  'deepseek-coder': {
    provider: 'deepseek',
    name: 'DeepSeek Coder',
    maxTokens: 64000,
    capabilities: ['code-generation', 'refactoring', 'debugging', 'code-review'],
    strengths: ['coding-expert', 'fill-in-middle', 'repository-level'],
    costTier: 'very-low',
    speed: 'fast'
  },
  // Google Gemini models
  'gemini-2.0-flash-exp': {
    provider: 'gemini',
    name: 'Gemini 2.0 Flash',
    maxTokens: 8192,
    capabilities: ['code-generation', 'analysis', 'multimodal', 'explanation'],
    strengths: ['multimodal', 'fast', 'google-integration'],
    costTier: 'low',
    speed: 'very-fast'
  },
  'gemini-1.5-pro': {
    provider: 'gemini',
    name: 'Gemini 1.5 Pro',
    maxTokens: 2097152,
    capabilities: ['code-generation', 'analysis', 'large-context', 'multimodal'],
    strengths: ['extreme-context', 'multimodal', 'reasoning'],
    costTier: 'medium',
    speed: 'medium'
  },
  // Mistral models
  'mistral-large': {
    provider: 'mistral',
    name: 'Mistral Large',
    maxTokens: 128000,
    capabilities: ['code-generation', 'analysis', 'refactoring', 'multilingual'],
    strengths: ['reasoning', 'multilingual', 'large-context'],
    costTier: 'medium',
    speed: 'fast'
  },
  'mistral-small': {
    provider: 'mistral',
    name: 'Mistral Small',
    maxTokens: 32768,
    capabilities: ['code-generation', 'simple-analysis', 'explanation'],
    strengths: ['cost-effective', 'fast', 'efficient'],
    costTier: 'low',
    speed: 'very-fast'
  },
  // xAI Grok models
  'grok-beta': {
    provider: 'xai',
    name: 'Grok Beta',
    maxTokens: 131072,
    capabilities: ['code-generation', 'analysis', 'reasoning', 'real-time'],
    strengths: ['reasoning', 'real-time-data', 'large-context'],
    costTier: 'medium',
    speed: 'fast'
  }
};

// Model selection strategies
const modelSelectionStrategies = {
  // Best model for specific tasks
  taskBased: {
    'code-review': ['deepseek-coder', 'claude-3-opus', 'gpt-4'],
    'refactoring': ['deepseek-coder', 'gpt-4', 'claude-3-sonnet'],
    'explanation': ['claude-3-sonnet', 'gpt-4', 'gemini-1.5-pro'],
    'optimization': ['deepseek-coder', 'gpt-4-turbo', 'claude-3-opus'],
    'debugging': ['deepseek-coder', 'gpt-4', 'claude-3-opus'],
    'documentation': ['claude-3-sonnet', 'gpt-4', 'mistral-large'],
    'testing': ['gpt-4', 'deepseek-coder', 'claude-3-sonnet'],
    'quick-fix': ['llama-3.3-70b', 'gpt-3.5-turbo', 'mistral-small'],
    'multilingual': ['qwen-plus', 'mixtral-8x7b', 'mistral-large']
  },
  
  // Cost-optimized chains (ultra-low cost)
  costOptimized: {
    planner: 'llama-3.3-70b',
    executor: 'deepseek-chat',
    reviewer: 'mistral-small'
  },
  
  // Quality-optimized chains
  qualityOptimized: {
    planner: 'gpt-4',
    executor: 'deepseek-coder',
    reviewer: 'claude-3-opus'
  },
  
  // Balanced chains
  balanced: {
    planner: 'llama-3.3-70b',
    executor: 'claude-3-sonnet',
    reviewer: 'mistral-large'
  },
  
  // Speed-optimized chains (ultra-fast)
  speedOptimized: {
    planner: 'llama-3.3-70b',
    executor: 'mixtral-8x7b',
    reviewer: 'gemini-2.0-flash-exp'
  }
};

module.exports = {
  models,
  modelSelectionStrategies
};
