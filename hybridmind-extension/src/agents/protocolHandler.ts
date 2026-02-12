/**
 * Protocol handler for structured AI request/response
 * Formats requests with system prompt and workspace context
 * Parses structured responses from AI
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { SystemPromptBuilder, EnvironmentInfo, WorkspaceInfo } from './systemPrompt';

export interface ToolCall {
  name: string;
  parameters: Record<string, any>;
  reasoning?: string;
}

export interface AIRequest {
  systemPrompt: string;
  userMessage: string;
  conversationHistory?: ConversationMessage[];
  model: string;
  temperature?: number;
}

export interface AIResponse {
  content: string;
  toolCalls?: ToolCall[];
  reasoning?: string;
  metadata?: {
    model: string;
    tokensUsed?: number;
    executionTime?: number;
  };
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

/**
 * Handles protocol for AI interactions with structured prompts
 */
export class ProtocolHandler {
  private _conversationHistory: ConversationMessage[] = [];
  private _workspaceStructureCache: string | null = null;
  private _cacheTimeout: NodeJS.Timeout | null = null;

  /**
   * Get current environment information
   */
  private getEnvironmentInfo(): EnvironmentInfo {
    return {
      os: process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get workspace information with structure
   */
  private async getWorkspaceInfo(): Promise<WorkspaceInfo> {
    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    const folders = workspaceFolders.map(f => f.uri.fsPath);
    
    // Get active file
    const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;

    // Get or build workspace structure
    const structure = await this.getWorkspaceStructure();

    return {
      folders,
      structure,
      activeFile
    };
  }

  /**
   * Get workspace structure (cached for performance)
   */
  private async getWorkspaceStructure(): Promise<string> {
    // Return cached if available
    if (this._workspaceStructureCache) {
      return this._workspaceStructureCache;
    }

    // Build structure
    const structure = await this.buildWorkspaceStructure();
    
    // Cache for 5 minutes
    this._workspaceStructureCache = structure;
    if (this._cacheTimeout) {
      clearTimeout(this._cacheTimeout);
    }
    this._cacheTimeout = setTimeout(() => {
      this._workspaceStructureCache = null;
    }, 5 * 60 * 1000);

    return structure;
  }

  /**
   * Build workspace structure tree
   */
  private async buildWorkspaceStructure(maxDepth: number = 3): Promise<string> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return 'No workspace folders';
    }

    const lines: string[] = [];
    
    for (const folder of workspaceFolders) {
      const folderName = path.basename(folder.uri.fsPath);
      lines.push(`${folderName}/`);
      
      try {
        await this.buildStructureRecursive(folder.uri, lines, 1, maxDepth);
      } catch (error) {
        lines.push('  (Error reading directory)');
      }
    }

    return lines.join('\n');
  }

  /**
   * Recursively build structure tree
   */
  private async buildStructureRecursive(
    uri: vscode.Uri,
    lines: string[],
    depth: number,
    maxDepth: number
  ): Promise<void> {
    if (depth > maxDepth) {
      return;
    }

    const indent = '\t'.repeat(depth);
    const entries = await vscode.workspace.fs.readDirectory(uri);

    // Sort: directories first, then files
    const sorted = entries.sort((a, b) => {
      if (a[1] === vscode.FileType.Directory && b[1] !== vscode.FileType.Directory) {
        return -1;
      }
      if (a[1] !== vscode.FileType.Directory && b[1] === vscode.FileType.Directory) {
        return 1;
      }
      return a[0].localeCompare(b[0]);
    });

    // Filter out common ignored patterns
    const filtered = sorted.filter(([name]) => {
      return !name.startsWith('.') && 
             name !== 'node_modules' && 
             name !== 'dist' && 
             name !== 'build' &&
             name !== '__pycache__' &&
             name !== 'venv' &&
             name !== '.venv';
    });

    // Limit items to prevent huge structures
    const limited = filtered.slice(0, 50);

    for (const [name, type] of limited) {
      if (type === vscode.FileType.Directory) {
        lines.push(`${indent}${name}/`);
        const childUri = vscode.Uri.joinPath(uri, name);
        await this.buildStructureRecursive(childUri, lines, depth + 1, maxDepth);
      } else {
        lines.push(`${indent}${name}`);
      }
    }

    if (filtered.length > limited.length) {
      lines.push(`${indent}... (${filtered.length - limited.length} more items)`);
    }
  }

  /**
   * Build a complete AI request with system prompt and context
   */
  public async buildRequest(
    userMessage: string,
    model: string,
    additionalContext?: string,
    temperature: number = 0.7
  ): Promise<AIRequest> {
    const environmentInfo = this.getEnvironmentInfo();
    const workspaceInfo = await this.getWorkspaceInfo();

    const systemPrompt = SystemPromptBuilder.buildSystemPrompt(
      environmentInfo,
      workspaceInfo,
      additionalContext
    );

    return {
      systemPrompt,
      userMessage,
      conversationHistory: this._conversationHistory.slice(-10), // Last 10 messages
      model,
      temperature
    };
  }

