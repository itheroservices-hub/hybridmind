/**
 * WebSocket Real-Time Collaboration
 * 
 * Enables live multi-user sessions with:
 * - Shared workspaces
 * - Real-time agent updates
 * - Collaborative workflows
 * - Live metrics streaming
 */

const { Server } = require('socket.io');
const logger = require('../../utils/logger');

/**
 * Event types for real-time communication
 */
const WS_EVENTS = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  JOIN_WORKSPACE: 'join_workspace',
  LEAVE_WORKSPACE: 'leave_workspace',
  
  // Workflow events
  WORKFLOW_START: 'workflow_start',
  WORKFLOW_UPDATE: 'workflow_update',
  WORKFLOW_COMPLETE: 'workflow_complete',
  WORKFLOW_ERROR: 'workflow_error',
  
  // Agent events
  AGENT_ASSIGNED: 'agent_assigned',
  AGENT_THINKING: 'agent_thinking',
  AGENT_RESPONSE: 'agent_response',
  
  // Metrics events
  METRICS_UPDATE: 'metrics_update',
  EVALUATION_COMPLETE: 'evaluation_complete',
  
  // Collaboration events
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',
  USER_TYPING: 'user_typing',
  MESSAGE: 'message',
  
  // System events
  ERROR: 'error',
  NOTIFICATION: 'notification'
};

