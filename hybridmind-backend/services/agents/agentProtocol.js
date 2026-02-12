/**
 * HybridMind Multi-Agent System - Inter-Agent Communication Protocol
 * 
 * Manages message passing between agents, resource conflict resolution,
 * and decision consensus mechanisms.
 * 
 * Features:
 * - Message routing between agents
 * - Resource lock management
 * - Conflict resolution strategies
 * - Decision voting/consensus
 * - Communication logging for debugging
 */

const EventEmitter = require('events');
const logger = require('../../utils/logger');

/**
 * Message Types
 */
const MESSAGE_TYPES = {
  TASK_REQUEST: 'task_request',       // Request agent to handle task
  TASK_RESPONSE: 'task_response',     // Agent completed task
  RESOURCE_REQUEST: 'resource_request', // Request access to resource
  RESOURCE_GRANT: 'resource_grant',   // Resource access granted
  RESOURCE_DENY: 'resource_deny',     // Resource access denied
  HANDOFF: 'handoff',                 // Pass work to another agent
  QUERY: 'query',                     // Ask another agent for information
  DECISION_REQUEST: 'decision_request', // Request consensus on decision
  DECISION_VOTE: 'decision_vote',     // Vote on decision
  ERROR: 'error',                     // Error occurred
  STATUS_UPDATE: 'status_update'      // Agent status change
};

/**
 * Resource Types
 */
const RESOURCE_TYPES = {
  FILE: 'file',
  DIRECTORY: 'directory',
  TERMINAL: 'terminal',
  CONTEXT: 'context',
  API_QUOTA: 'api_quota',
  MEMORY: 'memory'
};

/**
 * Agent Communication Protocol
 */
class AgentCommunicationProtocol extends EventEmitter {
  constructor() {
    super();
    
    // Message queue for each agent
    this.messageQueues = new Map(); // agentId -> Message[]
    
    // Resource locks
    this.resourceLocks = new Map(); // resourceId -> { agentId, lockedAt, expiresAt }
    
    // Pending decisions
    this.pendingDecisions = new Map(); // decisionId -> { votes, required, status }
    
    // Communication log
    this.communicationLog = [];
    this.maxLogSize = 1000;
    
    // Agent registry
    this.activeAgents = new Map(); // agentId -> { role, status, lastSeen }
    
    // Resource wait queues
    this.resourceWaitQueues = new Map(); // resourceId -> agentId[]
  }

  /**
   * Register an agent
   */
  registerAgent(agentId, role) {
    this.activeAgents.set(agentId, {
      role,
      status: 'idle',
      lastSeen: new Date()
    });

    // Initialize message queue
    if (!this.messageQueues.has(agentId)) {
      this.messageQueues.set(agentId, []);
    }

    logger.info(`Agent registered: ${agentId} (${role})`);
    this.emit('agentRegistered', { agentId, role });

    return true;
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId) {
    // Release all locks held by agent
    for (const [resourceId, lock] of this.resourceLocks.entries()) {
      if (lock.agentId === agentId) {
        this.releaseResource(resourceId, agentId);
      }
    }

    this.activeAgents.delete(agentId);
    logger.info(`Agent unregistered: ${agentId}`);
    this.emit('agentUnregistered', { agentId });
  }

  /**
   * Send message between agents
   */
  sendMessage({
    from,
    to,
    type,
    payload,
    priority = 'normal',
    requiresResponse = false
  }) {
    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      from,
      to,
      type,
      payload,
      priority,
      requiresResponse,
      sentAt: new Date(),
      status: 'sent'
    };

    // Add to recipient's queue
    const queue = this.messageQueues.get(to) || [];
    
    // Priority messages go to front
    if (priority === 'high') {
      queue.unshift(message);
    } else {
      queue.push(message);
    }
    
    this.messageQueues.set(to, queue);

    // Log communication
    this._logCommunication(message);

    // Emit event
    this.emit('messageSent', message);

    logger.debug(`Message sent: ${from} → ${to} (${type})`);

