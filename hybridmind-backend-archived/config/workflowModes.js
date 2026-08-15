/**
 * Workflow Mode Definitions and Tier Restrictions
 * 
 * Defines available workflow modes and which tiers can access them
 */

const WORKFLOW_MODES = {
  SINGLE: 'single',           // Single model execution (Free+)
  AGENT: 'agentic',           // Agentic mode with planner/executor/reviewer (Free+)
  PARALLEL: 'parallel',       // All models run independently (Pro+)
  SEQUENTIAL: 'chain',        // Models refine each other's output (Pro+)
  ALL_TO_ALL: 'all-to-all'    // All models connected in mesh network (Pro+)
};

const TIER_WORKFLOW_ACCESS = {
  'free': [
    WORKFLOW_MODES.SINGLE,
    WORKFLOW_MODES.AGENT
  ],
  'pro': [
    WORKFLOW_MODES.SINGLE,
    WORKFLOW_MODES.AGENT,
    WORKFLOW_MODES.PARALLEL,
    WORKFLOW_MODES.SEQUENTIAL
  ],
  'pro-plus': [
    WORKFLOW_MODES.SINGLE,
    WORKFLOW_MODES.AGENT,
    WORKFLOW_MODES.PARALLEL,
    WORKFLOW_MODES.SEQUENTIAL,
    WORKFLOW_MODES.ALL_TO_ALL
  ],
  'enterprise': [
    WORKFLOW_MODES.SINGLE,
    WORKFLOW_MODES.AGENT,
    WORKFLOW_MODES.PARALLEL,
    WORKFLOW_MODES.SEQUENTIAL,
    WORKFLOW_MODES.ALL_TO_ALL
  ]
};

const WORKFLOW_DESCRIPTIONS = {
  [WORKFLOW_MODES.SINGLE]: {
    name: 'Single Model',
    description: 'Execute with a single AI model',
    minModels: 1,
    maxModels: 1,
    requiredTier: 'free',
    icon: '🎯',
    characteristics: ['Simple', 'Fast', 'Cost-effective']
  },
  [WORKFLOW_MODES.AGENT]: {
    name: 'Agentic Workflow',
    description: '3-stage workflow: Planner → Executor → Reviewer',
    minModels: 1,
    maxModels: 3,
    requiredTier: 'free',
    icon: '🤖',
    characteristics: ['Structured', 'Quality-focused', 'Autonomous']
  },
  [WORKFLOW_MODES.PARALLEL]: {
    name: 'Parallel Execution',
    description: 'All models run independently and compare results',
    minModels: 2,
    maxModels: 10,
    requiredTier: 'pro',
    icon: '⚡',
    characteristics: ['Fast', 'Comparative', 'Diverse perspectives']
  },
  [WORKFLOW_MODES.SEQUENTIAL]: {
    name: 'Sequential Chain',
    description: 'Models refine output sequentially, each building on previous',
    minModels: 2,
    maxModels: 10,
    requiredTier: 'pro',
    icon: '🔗',
    characteristics: ['Iterative refinement', 'Progressive improvement', 'Context routing']
  },
  [WORKFLOW_MODES.ALL_TO_ALL]: {
    name: 'All-to-All Mesh',
    description: 'All models communicate with each other in mesh network',
    minModels: 2,
    maxModels: 10,
    requiredTier: 'pro-plus',
    icon: '🕸️',
    characteristics: ['Collaborative', 'Chaotic creativity', 'Emergent solutions', 'Most expensive']
  }
};

/**
 * Check if a tier has access to a workflow mode
 */
function hasWorkflowAccess(tier, workflowMode) {
  const normalizedTier = tier.toLowerCase();
  const allowedModes = TIER_WORKFLOW_ACCESS[normalizedTier] || TIER_WORKFLOW_ACCESS.free;
  return allowedModes.includes(workflowMode);
}

/**
 * Get available workflow modes for a tier
 */
function getAvailableWorkflows(tier) {
  const normalizedTier = tier.toLowerCase();
  const allowedModes = TIER_WORKFLOW_ACCESS[normalizedTier] || TIER_WORKFLOW_ACCESS.free;
  
  return allowedModes.map(mode => ({
    mode,
    ...WORKFLOW_DESCRIPTIONS[mode]
  }));
}

/**
 * Validate workflow mode against tier and model count
 */
function validateWorkflowMode(tier, workflowMode, modelCount) {
  const normalizedTier = tier.toLowerCase();
  
  // Check tier access
  if (!hasWorkflowAccess(normalizedTier, workflowMode)) {
    const requiredTier = WORKFLOW_DESCRIPTIONS[workflowMode]?.requiredTier || 'pro';
    return {
      valid: false,
      error: `${workflowMode} mode requires ${requiredTier.toUpperCase()} tier or higher. Your tier: ${tier.toUpperCase()}`
    };
  }
  
  // Check model count requirements
  const workflow = WORKFLOW_DESCRIPTIONS[workflowMode];
  if (!workflow) {
    return {
      valid: false,
      error: `Unknown workflow mode: ${workflowMode}`
    };
  }
  
  if (modelCount < workflow.minModels) {
    return {
      valid: false,
      error: `${workflow.name} requires at least ${workflow.minModels} model(s). Provided: ${modelCount}`
    };
  }
  
  if (modelCount > workflow.maxModels) {
    return {
      valid: false,
      error: `${workflow.name} supports up to ${workflow.maxModels} models. Provided: ${modelCount}`
    };
  }
  
  return { valid: true };
}

/**
 * Get recommended workflow for tier and model count
 */
function getRecommendedWorkflow(tier, modelCount, goal = 'quality') {
  const availableWorkflows = getAvailableWorkflows(tier);
  
  // Filter by model count compatibility
  const compatibleWorkflows = availableWorkflows.filter(wf => 
    modelCount >= wf.minModels && modelCount <= wf.maxModels
  );
  
  if (compatibleWorkflows.length === 0) {
    return null;
  }
  
  // Recommend based on goal and model count
  if (goal === 'speed' && modelCount > 1) {
    // Parallel is fastest for multiple models
    const parallel = compatibleWorkflows.find(wf => wf.mode === WORKFLOW_MODES.PARALLEL);
    if (parallel) return parallel;
  }
  
  if (goal === 'quality' && modelCount >= 2) {
    // All-to-all or sequential for quality
    const allToAll = compatibleWorkflows.find(wf => wf.mode === WORKFLOW_MODES.ALL_TO_ALL);
    if (allToAll) return allToAll;
    
    const sequential = compatibleWorkflows.find(wf => wf.mode === WORKFLOW_MODES.SEQUENTIAL);
    if (sequential) return sequential;
  }
  
  if (goal === 'cost' && modelCount === 1) {
    // Single model is most cost-effective
    const single = compatibleWorkflows.find(wf => wf.mode === WORKFLOW_MODES.SINGLE);
    if (single) return single;
  }
  
  // Default: return first compatible workflow
  return compatibleWorkflows[0];
}

module.exports = {
  WORKFLOW_MODES,
  TIER_WORKFLOW_ACCESS,
  WORKFLOW_DESCRIPTIONS,
  hasWorkflowAccess,
  getAvailableWorkflows,
  validateWorkflowMode,
  getRecommendedWorkflow
};
