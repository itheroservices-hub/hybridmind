/**
 * HybridMind Multi-Agent System - Agent Role Definitions
 * 
 * Defines specialized agent roles for collaborative AI workflows.
 * Each role has specific capabilities, models, and responsibilities.
 * 
 * Supports 2/4/6 model configurations based on subscription tier:
 * - Free: 2 agents (researcher + coder)
 * - Pro: 4 agents (researcher + planner + coder + reviewer)
 * - Pro-Plus: 6 agents (analyst + researcher + planner + coder + reviewer + optimizer)
 * - Enterprise: 10 agents (full suite with specialists)
 */

/**
 * Agent Role Types
 */
const AGENT_ROLES = {
  ANALYST: 'analyst',
  RESEARCHER: 'researcher',
  PLANNER: 'planner',
  CODER: 'coder',
  REVIEWER: 'reviewer',
  OPTIMIZER: 'optimizer',
  TESTER: 'tester',
  DOCUMENTER: 'documenter',
  DEBUGGER: 'debugger',
  ARCHITECT: 'architect'
};

/**
 * Agent Role Definitions with Capabilities
 */
const ROLE_DEFINITIONS = {
  [AGENT_ROLES.ANALYST]: {
    name: 'Analyst',
    description: 'Analyzes requirements, code structure, and project context',
    icon: '🔍',
    goal: 'Deeply understand the problem space, identify patterns, assess risks, and provide comprehensive analysis that guides optimal solutions',
    backstory: 'You are a senior software analyst with 15 years of experience in system architecture and requirement analysis. You have a keen eye for spotting edge cases, dependencies, and potential issues before they become problems. Your analytical approach has saved countless projects from costly mistakes.',
    capabilities: [
      'requirement-analysis',
      'code-analysis',
      'dependency-analysis',
      'complexity-assessment',
      'risk-assessment',
      'architecture-review'
    ],
    preferredModels: {
      quality: ['anthropic/claude-3.5-sonnet', 'openai/o1', 'google/gemini-2.5-flash'],
      balanced: ['meta-llama/llama-3.3-70b-instruct', 'deepseek/deepseek-chat'],
      cost: ['meta-llama/llama-3.3-70b-instruct', 'google/gemini-2.0-flash-exp']
    },
    contextWindow: 'large', // Needs large context for full codebase analysis
    specialization: 'Understanding and breaking down complex problems',
    priority: 1, // Runs first
    tier: 'pro-plus' // Available in Pro-Plus and above
  },

  [AGENT_ROLES.RESEARCHER]: {
    name: 'Researcher',
    description: 'Searches codebases, documentation, and external resources',
    icon: '📚',
    goal: 'Find the most relevant, accurate, and up-to-date information to support informed decision-making and implementation',
    backstory: 'You are an expert research specialist with encyclopedic knowledge of programming frameworks, libraries, and best practices. You excel at quickly finding exactly the right documentation, examples, and solutions. Your research skills have helped teams avoid reinventing wheels and adopt proven patterns.',
    capabilities: [
      'code-search',
      'documentation-search',
      'example-finding',
      'api-research',
      'best-practices-lookup',
      'framework-knowledge'
    ],
    preferredModels: {
      quality: ['google/gemini-2.5-flash', 'anthropic/claude-3.5-sonnet'],
      balanced: ['google/gemini-2.0-flash-exp', 'meta-llama/llama-3.3-70b-instruct'],
      cost: ['google/gemini-2.0-flash-exp', 'meta-llama/llama-3.1-8b-instruct']
    },
    contextWindow: 'medium',
    specialization: 'Finding relevant information and examples',
    priority: 2,
    tier: 'free' // Available to all tiers
  },

  [AGENT_ROLES.PLANNER]: {
    name: 'Planner',
    description: 'Creates execution plans and coordinates workflow steps',
    icon: '📋',
    goal: 'Create comprehensive, step-by-step execution plans that account for dependencies, edge cases, and optimal sequencing',
    backstory: 'You are a strategic planning expert with deep experience in software project management and system design. Your plans are known for their clarity, completeness, and anticipation of potential issues. You break down complex problems into manageable steps that teams can execute with confidence.',
    capabilities: [
      'task-breakdown',
      'step-sequencing',
      'dependency-mapping',
      'priority-assignment',
      'resource-allocation',
      'workflow-design'
    ],
    preferredModels: {
      quality: ['openai/o1', 'anthropic/claude-3.5-sonnet'],
      balanced: ['openai/o1-mini', 'deepseek/deepseek-chat'],
      cost: ['meta-llama/llama-3.3-70b-instruct', 'qwen/qwen3-coder-flash']
    },
    contextWindow: 'medium',
    specialization: 'Creating structured, actionable plans',
    priority: 3,
    tier: 'pro' // Available in Pro and above
  },

  [AGENT_ROLES.CODER]: {
    name: 'Coder',
    description: 'Writes, modifies, and generates code',
    icon: '⚡',
    goal: 'Write clean, efficient, production-ready code that follows best practices and is easy to maintain',
    backstory: 'You are a highly skilled software engineer specialized in writing high-quality code. You have mastered multiple programming languages and frameworks. Your code is known for being elegant, performant, and well-structured. You take pride in writing code that other developers enjoy working with.',
    capabilities: [
      'code-generation',
      'code-modification',
      'refactoring',
      'bug-fixing',
      'feature-implementation',
      'api-integration'
    ],
    preferredModels: {
      quality: ['qwen/qwen3-coder-plus', 'deepseek/deepseek-chat', 'anthropic/claude-3.5-sonnet'],
      balanced: ['qwen/qwen3-coder-flash', 'deepseek/deepseek-chat'],
      cost: ['qwen/qwen3-coder-flash', 'meta-llama/llama-3.3-70b-instruct']
    },
    contextWindow: 'large', // Needs context for understanding existing code
    specialization: 'Writing high-quality, maintainable code',
    priority: 4,
    tier: 'free' // Available to all tiers
  },

  [AGENT_ROLES.REVIEWER]: {
    name: 'Reviewer',
    description: 'Reviews code quality, security, and best practices',
    icon: '✅',
    goal: 'Ensure code meets the highest standards for quality, security, performance, and maintainability through thorough review',
    backstory: 'You are a senior code reviewer with expertise in security, performance optimization, and best practices across multiple languages and frameworks. Your reviews are thorough, constructive, and have caught countless bugs before they reached production. You have a gift for explaining complex issues clearly and suggesting actionable improvements.',
    capabilities: [
      'code-review',
      'security-audit',
      'performance-review',
      'best-practices-check',
      'standards-compliance',
      'quality-assessment'
    ],
    preferredModels: {
      quality: ['anthropic/claude-3.5-sonnet', 'openai/o1'],
      balanced: ['anthropic/claude-3.5-sonnet', 'deepseek/deepseek-chat'],
      cost: ['meta-llama/llama-3.3-70b-instruct', 'qwen/qwen3-coder-flash']
    },
    contextWindow: 'large',
    specialization: 'Ensuring code quality and security',
    priority: 5,
    tier: 'pro' // Available in Pro and above
  },

  [AGENT_ROLES.OPTIMIZER]: {
    name: 'Optimizer',
    description: 'Optimizes code for performance and efficiency',
    icon: '🚀',
    goal: 'Maximize performance, minimize resource usage, and ensure systems run at peak efficiency',
    backstory: 'You are a performance optimization specialist with deep knowledge of algorithms, data structures, and system architecture. You have a track record of making slow systems blazing fast and reducing costs through intelligent optimization. Your approach combines profiling data with algorithmic improvements to achieve measurable performance gains.',
    capabilities: [
      'performance-optimization',
      'memory-optimization',
      'algorithm-improvement',
      'database-optimization',
      'bundle-optimization',
      'caching-strategy'
    ],
    preferredModels: {
      quality: ['deepseek/deepseek-chat', 'qwen/qwen3-coder-plus'],
      balanced: ['qwen/qwen3-coder-flash', 'deepseek/deepseek-chat'],
      cost: ['meta-llama/llama-3.3-70b-instruct', 'qwen/qwen3-coder-flash']
    },
    contextWindow: 'medium',
    specialization: 'Improving code performance and efficiency',
    priority: 6,
    tier: 'pro-plus' // Available in Pro-Plus and above
  },

  [AGENT_ROLES.TESTER]: {
    name: 'Tester',
    description: 'Creates tests and validates functionality',
    icon: '🧪',
    goal: 'Create comprehensive test coverage that validates functionality, catches edge cases, and prevents regressions',
    backstory: 'You are a quality assurance expert specializing in test-driven development and comprehensive testing strategies. You have a talent for identifying edge cases that others miss and creating tests that provide confidence in code quality. Your test suites have prevented countless production issues.',
    capabilities: [
      'unit-test-generation',
      'integration-test-generation',
      'test-strategy',
      'edge-case-identification',
      'test-coverage-analysis',
      'validation-logic'
    ],
    preferredModels: {
      quality: ['anthropic/claude-3.5-sonnet', 'qwen/qwen3-coder-plus'],
      balanced: ['qwen/qwen3-coder-flash', 'meta-llama/llama-3.3-70b-instruct'],
      cost: ['meta-llama/llama-3.3-70b-instruct', 'qwen/qwen3-coder-flash']
    },
    contextWindow: 'medium',
    specialization: 'Creating comprehensive test suites',
    priority: 7,
    tier: 'enterprise' // Available in Enterprise
  },

  [AGENT_ROLES.DOCUMENTER]: {
    name: 'Documenter',
    description: 'Creates documentation and explanations',
    icon: '📝',
    goal: 'Create clear, comprehensive documentation that helps developers understand and use code effectively',
    backstory: 'You are a technical writing specialist with a gift for making complex concepts accessible. Your documentation is known for being thorough yet easy to understand, with practical examples and clear explanations. You understand that great documentation saves countless hours and improves code adoption.',
    capabilities: [
      'documentation-generation',
      'comment-generation',
      'readme-creation',
      'api-documentation',
      'tutorial-creation',
      'explanation-generation'
    ],
    preferredModels: {
      quality: ['anthropic/claude-3.5-sonnet', 'google/gemini-2.5-flash'],
      balanced: ['anthropic/claude-3.5-sonnet', 'google/gemini-2.0-flash-exp'],
      cost: ['google/gemini-2.0-flash-exp', 'meta-llama/llama-3.3-70b-instruct']
    },
    contextWindow: 'large',
    specialization: 'Creating clear, comprehensive documentation',
    priority: 8,
    tier: 'enterprise' // Available in Enterprise
  },

  [AGENT_ROLES.DEBUGGER]: {
    name: 'Debugger',
    description: 'Diagnoses and fixes errors and bugs',
    icon: '🐛',
    goal: 'Quickly identify root causes of issues and implement reliable fixes that prevent similar problems in the future',
    backstory: 'You are a debugging specialist with exceptional problem-solving skills and deep understanding of how systems fail. You excel at reading stack traces, analyzing error patterns, and tracing issues to their source. Your systematic debugging approach and attention to detail make you invaluable when systems break.',
    capabilities: [
      'error-diagnosis',
      'bug-fixing',
      'stack-trace-analysis',
      'root-cause-analysis',
      'fix-validation',
      'regression-prevention'
    ],
    preferredModels: {
      quality: ['deepseek/deepseek-chat', 'anthropic/claude-3.5-sonnet'],
      balanced: ['deepseek/deepseek-chat', 'qwen/qwen3-coder-flash'],
      cost: ['meta-llama/llama-3.3-70b-instruct', 'qwen/qwen3-coder-flash']
    },
    contextWindow: 'large',
    specialization: 'Finding and fixing bugs efficiently',
    priority: 9,
    tier: 'enterprise' // Available in Enterprise
  },

  [AGENT_ROLES.ARCHITECT]: {
    name: 'Architect',
    description: 'Designs system architecture and patterns',
    icon: '🏗️',
    goal: 'Design robust, scalable, maintainable system architectures that align with business goals and technical requirements',
    backstory: 'You are a senior software architect with extensive experience designing large-scale systems. You have deep knowledge of design patterns, architectural styles, and technology trade-offs. Your architectural decisions have enabled systems to scale from startup to enterprise while remaining maintainable and cost-effective.',
    capabilities: [
      'architecture-design',
      'pattern-selection',
      'scalability-planning',
      'technology-selection',
      'system-design',
      'integration-planning'
    ],
    preferredModels: {
      quality: ['openai/o1', 'anthropic/claude-3.5-sonnet'],
      balanced: ['openai/o1-mini', 'anthropic/claude-3.5-sonnet'],
      cost: ['deepseek/deepseek-chat', 'meta-llama/llama-3.3-70b-instruct']
    },
    contextWindow: 'large',
    specialization: 'Designing robust, scalable systems',
    priority: 10,
    tier: 'enterprise' // Available in Enterprise
  }
};

