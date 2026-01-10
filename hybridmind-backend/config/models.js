/**
 * Model configuration and capabilities
 */

const models = {
  'gpt-4o': {
    provider: 'openai',
    name: 'GPT-4o',
    tier: 'premium',
    maxTokens: 131072,
    capabilities: ['code-generation', 'reasoning', 'analysis', 'vision'],
    strengths: ['latest', 'multimodal', 'fast'],
    costTier: 'premium',
    speed: 'fast',
    description: 'Latest GPT-4 with vision and advanced capabilities'
  },
  'gpt-4-turbo': {
    provider: 'openai',
    name: 'GPT-4 Turbo',
    tier: 'premium',
    maxTokens: 131072,
    capabilities: ['code-generation', 'analysis', 'refactoring', 'explanation'],
    strengths: ['reasoning', 'large-context', 'speed'],
    costTier: 'premium',
    speed: 'fast',
    description: 'Fast and powerful GPT-4 variant'
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
  // PREMIUM TIER - Expensive models
  'claude-sonnet-4.5': {
    provider: 'anthropic',
    name: 'Claude Sonnet 4.5',
    tier: 'premium',
    maxTokens: 131072,
    capabilities: ['code-generation', 'reasoning', 'analysis', 'vision'],
    strengths: ['intelligence', 'reasoning', 'accuracy'],
    costTier: 'premium',
    speed: 'standard',
    description: 'Most intelligent model for complex reasoning'
  },
  'claude-3-opus': {
    provider: 'anthropic',
    name: 'Claude 3 Opus',
    tier: 'premium',
    maxTokens: 131072,
    capabilities: ['code-generation', 'analysis', 'refactoring', 'explanation', 'code-review'],
    strengths: ['accuracy', 'large-context', 'detailed-analysis'],
    costTier: 'premium',
    speed: 'medium',
    description: 'Highly capable reasoning model'
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
  // FREE TIER - Your API keys, no cost or nearly free
  'llama-3.3-70b': {
    provider: 'groq',
    name: 'Llama 3.3 70B',
    tier: 'free',
    maxTokens: 32768,
    capabilities: ['code-generation', 'analysis', 'refactoring', 'explanation'],
    strengths: ['ultra-fast', 'free', 'reasoning'],
    costTier: 'free',
    speed: 'ultra-fast',
    description: 'Lightning-fast 70B model, perfect for coding'
  },
  'mixtral-8x7b': {
    provider: 'groq',
    name: 'Mixtral 8x7B',
    tier: 'free',
    maxTokens: 32768,
    capabilities: ['code-generation', 'analysis', 'multilingual'],
    strengths: ['ultra-fast', 'multilingual', 'free'],
    costTier: 'free',
    speed: 'ultra-fast',
    description: 'Fast mixture-of-experts model'
  },
  'gemini-flash': {
    provider: 'gemini',
    name: 'Gemini 2.0 Flash',
    tier: 'free',
    maxTokens: 32768,
    capabilities: ['code-generation', 'analysis', 'explanation', 'vision'],
    strengths: ['fast', 'free', 'multimodal'],
    costTier: 'free',
    speed: 'fast',
    description: 'Google\'s fast, free multimodal model'
  },
  'deepseek-v3': {
    provider: 'deepseek',
    name: 'DeepSeek V3',
    tier: 'free',
    maxTokens: 32768,
    capabilities: ['code-generation', 'reasoning', 'analysis'],
    strengths: ['cost-effective', 'reasoning', 'coding'],
    costTier: 'free',
    speed: 'fast',
    description: 'Extremely cost-effective reasoning model'
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
  },
  
  // OPENROUTER PREMIUM MODELS (Pay-as-you-go)
  'openai/gpt-4o': {
    provider: 'openrouter',
    name: 'GPT-4o',
    tier: 'premium',
    maxTokens: 128000,
    capabilities: ['code-generation', 'reasoning', 'analysis', 'vision'],
    strengths: ['latest', 'multimodal', 'fast'],
    costTier: 'premium',
    speed: 'fast',
    description: 'Latest GPT-4 via OpenRouter'
  },
  'openai/gpt-4-turbo': {
    provider: 'openrouter',
    name: 'GPT-4 Turbo',
    tier: 'premium',
    maxTokens: 128000,
    capabilities: ['code-generation', 'analysis', 'refactoring'],
    strengths: ['reasoning', 'large-context', 'speed'],
    costTier: 'premium',
    speed: 'fast',
    description: 'Fast GPT-4 variant via OpenRouter'
  },
  'anthropic/claude-sonnet-4': {
    provider: 'openrouter',
    name: 'Claude Sonnet 4',
    tier: 'premium',
    maxTokens: 200000,
    capabilities: ['code-generation', 'reasoning', 'analysis'],
    strengths: ['intelligence', 'reasoning', 'accuracy'],
    costTier: 'premium',
    speed: 'standard',
    description: 'Anthropic\'s most intelligent model'
  },
  'anthropic/claude-opus-4': {
    provider: 'openrouter',
    name: 'Claude Opus 4',
    tier: 'premium',
    maxTokens: 200000,
    capabilities: ['code-generation', 'analysis', 'refactoring', 'code-review'],
    strengths: ['accuracy', 'large-context', 'detailed-analysis'],
    costTier: 'premium',
    speed: 'medium',
    description: 'Most capable Claude model'
  },
  'google/gemini-2.5-pro': {
    provider: 'openrouter',
    name: 'Gemini 2.5 Pro',
    tier: 'premium',
    maxTokens: 1000000,
    capabilities: ['code-generation', 'analysis', 'multimodal', 'reasoning'],
    strengths: ['huge-context', 'multimodal', 'latest'],
    costTier: 'medium',
    speed: 'fast',
    description: 'Latest Gemini Pro with 1M context'
  },
  'google/gemini-2.5-flash': {
    provider: 'openrouter',
    name: 'Gemini 2.5 Flash',
    tier: 'premium',
    maxTokens: 100000,
    capabilities: ['code-generation', 'analysis', 'multimodal'],
    strengths: ['fast', 'cost-effective', 'latest'],
    costTier: 'low',
    speed: 'ultra-fast',
    description: 'Latest Gemini Flash model'
  },
  'x-ai/grok-4': {
    provider: 'openrouter',
    name: 'Grok 4',
    tier: 'premium',
    maxTokens: 131072,
    capabilities: ['code-generation', 'reasoning', 'real-time'],
    strengths: ['reasoning', 'up-to-date', 'large-context'],
    costTier: 'medium',
    speed: 'fast',
    description: 'Latest Grok model via OpenRouter'
  },
  'x-ai/grok-4-fast': {
    provider: 'openrouter',
    name: 'Grok 4 Fast',
    tier: 'premium',
    maxTokens: 131072,
    capabilities: ['code-generation', 'reasoning', 'real-time'],
    strengths: ['speed', 'up-to-date', 'large-context'],
    costTier: 'medium',
    speed: 'ultra-fast',
    description: 'Fastest Grok 4 variant'
  },
  
  // ADVANCED REASONING MODELS
  'deepseek/deepseek-r1-0528': {
    provider: 'openrouter',
    name: 'DeepSeek R1 Latest',
    tier: 'premium',
    maxTokens: 64000,
    capabilities: ['advanced-reasoning', 'complex-problem-solving', 'mathematics', 'code-generation'],
    strengths: ['deep-reasoning', 'accuracy', 'open-source'],
    costTier: 'low',
    speed: 'fast',
    description: 'Latest DeepSeek reasoning model'
  },
  'openai/o3-deep-research': {
    provider: 'openrouter',
    name: 'OpenAI o3 Deep Research',
    tier: 'premium',
    maxTokens: 200000,
    capabilities: ['advanced-reasoning', 'research', 'complex-problem-solving'],
    strengths: ['deep-research', 'accuracy', 'complex-tasks'],
    costTier: 'ultra-premium',
    speed: 'slow',
    description: 'OpenAI\'s deep research model'
  },
  'microsoft/phi-4-reasoning-plus': {
    provider: 'openrouter',
    name: 'Phi-4 Reasoning Plus',
    tier: 'premium',
    maxTokens: 128000,
    capabilities: ['reasoning', 'code-generation', 'problem-solving'],
    strengths: ['cost-effective-reasoning', 'fast', 'efficient'],
    costTier: 'medium',
    speed: 'fast',
    description: 'Microsoft\'s reasoning model'
  },
  
  // DEEPSEEK REASONING MODELS
  'deepseek/deepseek-r1': {
    provider: 'openrouter',
    name: 'DeepSeek R1',
    tier: 'premium',
    maxTokens: 64000,
    capabilities: ['advanced-reasoning', 'code-generation', 'mathematics'],
    strengths: ['reasoning', 'open-source', 'cost-effective'],
    costTier: 'low',
    speed: 'fast',
    description: 'Open-source reasoning rival to o1'
  },
  'deepseek/deepseek-r1-distill-llama-70b': {
    provider: 'openrouter',
    name: 'DeepSeek R1 Distill 70B',
    tier: 'free',
    maxTokens: 64000,
    capabilities: ['reasoning', 'code-generation', 'analysis'],
    strengths: ['ultra-cheap', 'reasoning', 'distilled'],
    costTier: 'very-low',
    speed: 'fast',
    description: 'Distilled reasoning model, extremely cheap'
  },
  
  // MORE ANTHROPIC MODELS
  'anthropic/claude-opus-4.5': {
    provider: 'openrouter',
    name: 'Claude Opus 4.5',
    tier: 'premium',
    maxTokens: 200000,
    capabilities: ['code-generation', 'analysis', 'vision', 'reasoning'],
    strengths: ['intelligence', 'accuracy', 'latest'],
    costTier: 'ultra-premium',
    speed: 'medium',
    description: 'Latest Claude Opus model'
  },
  'anthropic/claude-sonnet-4.5': {
    provider: 'openrouter',
    name: 'Claude Sonnet 4.5',
    tier: 'premium',
    maxTokens: 200000,
    capabilities: ['code-generation', 'analysis', 'vision', 'reasoning'],
    strengths: ['balanced', 'coding', 'latest'],
    costTier: 'premium',
    speed: 'fast',
    description: 'Latest Claude Sonnet model'
  },
  'anthropic/claude-3.5-sonnet': {
    provider: 'openrouter',
    name: 'Claude 3.5 Sonnet',
    tier: 'premium',
    maxTokens: 200000,
    capabilities: ['code-generation', 'analysis', 'vision', 'reasoning'],
    strengths: ['balanced', 'coding', 'fast'],
    costTier: 'medium',
    speed: 'fast',
    description: 'Best balanced Claude model'
  },
  'anthropic/claude-haiku-4.5': {
    provider: 'openrouter',
    name: 'Claude Haiku 4.5',
    tier: 'premium',
    maxTokens: 200000,
    capabilities: ['code-generation', 'simple-analysis', 'explanation'],
    strengths: ['speed', 'cost-effective', 'latest'],
    costTier: 'low',
    speed: 'ultra-fast',
    description: 'Latest fastest Claude model'
  },
  'anthropic/claude-3-haiku': {
    provider: 'openrouter',
    name: 'Claude 3 Haiku',
    tier: 'premium',
    maxTokens: 200000,
    capabilities: ['code-generation', 'simple-analysis', 'explanation'],
    strengths: ['speed', 'cost-effective', 'fast'],
    costTier: 'low',
    speed: 'ultra-fast',
    description: 'Fastest Claude model'
  },
  
  // OPENAI VARIANTS
  'openai/gpt-4o-mini': {
    provider: 'openrouter',
    name: 'GPT-4o Mini',
    tier: 'premium',
    maxTokens: 128000,
    capabilities: ['code-generation', 'analysis', 'vision'],
    strengths: ['cost-effective', 'fast', 'multimodal'],
    costTier: 'low',
    speed: 'ultra-fast',
    description: 'Cheaper GPT-4o for simple tasks'
  },
  'openai/gpt-3.5-turbo': {
    provider: 'openrouter',
    name: 'GPT-3.5 Turbo',
    tier: 'premium',
    maxTokens: 16385,
    capabilities: ['code-generation', 'simple-analysis'],
    strengths: ['ultra-cheap', 'fast', 'reliable'],
    costTier: 'very-low',
    speed: 'ultra-fast',
    description: 'Most cost-effective OpenAI model'
  },
  
  // META LLAMA MODELS
  'meta-llama/llama-3.3-70b-instruct': {
    provider: 'openrouter',
    name: 'Llama 3.3 70B Instruct',
    tier: 'free',
    maxTokens: 128000,
    capabilities: ['code-generation', 'analysis', 'reasoning'],
    strengths: ['free', 'large-context', 'capable'],
    costTier: 'very-low',
    speed: 'fast',
    description: 'Latest Llama 3.3 via OpenRouter'
  },
  'meta-llama/llama-3.1-405b-instruct': {
    provider: 'openrouter',
    name: 'Llama 3.1 405B Instruct',
    tier: 'premium',
    maxTokens: 128000,
    capabilities: ['code-generation', 'reasoning', 'analysis'],
    strengths: ['massive-model', 'capable', 'open-source'],
    costTier: 'medium',
    speed: 'medium',
    description: 'Largest Llama model, very capable'
  },
  
  // MISTRAL MODELS
  'mistralai/mistral-large': {
    provider: 'openrouter',
    name: 'Mistral Large',
    tier: 'premium',
    maxTokens: 128000,
    capabilities: ['code-generation', 'reasoning', 'multilingual'],
    strengths: ['reasoning', 'multilingual', 'large-context'],
    costTier: 'medium',
    speed: 'fast',
    description: 'Mistral\'s flagship model'
  },
  'mistralai/mistral-small-3.2-24b-instruct': {
    provider: 'openrouter',
    name: 'Mistral Small 3.2',
    tier: 'premium',
    maxTokens: 32768,
    capabilities: ['code-generation', 'analysis'],
    strengths: ['cost-effective', 'fast', 'efficient'],
    costTier: 'low',
    speed: 'ultra-fast',
    description: 'Fast and cheap Mistral variant'
  },
  'mistralai/codestral-2508': {
    provider: 'openrouter',
    name: 'Codestral 2508',
    tier: 'premium',
    maxTokens: 32768,
    capabilities: ['code-generation', 'code-completion', 'fill-in-middle'],
    strengths: ['coding-specialist', 'fast', 'accurate'],
    costTier: 'low',
    speed: 'fast',
    description: 'Latest Codestral coding model'
  },
  'mistralai/devstral-2512': {
    provider: 'openrouter',
    name: 'Devstral 2512',
    tier: 'premium',
    maxTokens: 32768,
    capabilities: ['code-generation', 'debugging', 'refactoring'],
    strengths: ['dev-focused', 'fast', 'specialized'],
    costTier: 'low',
    speed: 'fast',
    description: 'Dev-focused Mistral model'
  },
  
  // GOOGLE MODELS
  'google/gemini-3-pro-preview': {
    provider: 'openrouter',
    name: 'Gemini 3 Pro Preview',
    tier: 'premium',
    maxTokens: 200000,
    capabilities: ['code-generation', 'reasoning', 'multimodal'],
    strengths: ['next-gen', 'advanced', 'experimental'],
    costTier: 'premium',
    speed: 'medium',
    description: 'Google\'s next-gen Gemini preview'
  },
  
  // SPECIALIZED MODELS
  'perplexity/sonar-pro-search': {
    provider: 'openrouter',
    name: 'Perplexity Sonar Pro',
    tier: 'premium',
    maxTokens: 127072,
    capabilities: ['real-time-search', 'code-generation', 'research'],
    strengths: ['internet-access', 'up-to-date', 'research'],
    costTier: 'medium',
    speed: 'medium',
    description: 'Perplexity with real-time internet search'
  },
  'perplexity/sonar-reasoning-pro': {
    provider: 'openrouter',
    name: 'Perplexity Sonar Reasoning',
    tier: 'premium',
    maxTokens: 127072,
    capabilities: ['real-time-search', 'reasoning', 'research'],
    strengths: ['reasoning', 'internet-access', 'research'],
    costTier: 'medium',
    speed: 'medium',
    description: 'Perplexity with reasoning and search'
  },
  'qwen/qwen-2.5-coder-32b-instruct': {
    provider: 'openrouter',
    name: 'Qwen 2.5 Coder 32B',
    tier: 'premium',
    maxTokens: 32768,
    capabilities: ['code-generation', 'debugging', 'refactoring'],
    strengths: ['coding-specialist', 'multilingual', 'cheap'],
    costTier: 'very-low',
    speed: 'fast',
    description: 'Alibaba\'s specialized coding model'
  },
  'qwen/qwen3-coder-plus': {
    provider: 'openrouter',
    name: 'Qwen 3 Coder Plus',
    tier: 'premium',
    maxTokens: 32768,
    capabilities: ['code-generation', 'debugging', 'refactoring'],
    strengths: ['coding-specialist', 'enhanced', 'multilingual'],
    costTier: 'low',
    speed: 'fast',
    description: 'Enhanced Qwen 3 coding model'
  },
  'qwen/qwen3-coder-flash': {
    provider: 'openrouter',
    name: 'Qwen 3 Coder Flash',
    tier: 'premium',
    maxTokens: 32768,
    capabilities: ['code-generation', 'debugging'],
    strengths: ['speed', 'coding-specialist', 'efficient'],
    costTier: 'very-low',
    speed: 'ultra-fast',
    description: 'Fast Qwen 3 coding model'
  }
};

// Model selection strategies
const modelSelectionStrategies = {
  // Best model for specific tasks
  taskBased: {
    'code-review': ['deepseek-coder', 'anthropic/claude-opus-4', 'openai/gpt-4o'],
    'refactoring': ['deepseek-coder', 'openai/gpt-4o', 'claude-3-sonnet'],
    'explanation': ['claude-3-sonnet', 'openai/gpt-4o', 'gemini-1.5-pro'],
    'optimization': ['deepseek-coder', 'openai/gpt-4-turbo', 'anthropic/claude-opus-4'],
    'debugging': ['deepseek-coder', 'openai/gpt-4o', 'anthropic/claude-opus-4'],
    'documentation': ['claude-3-sonnet', 'openai/gpt-4o', 'mistral-large'],
    'testing': ['openai/gpt-4o', 'deepseek-coder', 'claude-3-sonnet'],
    'quick-fix': ['llama-3.3-70b', 'gpt-3.5-turbo', 'mistral-small'],
    'multilingual': ['qwen-plus', 'mixtral-8x7b', 'mistral-large']
  },
  
  // Cost-optimized chains (ultra-low cost)
  costOptimized: {
    planner: 'llama-3.3-70b',
    executor: 'deepseek-chat',
    reviewer: 'mistral-small'
  },
  
  // Quality-optimized chains (premium models)
  qualityOptimized: {
    planner: 'openai/gpt-4o',
    executor: 'anthropic/claude-sonnet-4',
    reviewer: 'anthropic/claude-opus-4'
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
