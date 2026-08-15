/**
 * HybridMind Multi-Agent System - Resource Manager
 * 
 * Manages shared resources across multiple agents to prevent conflicts
 * and ensure optimal resource utilization.
 * 
 * Features:
 * - Context memory allocation
 * - API quota management  
 * - File access coordination
 * - Resource prioritization
 * - Fair resource distribution
 */

const logger = require('../../utils/logger');

class ResourceManager {
  constructor() {
    // Resource pools
    this.contextMemory = {
      total: 500000, // 500K tokens
      allocated: new Map(), // agentId -> allocated tokens
      reserved: 0
    };

    this.apiQuota = {
      total: 10000, // requests per hour
      used: 0,
      perAgent: new Map(), // agentId -> { used, limit }
      resetAt: new Date(Date.now() + 3600000)
    };

    this.fileAccess = {
      openFiles: new Map(), // filePath -> agentId
      maxConcurrent: 10,
      accessLog: []
    };

    // Resource allocation strategies
    this.allocationStrategy = 'fair'; // 'fair', 'priority', 'need-based'

    // Setup quota reset
    setInterval(() => this._resetApiQuota(), 3600000);
  }

  /**
   * Allocate context memory to agent
   */
  allocateContext(agentId, tokens, priority = 'normal') {
    const available = this.contextMemory.total - this.contextMemory.reserved;
    const current = this.contextMemory.allocated.get(agentId) || 0;

    if (tokens > available) {
      // Try to reclaim from low-priority agents
      if (priority === 'high') {
        const reclaimed = this._reclaimContext(tokens - available);
        if (reclaimed < tokens - available) {
          return {
            success: false,
            error: 'Insufficient context memory',
            available,
            requested: tokens
          };
        }
      } else {
        return {
          success: false,
          error: 'Insufficient context memory',
          available,
          requested: tokens
        };
      }
    }

    // Allocate
    this.contextMemory.allocated.set(agentId, current + tokens);
    this.contextMemory.reserved += tokens;

    logger.debug(`Context allocated: ${agentId} +${tokens} tokens (total: ${current + tokens})`);

    return {
      success: true,
      allocated: current + tokens,
      remaining: available - tokens
    };
  }

  /**
   * Release context memory
   */
  releaseContext(agentId, tokens) {
    const current = this.contextMemory.allocated.get(agentId) || 0;
    const toRelease = Math.min(tokens, current);

    this.contextMemory.allocated.set(agentId, current - toRelease);
    this.contextMemory.reserved -= toRelease;

    logger.debug(`Context released: ${agentId} -${toRelease} tokens`);

    return {
      released: toRelease,
      remaining: current - toRelease
    };
  }

  /**
   * Check API quota availability
   */
  checkApiQuota(agentId, requests = 1) {
    // Reset if expired
    if (new Date() > this.apiQuota.resetAt) {
      this._resetApiQuota();
    }

    const agentQuota = this.apiQuota.perAgent.get(agentId) || { used: 0, limit: 1000 };
    const available = this.apiQuota.total - this.apiQuota.used;

    if (agentQuota.used + requests > agentQuota.limit) {
      return {
        allowed: false,
        reason: 'Agent quota exceeded',
        limit: agentQuota.limit,
        used: agentQuota.used,
        resetAt: this.apiQuota.resetAt
      };
    }

    if (this.apiQuota.used + requests > this.apiQuota.total) {
      return {
        allowed: false,
        reason: 'System quota exceeded',
        resetAt: this.apiQuota.resetAt
      };
    }

    return {
      allowed: true,
      available,
      resetAt: this.apiQuota.resetAt
    };
  }

  /**
   * Consume API quota
   */
  consumeApiQuota(agentId, requests = 1) {
    const check = this.checkApiQuota(agentId, requests);
    
    if (!check.allowed) {
      return check;
    }

    // Update quotas
    this.apiQuota.used += requests;
    
    const agentQuota = this.apiQuota.perAgent.get(agentId) || { used: 0, limit: 1000 };
    agentQuota.used += requests;
    this.apiQuota.perAgent.set(agentId, agentQuota);

    logger.debug(`API quota consumed: ${agentId} +${requests} (total: ${this.apiQuota.used})`);

    return {
      success: true,
      remaining: this.apiQuota.total - this.apiQuota.used,
      agentRemaining: agentQuota.limit - agentQuota.used
    };
  }