/**
 * Tier-based Agent Configurations
 * Defines which agents are available and in what order for each tier
 */
const TIER_AGENT_CONFIGS = {
  free: {
    name: 'Free Tier',
    maxAgents: 2,
    agents: [
      AGENT_ROLES.RESEARCHER, // For finding examples/docs
      AGENT_ROLES.CODER       // For implementation
    ],
    workflow: 'sequential',
    description: 'Basic two-agent workflow: research then code'
  },

  pro: {
    name: 'Pro Tier',
    maxAgents: 4,
    agents: [
      AGENT_ROLES.RESEARCHER, // 1. Find information
      AGENT_ROLES.PLANNER,    // 2. Create plan
      AGENT_ROLES.CODER,      // 3. Implement
      AGENT_ROLES.REVIEWER    // 4. Review quality
    ],
    workflow: 'pipeline',
    description: 'Professional four-agent pipeline with planning and review'
  },

  'pro-plus': {
    name: 'Pro-Plus Tier',
    maxAgents: 6,
    agents: [
      AGENT_ROLES.ANALYST,    // 1. Analyze requirements
      AGENT_ROLES.RESEARCHER, // 2. Research solutions
      AGENT_ROLES.PLANNER,    // 3. Create execution plan
      AGENT_ROLES.CODER,      // 4. Implement code
      AGENT_ROLES.REVIEWER,   // 5. Review quality
      AGENT_ROLES.OPTIMIZER   // 6. Optimize performance
    ],
    workflow: 'collaborative',
    description: 'Advanced six-agent collaborative workflow with optimization'
  },

  enterprise: {
    name: 'Enterprise Tier',
    maxAgents: 10,
    agents: [
      AGENT_ROLES.ANALYST,
      AGENT_ROLES.RESEARCHER,
      AGENT_ROLES.ARCHITECT,
      AGENT_ROLES.PLANNER,
      AGENT_ROLES.CODER,
      AGENT_ROLES.TESTER,
      AGENT_ROLES.REVIEWER,
      AGENT_ROLES.OPTIMIZER,
      AGENT_ROLES.DEBUGGER,
      AGENT_ROLES.DOCUMENTER
    ],
    workflow: 'intelligent',
    description: 'Full enterprise suite with all specialist agents'
  }
};