class CollaborationServer {
  constructor() {
    this.io = null;
    this.workspaces = new Map(); // workspaceId -> { users, state }
    this.userSessions = new Map(); // socketId -> { userId, workspaceId, tier }
    
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      totalWorkspaces: 0,
      activeWorkspaces: 0,
      messagesExchanged: 0
    };
  }

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS || '*',
        methods: ['GET', 'POST']
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this._setupEventHandlers();
    
    logger.info('WebSocket collaboration server initialized');
  }

  /**
   * Setup event handlers
   */
  _setupEventHandlers() {
    this.io.on(WS_EVENTS.CONNECT, (socket) => {
      this.metrics.totalConnections++;
      this.metrics.activeConnections++;
      
      logger.info(`Client connected: ${socket.id}`);

      // Join workspace
      socket.on(WS_EVENTS.JOIN_WORKSPACE, (data) => {
        this._handleJoinWorkspace(socket, data);
      });

      // Leave workspace
      socket.on(WS_EVENTS.LEAVE_WORKSPACE, () => {
        this._handleLeaveWorkspace(socket);
      });

      // User typing indicator
      socket.on(WS_EVENTS.USER_TYPING, (data) => {
        this._handleUserTyping(socket, data);
      });

      // Messages
      socket.on(WS_EVENTS.MESSAGE, (data) => {
        this._handleMessage(socket, data);
      });

      // Disconnect
      socket.on(WS_EVENTS.DISCONNECT, () => {
        this._handleDisconnect(socket);
      });
    });
  }

  /**
   * Handle user joining workspace
   */
  _handleJoinWorkspace(socket, data) {
    const { workspaceId, userId, userName, tier = 'free' } = data;

    if (!workspaceId || !userId) {
      socket.emit(WS_EVENTS.ERROR, { message: 'Invalid workspace or user ID' });
      return;
    }

    // Create workspace if doesn't exist
    if (!this.workspaces.has(workspaceId)) {
      this.workspaces.set(workspaceId, {
        id: workspaceId,
        users: new Map(),
        state: {
          activeWorkflows: [],
          sharedContext: {},
          metrics: {}
        },
        createdAt: new Date()
      });
      this.metrics.totalWorkspaces++;
      this.metrics.activeWorkspaces++;
    }

    const workspace = this.workspaces.get(workspaceId);

    // Add user to workspace
    workspace.users.set(socket.id, {
      socketId: socket.id,
      userId,
      userName: userName || `User ${userId.slice(0, 8)}`,
      tier,
      joinedAt: new Date()
    });

    // Track user session
    this.userSessions.set(socket.id, {
      userId,
      workspaceId,
      tier
    });

    // Join socket.io room
    socket.join(workspaceId);

    // Notify user
    socket.emit(WS_EVENTS.JOIN_WORKSPACE, {
      workspaceId,
      users: Array.from(workspace.users.values()),
      state: workspace.state
    });

    // Notify others
    socket.to(workspaceId).emit(WS_EVENTS.USER_JOINED, {
      userId,
      userName: workspace.users.get(socket.id).userName,
      timestamp: new Date()
    });

    logger.info(`User ${userId} joined workspace ${workspaceId}`);
  }

  /**
   * Handle user leaving workspace
   */
  _handleLeaveWorkspace(socket) {
    const session = this.userSessions.get(socket.id);
    
    if (!session) return;

    const { workspaceId, userId } = session;
    const workspace = this.workspaces.get(workspaceId);

    if (workspace) {
      const user = workspace.users.get(socket.id);
      workspace.users.delete(socket.id);

      // Notify others
      socket.to(workspaceId).emit(WS_EVENTS.USER_LEFT, {
        userId,
        userName: user?.userName,
        timestamp: new Date()
      });

      // Clean up empty workspace
      if (workspace.users.size === 0) {
        this.workspaces.delete(workspaceId);
        this.metrics.activeWorkspaces--;
      }
    }

    socket.leave(workspaceId);
    this.userSessions.delete(socket.id);

    logger.info(`User ${userId} left workspace ${workspaceId}`);
  }

  /**
   * Handle user typing
   */
  _handleUserTyping(socket, data) {
    const session = this.userSessions.get(socket.id);
    
    if (!session) return;

    const { workspaceId, userId } = session;
    const { isTyping } = data;

    socket.to(workspaceId).emit(WS_EVENTS.USER_TYPING, {
      userId,
      isTyping,
      timestamp: new Date()
    });
  }

  /**
   * Handle message
   */
  _handleMessage(socket, data) {
    const session = this.userSessions.get(socket.id);
    
    if (!session) return;

    const { workspaceId, userId } = session;
    const workspace = this.workspaces.get(workspaceId);
    const user = workspace?.users.get(socket.id);

    const message = {
      userId,
      userName: user?.userName,
      content: data.content,
      timestamp: new Date()
    };

    // Broadcast to workspace
    this.io.to(workspaceId).emit(WS_EVENTS.MESSAGE, message);
    
    this.metrics.messagesExchanged++;
  }

  /**
   * Handle disconnect
   */
  _handleDisconnect(socket) {
    this._handleLeaveWorkspace(socket);
    
    this.metrics.activeConnections--;
    logger.info(`Client disconnected: ${socket.id}`);
  }

  /**
   * Broadcast workflow start
   */
  broadcastWorkflowStart(workspaceId, workflowData) {
    if (!workspaceId) return;

    const workspace = this.workspaces.get(workspaceId);
    
    if (workspace) {
      workspace.state.activeWorkflows.push(workflowData);
    }

    this.io.to(workspaceId).emit(WS_EVENTS.WORKFLOW_START, {
      ...workflowData,
      timestamp: new Date()
    });

    logger.debug(`Broadcast workflow start to workspace ${workspaceId}`);
  }

  /**
   * Broadcast workflow update
   */
  broadcastWorkflowUpdate(workspaceId, update) {
    if (!workspaceId) return;

    this.io.to(workspaceId).emit(WS_EVENTS.WORKFLOW_UPDATE, {
      ...update,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast workflow complete
   */
  broadcastWorkflowComplete(workspaceId, result) {
    if (!workspaceId) return;

    const workspace = this.workspaces.get(workspaceId);
    
    if (workspace) {
      workspace.state.activeWorkflows = workspace.state.activeWorkflows.filter(
        w => w.id !== result.workflowId
      );
    }

    this.io.to(workspaceId).emit(WS_EVENTS.WORKFLOW_COMPLETE, {
      ...result,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast agent assigned
   */
  broadcastAgentAssigned(workspaceId, agentData) {
    if (!workspaceId) return;

    this.io.to(workspaceId).emit(WS_EVENTS.AGENT_ASSIGNED, {
      ...agentData,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast agent thinking
   */
  broadcastAgentThinking(workspaceId, agentData) {
    if (!workspaceId) return;

    this.io.to(workspaceId).emit(WS_EVENTS.AGENT_THINKING, {
      ...agentData,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast agent response
   */
  broadcastAgentResponse(workspaceId, agentData) {
    if (!workspaceId) return;

    this.io.to(workspaceId).emit(WS_EVENTS.AGENT_RESPONSE, {
      ...agentData,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast metrics update
   */
  broadcastMetricsUpdate(workspaceId, metrics) {
    if (!workspaceId) return;

    const workspace = this.workspaces.get(workspaceId);
    
    if (workspace) {
      workspace.state.metrics = metrics;
    }

    this.io.to(workspaceId).emit(WS_EVENTS.METRICS_UPDATE, {
      metrics,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast evaluation complete
   */
  broadcastEvaluationComplete(workspaceId, evaluation) {
    if (!workspaceId) return;

    this.io.to(workspaceId).emit(WS_EVENTS.EVALUATION_COMPLETE, {
      evaluation,
      timestamp: new Date()
    });
  }

  /**
   * Send notification to workspace
   */
  sendNotification(workspaceId, notification) {
    if (!workspaceId) return;

    this.io.to(workspaceId).emit(WS_EVENTS.NOTIFICATION, {
      ...notification,
      timestamp: new Date()
    });
  }

  /**
   * Send notification to specific user
   */
  sendUserNotification(socketId, notification) {
    if (!socketId) return;

    this.io.to(socketId).emit(WS_EVENTS.NOTIFICATION, {
      ...notification,
      timestamp: new Date()
    });
  }

  /**
   * Get workspace state
   */
  getWorkspaceState(workspaceId) {
    const workspace = this.workspaces.get(workspaceId);
    
    if (!workspace) return null;

    return {
      id: workspace.id,
      users: Array.from(workspace.users.values()),
      state: workspace.state,
      createdAt: workspace.createdAt
    };
  }

  /**
   * Update workspace shared context
   */
  updateWorkspaceContext(workspaceId, context) {
    const workspace = this.workspaces.get(workspaceId);
    
    if (workspace) {
      workspace.state.sharedContext = {
        ...workspace.state.sharedContext,
        ...context
      };

      // Broadcast context update
      this.io.to(workspaceId).emit('context_update', {
        context: workspace.state.sharedContext,
        timestamp: new Date()
      });
    }
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      workspaces: Array.from(this.workspaces.values()).map(w => ({
        id: w.id,
        userCount: w.users.size,
        activeWorkflows: w.state.activeWorkflows.length,
        createdAt: w.createdAt
      }))
    };
  }

  /**
   * Get active users in workspace
   */
  getWorkspaceUsers(workspaceId) {
    const workspace = this.workspaces.get(workspaceId);
    
    if (!workspace) return [];

    return Array.from(workspace.users.values());
  }

  /**
   * Cleanup inactive workspaces
   */
  cleanupInactiveWorkspaces(maxAge = 3600000) { // 1 hour default
    const now = Date.now();
    let cleaned = 0;

    for (const [workspaceId, workspace] of this.workspaces.entries()) {
      const age = now - workspace.createdAt.getTime();
      
      if (workspace.users.size === 0 && age > maxAge) {
        this.workspaces.delete(workspaceId);
        this.metrics.activeWorkspaces--;
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} inactive workspaces`);
    }

    return cleaned;
  }
}

// Singleton instance
module.exports = new CollaborationServer();