  /**
   * Build a quick request without full context (for simple queries)
   */
  public buildQuickRequest(userMessage: string, model: string): AIRequest {
    return {
      systemPrompt: SystemPromptBuilder.buildQuickPrompt(userMessage),
      userMessage,
      model
    };
  }

  /**
   * Parse AI response and extract structured data
   */
  public parseResponse(rawResponse: any): AIResponse {
    // Handle different response formats
    let content = '';
    let toolCalls: ToolCall[] | undefined;
    let reasoning: string | undefined;

    if (typeof rawResponse === 'string') {
      content = rawResponse;
    } else if (rawResponse.output) {
      content = rawResponse.output;
    } else if (rawResponse.content) {
      content = rawResponse.content;
    }

    // Extract tool calls if present (various formats)
    if (rawResponse.toolCalls) {
      toolCalls = rawResponse.toolCalls;
    } else if (rawResponse.tool_calls) {
      toolCalls = rawResponse.tool_calls;
    } else if (rawResponse.actions) {
      // Convert actions to tool calls
      toolCalls = rawResponse.actions.map((action: any) => ({
        name: action.type || action.name,
        parameters: action.parameters || action.params || {},
        reasoning: action.reasoning
      }));
    }

    // Extract reasoning
    if (rawResponse.reasoning) {
      reasoning = rawResponse.reasoning;
    } else if (rawResponse.analysis) {
      reasoning = rawResponse.analysis;
    }

    return {
      content,
      toolCalls,
      reasoning,
      metadata: {
        model: rawResponse.model || 'unknown',
        tokensUsed: rawResponse.tokensUsed || rawResponse.usage?.total_tokens,
        executionTime: rawResponse.executionTime
      }
    };
  }

  /**
   * Add message to conversation history
   */
  public addToHistory(role: 'user' | 'assistant', content: string): void {
    this._conversationHistory.push({
      role,
      content,
      timestamp: new Date()
    });

    // Keep only last 50 messages
    if (this._conversationHistory.length > 50) {
      this._conversationHistory = this._conversationHistory.slice(-50);
    }
  }

  /**
   * Get conversation history
   */
  public getHistory(): ConversationMessage[] {
    return [...this._conversationHistory];
  }

  /**
   * Clear conversation history
   */
  public clearHistory(): void {
    this._conversationHistory = [];
  }

  /**
   * Build conversation context string from history
   */
  public buildConversationContext(): string {
    if (this._conversationHistory.length === 0) {
      return '';
    }

    const context = this._conversationHistory
      .slice(-10) // Last 10 messages
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n');

    return `**Recent Conversation:**\n${context}`;
  }

  /**
   * Invalidate workspace structure cache (call when files change)
   */
  public invalidateCache(): void {
    this._workspaceStructureCache = null;
    if (this._cacheTimeout) {
      clearTimeout(this._cacheTimeout);
      this._cacheTimeout = null;
    }
  }

  /**
   * Build optimized request using backend context management
   * Automatically optimizes large contexts to reduce token usage
   */
  public async buildOptimizedRequest(
    userMessage: string,
    model: string,
    options: {
      fullContext?: string;
      taskType?: 'analysis' | 'refactor' | 'generate' | 'debug' | 'general';
      maxTokens?: number;
      temperature?: number;
      useContextOptimization?: boolean;
    } = {}
  ): Promise<AIRequest> {
    const {
      fullContext = '',
      taskType = 'general',
      maxTokens = 8000,
      temperature = 0.7,
      useContextOptimization = true
    } = options;

    // For small contexts or if optimization disabled, use standard request
    if (!useContextOptimization || fullContext.length < 5000) {
      return this.buildRequest(userMessage, model, fullContext, temperature);
    }

    // Use backend context management to optimize context
    try {
      const response = await fetch('http://localhost:3000/api/context/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawContext: fullContext,
          task: userMessage,
          taskType,
          maxTokens
        })
      });

      if (!response.ok) {
        throw new Error(`Context optimization failed: ${response.statusText}`);
      }

      const optimized = await response.json() as { success?: boolean; data?: { context: string; metadata: any } };
      
      if (optimized.success && optimized.data) {
        const { context, metadata } = optimized.data;
        
        // Log optimization results
        console.log(`Context optimized: ${metadata.compressionRatio.toFixed(2)}x reduction (${metadata.originalTokens} → ${metadata.optimizedTokens} tokens)`);

        // Build request with optimized context
        return this.buildRequest(userMessage, model, context, temperature);
      }
    } catch (error) {
      console.warn('Context optimization failed, using full context:', error);
    }

    // Fallback to standard request
    return this.buildRequest(userMessage, model, fullContext, temperature);
  }

  /**
   * Estimate token count for context (rough approximation)
   */
  public estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if context should be optimized
   */
  public shouldOptimizeContext(contextSize: number, threshold: number = 5000): boolean {
    return contextSize > threshold;
  }
}
