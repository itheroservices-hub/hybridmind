/**
 * Hybrid Architecture Configuration
 * 
 * Controls routing between Node.js agents and Python AI service
 */

module.exports = {
  /**
   * Python Service Settings
   */
  pythonService: {
    // Enable/disable Python service integration
    enabled: process.env.ENABLE_PYTHON_SERVICE === 'true',
    
    // Python service URL
    url: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
    
    // Request timeout (ms)
    timeout: parseInt(process.env.PYTHON_SERVICE_TIMEOUT || '120000'),
    
    // Fallback to Node.js if Python fails
    fallbackEnabled: true,
    
    // Auto-retry on failure
    retryAttempts: 1,
  },

  /**
   * Routing Rules - When to use Python vs Node.js
   */
  routingRules: {
    // Task types that should always use Python (if available)
    pythonPreferred: [
      'complex_code_generation',
      'architecture_design',
      'complex_reasoning',
      'multi_step_planning',
      'algorithm_design'
    ],

    // Task types that should always use Node.js
    nodejsPreferred: [
      'simple_query',
      'file_operation',
      'api_call',
      'data_transformation'
    ],

    // Complexity thresholds
    complexity: {
      // Use Python for high complexity tasks
      usePythonForHighComplexity: true,
      
      // Lines of code threshold (>= this uses Python)
      largeCodebaseThreshold: 500,
      
      // Number of files threshold
      multiFileThreshold: 10
    },

    // Context-based routing
    contextRules: {
      // Use Python if context explicitly requests it
      respectPreference: true,
      
      // Use Python for tasks requiring deep reasoning
      deepReasoningTasks: ['analyze', 'architect', 'design', 'review'],
      
      // Use Node.js for quick operations
      quickOperations: ['format', 'lint', 'search', 'replace']
    }
  },

  /**
   * Agent Role Mapping
   * Maps HybridMind agent roles to Python AutoGen capabilities
   */
  agentMapping: {
    // Code-related roles
    'coder': { pythonAgent: 'code_generator', priority: 'high' },
    'reviewer': { pythonAgent: 'code_reviewer', priority: 'high' },
    'refactorer': { pythonAgent: 'code_generator', priority: 'medium' },
    'optimizer': { pythonAgent: 'code_reviewer', priority: 'medium' },
    
    // Architecture roles
    'architect': { pythonAgent: 'architect', priority: 'high' },
    'planner': { pythonAgent: 'reasoner', priority: 'high' },
    
    // Analysis roles
    'debugger': { pythonAgent: 'reasoner', priority: 'medium' },
    'tester': { pythonAgent: 'code_reviewer', priority: 'medium' },
    
    // Documentation roles
    'documenter': { pythonAgent: 'code_generator', priority: 'low' },
    
    // Security roles
    'security': { pythonAgent: 'code_reviewer', priority: 'high' }
  },

  /**
   * Performance Optimization
   */
  performance: {
    // Cache Python results (minutes)
    cacheDuration: 30,
    
    // Max concurrent Python requests
    maxConcurrent: 3,
    
    // Load balancing between Node.js and Python
    loadBalancing: {
      enabled: true,
      // If Node.js has >X concurrent tasks, route new ones to Python
      nodejsQueueThreshold: 5
    }
  },

  /**
   * Monitoring & Metrics
   */
  monitoring: {
    // Log all Python service calls
    logPythonCalls: true,
    
    // Track performance metrics
    trackMetrics: true,
    
    // Compare Python vs Node.js performance
    comparePerformance: true
  },

  /**
   * Development Settings
   */
  development: {
    // Force Python for testing
    forcePython: process.env.FORCE_PYTHON_SERVICE === 'true',
    
    // Force Node.js for testing
    forceNodejs: process.env.FORCE_NODEJS_AGENTS === 'true',
    
    // Debug mode
    debug: process.env.DEBUG_HYBRID_ROUTING === 'true'
  }
};
