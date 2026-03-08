/**
 * Python AI Service Bridge
 * 
 * Connects Node.js backend to Python FastAPI service running AutoGen agents.
 * Routes complex AI tasks to Python when beneficial.
 */

const axios = require('axios');
const logger = require('../../utils/logger');

class PythonBridge {
  constructor() {
    this.serviceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
    this.enabled = process.env.ENABLE_PYTHON_SERVICE === 'true';
    this.timeout = parseInt(process.env.PYTHON_SERVICE_TIMEOUT || '120000'); // 2 minutes
    this.fallbackToNode = true;
    this.isHealthy = false;
    
    // Check service health on startup
    if (this.enabled) {
      this.checkHealth();
    }
  }

  /**
   * Check if Python service is available
   */
  async checkHealth() {
    try {
      const response = await axios.get(`${this.serviceUrl}/health`, {
        timeout: 5000
      });
      
      this.isHealthy = response.data.status === 'healthy';
      
      if (this.isHealthy) {
        logger.info('✅ Python AI service is healthy');
      }
      
      return this.isHealthy;
    } catch (error) {
      this.isHealthy = false;
      logger.warn('⚠️ Python AI service not available:', error.message);
      return false;
    }
  }

  /**
   * Decide if task should use Python service
   */
  shouldUsePython(task, context = {}) {
    if (!this.enabled || !this.isHealthy) {
      return false;
    }

    // Use Python for specific complex tasks
    const pythonTaskTypes = [
      'complex_code_generation',
      'architecture_design',
      'code_review',
      'complex_reasoning',
      'multi_step_planning'
    ];

    if (pythonTaskTypes.includes(context.taskType)) {
      return true;
    }

    // Use Python for large codebases or complex logic
    if (context.complexity === 'high' || context.linesOfCode > 500) {
      return true;
    }

    // Use Python if explicitly requested
    if (context.preferPython === true) {
      return true;
    }

    return false;
  }

  /**
   * Map HybridMind agent roles to Python agent types
   */
  mapAgentType(agentRole) {
    const mapping = {
      'architect': 'architect',
      'coder': 'code_generator',
      'reviewer': 'code_reviewer',
      'planner': 'reasoner',
      'tester': 'code_reviewer',
      'debugger': 'reasoner',
      'documenter': 'code_generator',
      'optimizer': 'code_reviewer',
      'security': 'code_reviewer',
      'refactorer': 'code_generator'
    };

    return mapping[agentRole] || 'reasoner';
  }

  /**
   * Execute task with Python AutoGen agent
   */
  async executeAgent({
    task,
    agentRole,
    context = {},
    temperature = 0.7,
    maxIterations = 10
  }) {
    try {
      logger.info(`🐍 Routing task to Python ${agentRole} agent`);

      const pythonAgentType = this.mapAgentType(agentRole);

      const response = await axios.post(
        `${this.serviceUrl}/agent/execute`,
        {
          task,
          agent_type: pythonAgentType,
          context,
          temperature,
          max_iterations: maxIterations
        },
        { timeout: this.timeout }
      );

      if (response.data.success) {
        logger.info(`✅ Python agent completed in ${response.data.execution_time}s`);
        
        return {
          success: true,
          result: response.data.result,
          metadata: {
            source: 'python_service',
            agentType: pythonAgentType,
            iterations: response.data.iterations,
            executionTime: response.data.execution_time,
            ...response.data.metadata
          }
        };
      } else {
        throw new Error(response.data.result);
      }

    } catch (error) {
      logger.error('❌ Python service error:', error.message);

      if (this.fallbackToNode) {
        logger.info('↩️ Falling back to Node.js agent');
        return {
          success: false,
          shouldFallback: true,
          error: error.message
        };
      }

      throw error;
    }
  }

  /**
   * Execute multi-agent team collaboration in Python
   */
  async executeTeamCollaboration({
    task,
    agentRoles = [],
    context = {},
    temperature = 0.7
  }) {
    try {
      logger.info(`🐍 Routing team collaboration to Python service`);

      const pythonAgentTypes = agentRoles.map(role => this.mapAgentType(role));

      const response = await axios.post(
        `${this.serviceUrl}/agent/team-collaboration`,
        {
          task,
          agents: pythonAgentTypes,
          context,
          temperature
        },
        { timeout: this.timeout }
      );

      if (response.data.success) {
        logger.info(`✅ Python team collaboration completed in ${response.data.execution_time}s`);
        
        return {
          success: true,
          result: response.data.result,
          metadata: {
            source: 'python_service',
            agentsUsed: response.data.agents_used,
            executionTime: response.data.execution_time,
            chatHistory: response.data.chat_history
          }
        };
      } else {
        throw new Error(response.data.error);
      }

    } catch (error) {
      logger.error('❌ Python team collaboration error:', error.message);

      if (this.fallbackToNode) {
        logger.info('↩️ Falling back to Node.js agents');
        return {
          success: false,
          shouldFallback: true,
          error: error.message
        };
      }

      throw error;
    }
  }

  /**
   * Get available Python agent types
   */
  async getAvailableAgents() {
    try {
      const response = await axios.get(`${this.serviceUrl}/agent/types`, {
        timeout: 5000
      });
      
      return response.data.agent_types;
    } catch (error) {
      logger.error('Failed to get Python agent types:', error.message);
      return [];
    }
  }

  /**
   * Enable/disable Python service
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    logger.info(`Python service ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      healthy: this.isHealthy,
      url: this.serviceUrl,
      timeout: this.timeout,
      fallbackToNode: this.fallbackToNode
    };
  }
}

// Singleton instance
const pythonBridge = new PythonBridge();

module.exports = pythonBridge;