    return message.id;
  }

  /**
   * Receive messages for an agent
   */
  receiveMessages(agentId, filter = {}) {
    const queue = this.messageQueues.get(agentId) || [];
    
    let messages = [...queue];
    
    // Apply filters
    if (filter.type) {
      messages = messages.filter(m => m.type === filter.type);
    }
    if (filter.from) {
      messages = messages.filter(m => m.from === filter.from);
    }
    if (filter.unreadOnly) {
      messages = messages.filter(m => m.status !== 'read');
    }

    return messages;
  }

  /**
   * Mark message as read
   */
  markMessageRead(agentId, messageId) {
    const queue = this.messageQueues.get(agentId) || [];
    const message = queue.find(m => m.id === messageId);
    
    if (message) {
      message.status = 'read';
      message.readAt = new Date();
      this.emit('messageRead', message);
    }

    return message;
  }

  /**
   * Clear messages for agent
   */
  clearMessages(agentId, filter = {}) {
    const queue = this.messageQueues.get(agentId) || [];
    
    let remaining = queue;
    
    // Filter what to clear
    if (filter.type) {
      remaining = remaining.filter(m => m.type !== filter.type);
    } else if (filter.read) {
      remaining = remaining.filter(m => m.status !== 'read');
    } else {
      remaining = []; // Clear all
    }

    this.messageQueues.set(agentId, remaining);
    
    return queue.length - remaining.length; // Return count cleared
  }

  /**
   * Request access to a resource
   */
  async requestResource(agentId, resourceType, resourceId, timeout = 30000) {
    const lockKey = `${resourceType}:${resourceId}`;
    const existingLock = this.resourceLocks.get(lockKey);

    logger.debug(`Resource request: ${agentId} → ${lockKey}`);

    // Check if resource is already locked
    if (existingLock) {
      // Check if lock expired
      if (new Date() > new Date(existingLock.expiresAt)) {
        // Lock expired, release it
        this.releaseResource(lockKey, existingLock.agentId);
      } else {
        // Resource locked by another agent
        logger.warn(`Resource ${lockKey} locked by ${existingLock.agentId}`);
        
        // Add to wait queue
        const waitQueue = this.resourceWaitQueues.get(lockKey) || [];
        if (!waitQueue.includes(agentId)) {
          waitQueue.push(agentId);
          this.resourceWaitQueues.set(lockKey, waitQueue);
        }

        // Send denial message
        this.sendMessage({
          from: 'system',
          to: agentId,
          type: MESSAGE_TYPES.RESOURCE_DENY,
          payload: {
            resourceType,
            resourceId,
            reason: 'Resource locked',
            lockedBy: existingLock.agentId,
            retryAfter: existingLock.expiresAt
          }
        });

        return {
          granted: false,
          reason: 'Resource locked',
          lockedBy: existingLock.agentId,
          retryAfter: existingLock.expiresAt
        };
      }
    }

    // Grant lock
    const lock = {
      agentId,
      resourceType,
      resourceId,
      lockedAt: new Date(),
      expiresAt: new Date(Date.now() + timeout)
    };

    this.resourceLocks.set(lockKey, lock);

    // Send grant message
    this.sendMessage({
      from: 'system',
      to: agentId,
      type: MESSAGE_TYPES.RESOURCE_GRANT,
      payload: {
        resourceType,
        resourceId,
        expiresAt: lock.expiresAt
      }
    });

    logger.info(`Resource granted: ${lockKey} → ${agentId}`);
    this.emit('resourceGranted', { agentId, resourceType, resourceId });

    return {
      granted: true,
      expiresAt: lock.expiresAt
    };
  }

  /**
   * Release a resource lock
   */
  releaseResource(resourceKey, agentId) {
    const lock = this.resourceLocks.get(resourceKey);

    // Validate ownership
    if (lock && lock.agentId === agentId) {
      this.resourceLocks.delete(resourceKey);
      
      logger.info(`Resource released: ${resourceKey} by ${agentId}`);
      this.emit('resourceReleased', { agentId, resource: resourceKey });

      // Check wait queue
      const waitQueue = this.resourceWaitQueues.get(resourceKey) || [];
      if (waitQueue.length > 0) {
        // Grant to next agent in queue
        const nextAgent = waitQueue.shift();
        this.resourceWaitQueues.set(resourceKey, waitQueue);

        // Notify next agent
        this.sendMessage({
          from: 'system',
          to: nextAgent,
          type: MESSAGE_TYPES.RESOURCE_GRANT,
          payload: {
            resource: resourceKey,
            message: 'Resource now available'
          },
          priority: 'high'
        });
      }

      return true;
    }

    return false;
  }

  /**
   * Hand off task to another agent
   */
  handoffTask({
    from,
    to,
    task,
    context = {},
    priority = 'normal'
  }) {
    logger.info(`Task handoff: ${from} → ${to}`);

    const handoffMessage = this.sendMessage({
      from,
      to,
      type: MESSAGE_TYPES.HANDOFF,
      payload: {
        task,
        context,
        handoffReason: context.reason || 'Task delegation'
      },
      priority,
      requiresResponse: true
    });

    this.emit('taskHandoff', { from, to, task, messageId: handoffMessage });

    return handoffMessage;
  }

  /**
   * Request decision consensus
   */
  async requestDecision({
    requesterId,
    decision,
    voters,
    requiredVotes = Math.ceil(voters.length / 2) + 1,
    timeout = 60000
  }) {
    const decisionId = `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const decisionRequest = {
      id: decisionId,
      requesterId,
      decision,
      voters,
      requiredVotes,
      votes: new Map(),
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + timeout)
    };

    this.pendingDecisions.set(decisionId, decisionRequest);

    // Send decision request to all voters
    voters.forEach(voterId => {
      this.sendMessage({
        from: requesterId,
        to: voterId,
        type: MESSAGE_TYPES.DECISION_REQUEST,
        payload: {
          decisionId,
          decision,
          requiredVotes,
          deadline: decisionRequest.expiresAt
        },
        priority: 'high',
        requiresResponse: true
      });
    });

    logger.info(`Decision requested: ${decisionId} (requires ${requiredVotes}/${voters.length} votes)`);

    // Auto-timeout
    setTimeout(() => {
      const current = this.pendingDecisions.get(decisionId);
      if (current && current.status === 'pending') {
        current.status = 'timeout';
        this.emit('decisionTimeout', current);
        logger.warn(`Decision timed out: ${decisionId}`);
      }
    }, timeout);

    return decisionId;
  }

  /**
   * Submit vote for decision
   */
  submitVote(decisionId, voterId, vote, reason = '') {
    const decision = this.pendingDecisions.get(decisionId);

    if (!decision || decision.status !== 'pending') {
      return { success: false, error: 'Decision not found or already resolved' };
    }

    if (!decision.voters.includes(voterId)) {
      return { success: false, error: 'Not authorized to vote' };
    }

    // Record vote
    decision.votes.set(voterId, { vote, reason, votedAt: new Date() });

    logger.debug(`Vote submitted: ${voterId} → ${decisionId} (${vote})`);

    // Check if consensus reached
    const approveCount = Array.from(decision.votes.values()).filter(v => v.vote === 'approve').length;
    const denyCount = Array.from(decision.votes.values()).filter(v => v.vote === 'deny').length;

    if (approveCount >= decision.requiredVotes) {
      decision.status = 'approved';
      this.emit('decisionApproved', decision);
      logger.info(`Decision approved: ${decisionId}`);
    } else if (denyCount > decision.voters.length - decision.requiredVotes) {
      decision.status = 'denied';
      this.emit('decisionDenied', decision);
      logger.info(`Decision denied: ${decisionId}`);
    }

    return {
      success: true,
      decision: {
        id: decisionId,
        status: decision.status,
        approveCount,
        denyCount,
        requiredVotes: decision.requiredVotes
      }
    };
  }

  /**
   * Get decision status
   */
  getDecision(decisionId) {
    return this.pendingDecisions.get(decisionId);
  }

  /**
   * Log communication for debugging
   */
  _logCommunication(message) {
    this.communicationLog.push({
      ...message,
      loggedAt: new Date()
    });

    // Keep log size manageable
    if (this.communicationLog.length > this.maxLogSize) {
      this.communicationLog.shift();
    }
  }

  /**
   * Get communication history
   */
  getCommunicationLog(filter = {}) {
    let logs = [...this.communicationLog];

    if (filter.agentId) {
      logs = logs.filter(l => l.from === filter.agentId || l.to === filter.agentId);
    }
    if (filter.type) {
      logs = logs.filter(l => l.type === filter.type);
    }
    if (filter.since) {
      const since = new Date(filter.since);
      logs = logs.filter(l => new Date(l.sentAt) > since);
    }

    return logs;
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      activeAgents: this.activeAgents.size,
      totalMessages: this.communicationLog.length,
      pendingMessages: Array.from(this.messageQueues.values()).reduce((sum, queue) => sum + queue.length, 0),
      activeLocks: this.resourceLocks.size,
      pendingDecisions: Array.from(this.pendingDecisions.values()).filter(d => d.status === 'pending').length,
      messagesByType: this._groupByType(this.communicationLog),
      agentsByRole: this._groupAgentsByRole()
    };
  }

  _groupByType(logs) {
    const grouped = {};
    logs.forEach(log => {
      grouped[log.type] = (grouped[log.type] || 0) + 1;
    });
    return grouped;
  }

  _groupAgentsByRole() {
    const grouped = {};
    for (const [_, agent] of this.activeAgents) {
      grouped[agent.role] = (grouped[agent.role] || 0) + 1;
    }
    return grouped;
  }

  /**
   * Clear old communication logs
   */
  clearOldLogs(hoursToKeep = 24) {
    const cutoff = new Date(Date.now() - hoursToKeep * 3600 * 1000);
    const originalLength = this.communicationLog.length;

    this.communicationLog = this.communicationLog.filter(
      log => new Date(log.loggedAt) > cutoff
    );

    const cleared = originalLength - this.communicationLog.length;
    logger.info(`Cleared ${cleared} old communication logs`);
    
    return cleared;
  }
}

// Singleton instance
const agentProtocol = new AgentCommunicationProtocol();

// Cleanup old logs every hour
setInterval(() => {
  agentProtocol.clearOldLogs(24);
}, 3600 * 1000);

module.exports = {
  MESSAGE_TYPES,
  RESOURCE_TYPES,
  agentProtocol
};