  /**
   * Request file access
   */
  requestFileAccess(agentId, filePath, mode = 'read') {
    const currentAgent = this.fileAccess.openFiles.get(filePath);

    // Check if file already open
    if (currentAgent) {
      if (currentAgent === agentId) {
        // Same agent, allow
        return { granted: true, mode };
      }

      // Different agent
      if (mode === 'read') {
        // Read access can be shared
        return { granted: true, mode, shared: true };
      } else {
        // Write access requires exclusive lock
        return {
          granted: false,
          reason: 'File locked for writing',
          lockedBy: currentAgent
        };
      }
    }

    // Check max concurrent files
    if (this.fileAccess.openFiles.size >= this.fileAccess.maxConcurrent) {
      return {
        granted: false,
        reason: 'Maximum concurrent file limit reached',
        limit: this.fileAccess.maxConcurrent
      };
    }

    // Grant access
    this.fileAccess.openFiles.set(filePath, agentId);
    this.fileAccess.accessLog.push({
      agentId,
      filePath,
      mode,
      accessedAt: new Date()
    });

    logger.debug(`File access granted: ${agentId} → ${filePath} (${mode})`);

    return { granted: true, mode };
  }

  /**
   * Release file access
   */
  releaseFileAccess(agentId, filePath) {
    const currentAgent = this.fileAccess.openFiles.get(filePath);

    if (currentAgent === agentId) {
      this.fileAccess.openFiles.delete(filePath);
      logger.debug(`File access released: ${agentId} → ${filePath}`);
      return { success: true };
    }

    return {
      success: false,
      error: 'File not locked by this agent'
    };
  }

  /**
   * Get resource statistics
   */
  getStatistics() {
    const contextUsage = (this.contextMemory.reserved / this.contextMemory.total) * 100;
    const apiUsage = (this.apiQuota.used / this.apiQuota.total) * 100;

    return {
      context: {
        total: this.contextMemory.total,
        allocated: this.contextMemory.reserved,
        available: this.contextMemory.total - this.contextMemory.reserved,
        usage: `${contextUsage.toFixed(1)}%`,
        agents: this.contextMemory.allocated.size
      },
      api: {
        total: this.apiQuota.total,
        used: this.apiQuota.used,
        remaining: this.apiQuota.total - this.apiQuota.used,
        usage: `${apiUsage.toFixed(1)}%`,
        resetAt: this.apiQuota.resetAt,
        agents: this.apiQuota.perAgent.size
      },
      files: {
        open: this.fileAccess.openFiles.size,
        maxConcurrent: this.fileAccess.maxConcurrent,
        totalAccessed: this.fileAccess.accessLog.length
      }
    };
  }

  /**
   * Get agent resource usage
   */
  getAgentResources(agentId) {
    const context = this.contextMemory.allocated.get(agentId) || 0;
    const apiQuota = this.apiQuota.perAgent.get(agentId) || { used: 0, limit: 1000 };
    const files = Array.from(this.fileAccess.openFiles.entries())
      .filter(([_, agent]) => agent === agentId)
      .map(([path, _]) => path);

    return {
      context: {
        allocated: context,
        percentage: ((context / this.contextMemory.total) * 100).toFixed(1) + '%'
      },
      api: {
        used: apiQuota.used,
        limit: apiQuota.limit,
        remaining: apiQuota.limit - apiQuota.used
      },
      files: {
        open: files,
        count: files.length
      }
    };
  }

  /**
   * Reclaim context from low-priority agents
   */
  _reclaimContext(needed) {
    // Sort agents by context usage (descending)
    const agents = Array.from(this.contextMemory.allocated.entries())
      .sort((a, b) => b[1] - a[1]);

    let reclaimed = 0;

    for (const [agentId, allocated] of agents) {
      if (reclaimed >= needed) break;

      // Reclaim 25% from each agent
      const toReclaim = Math.floor(allocated * 0.25);
      this.releaseContext(agentId, toReclaim);
      reclaimed += toReclaim;

      logger.warn(`Reclaimed ${toReclaim} tokens from ${agentId}`);
    }

    return reclaimed;
  }

  /**
   * Reset API quota (hourly)
   */
  _resetApiQuota() {
    this.apiQuota.used = 0;
    this.apiQuota.perAgent.clear();
    this.apiQuota.resetAt = new Date(Date.now() + 3600000);

    logger.info('API quota reset');
  }

  /**
   * Set allocation strategy
   */
  setAllocationStrategy(strategy) {
    if (['fair', 'priority', 'need-based'].includes(strategy)) {
      this.allocationStrategy = strategy;
      logger.info(`Allocation strategy set to: ${strategy}`);
      return true;
    }
    return false;
  }

  /**
   * Clear all agent resources
   */
  clearAgentResources(agentId) {
    // Release context
    const context = this.contextMemory.allocated.get(agentId) || 0;
    this.releaseContext(agentId, context);

    // Release files
    for (const [filePath, agent] of this.fileAccess.openFiles.entries()) {
      if (agent === agentId) {
        this.releaseFileAccess(agentId, filePath);
      }
    }

    // Clear API quota tracking
    this.apiQuota.perAgent.delete(agentId);

    logger.info(`Cleared all resources for agent: ${agentId}`);
  }
}

// Singleton instance
const resourceManager = new ResourceManager();

module.exports = resourceManager