/**
 * Task to Role Mapping
 * Maps task types to the best agent role(s) for that task
 */
const TASK_TO_ROLES = {
  'code-generation': [AGENT_ROLES.CODER, AGENT_ROLES.REVIEWER],
  'bug-fix': [AGENT_ROLES.DEBUGGER, AGENT_ROLES.REVIEWER],
  'refactoring': [AGENT_ROLES.ANALYZER, AGENT_ROLES.CODER, AGENT_ROLES.REVIEWER],
  'optimization': [AGENT_ROLES.OPTIMIZER, AGENT_ROLES.REVIEWER],
  'testing': [AGENT_ROLES.TESTER, AGENT_ROLES.REVIEWER],
  'documentation': [AGENT_ROLES.DOCUMENTER],
  'analysis': [AGENT_ROLES.ANALYST, AGENT_ROLES.RESEARCHER],
  'research': [AGENT_ROLES.RESEARCHER],
  'planning': [AGENT_ROLES.PLANNER],
  'architecture': [AGENT_ROLES.ARCHITECT, AGENT_ROLES.PLANNER],
  'review': [AGENT_ROLES.REVIEWER],
  'security-audit': [AGENT_ROLES.REVIEWER, AGENT_ROLES.ANALYST]
};

/**
 * Get agent role definition
 */
function getAgentRole(role) {
  return ROLE_DEFINITIONS[role];
}

/**
 * Get agents for tier
 */
function getAgentsForTier(tier) {
  const config = TIER_AGENT_CONFIGS[tier] || TIER_AGENT_CONFIGS.free;
  return {
    ...config,
    agentDefinitions: config.agents.map(role => ROLE_DEFINITIONS[role])
  };
}

/**
 * Get best agents for task type
 */
function getBestAgentsForTask(taskType, tier = 'free') {
  const preferredRoles = TASK_TO_ROLES[taskType] || [AGENT_ROLES.CODER];
  const tierConfig = getAgentsForTier(tier);
  
  // Filter to only agents available in tier
  const availableRoles = preferredRoles.filter(role => 
    tierConfig.agents.includes(role)
  );

  // If no preferred agents available, use tier defaults
  if (availableRoles.length === 0) {
    return tierConfig.agents.map(role => ROLE_DEFINITIONS[role]);
  }

  return availableRoles.map(role => ROLE_DEFINITIONS[role]);
}

/**
 * Get model for agent role and strategy
 */
function getModelForAgent(role, strategy = 'balanced') {
  const agentDef = ROLE_DEFINITIONS[role];
  if (!agentDef) return 'meta-llama/llama-3.3-70b-instruct'; // Fallback

  const models = agentDef.preferredModels[strategy];
  return models ? models[0] : 'meta-llama/llama-3.3-70b-instruct';
}

/**
 * Validate agent availability for tier
 */
function isAgentAvailableForTier(role, tier) {
  const agentDef = ROLE_DEFINITIONS[role];
  if (!agentDef) return false;

  const tierOrder = ['free', 'pro', 'pro-plus', 'enterprise'];
  const agentTierIndex = tierOrder.indexOf(agentDef.tier);
  const userTierIndex = tierOrder.indexOf(tier);

  return userTierIndex >= agentTierIndex;
}

/**
 * Get agent capabilities
 */
function getAgentCapabilities(role) {
  const agentDef = ROLE_DEFINITIONS[role];
  return agentDef ? agentDef.capabilities : [];
}

/**
 * Check if agent can handle task
 */
function canAgentHandleTask(role, capability) {
  const capabilities = getAgentCapabilities(role);
  return capabilities.includes(capability);
}

module.exports = {
  AGENT_ROLES,
  ROLE_DEFINITIONS,
  TIER_AGENT_CONFIGS,
  TASK_TO_ROLES,
  getAgentRole,
  getAgentsForTier,
  getBestAgentsForTask,
  getModelForAgent,
  isAgentAvailableForTier,
  getAgentCapabilities,
  canAgentHandleTask
};
