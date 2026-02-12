import * as vscode from 'vscode';
import * as path from 'path';
import { WorkspaceAnalyzer } from './workspaceAnalyzer';
import { AutonomyManager, AutonomyLevel } from './autonomyManager';
import { agentClient } from './agentClient';
import { ChangeTracker } from './changeTracker';
import { ProtocolHandler } from './protocolHandler';

export interface ExecutionPlan {
  goal: string;
  analysis: string;
  steps: ExecutionStep[];
  reasoning: string;
  metadata?: {
    complexity?: 'simple' | 'moderate' | 'complex';
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface ExecutionStep {
  id: number;
  type: 'edit' | 'create' | 'delete' | 'terminal' | 'refactor' | 'install';
  description: string;
  file?: string;
  command?: string;
  tool?: any;
  reasoning: string;
}

export interface ExecutionResult {
  success: boolean;
  stepsCompleted: number;
  stepsFailed: number;
  actions: ActionRecord[];
  summary: string;
  nextSteps: NextStep[];
}

export interface ActionRecord {
  step: number;
  type: string;
  description: string;
  status: 'completed' | 'failed' | 'skipped';
  details?: string;
}

export interface NextStep {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
}

/**
 * Planning and execution engine for autonomous agent
 */
export class AgentPlanner {
  private _analyzer: WorkspaceAnalyzer;
  private _autonomy: AutonomyManager;
  private _actionLog: ActionRecord[] = [];
  private _changeTracker: ChangeTracker;
  private _lastFoundFilePath: string | null = null; // Remember last file for follow-ups
  private _currentModel: string = 'llama-3.3-70b-versatile'; // Default, updated per request
  private _protocolHandler: ProtocolHandler;

  constructor(autonomy: AutonomyManager) {
    this._analyzer = new WorkspaceAnalyzer();
    this._autonomy = autonomy;
    this._changeTracker = new ChangeTracker();
    this._protocolHandler = new ProtocolHandler();
  }

  /**
   * Set the model to use for AI calls
   */
  public setModel(model: string): void {
    this._currentModel = model;
    console.log(`[AgentPlanner] Using model: ${model}`);
  }

  /**
   * Get the change tracker instance
   */
  public getChangeTracker(): ChangeTracker {
    return this._changeTracker;
  }

  /**
   * Get the protocol handler instance for conversation management
   */
  public getProtocolHandler(): ProtocolHandler {
    return this._protocolHandler;
  }

  /**
   * Clear conversation history
   */
  public clearHistory(): void {
    this._protocolHandler.clearHistory();
  }

  /**
   * Get conversation summary for context
   */
  public getConversationContext(): string {
    return this._protocolHandler.buildConversationContext();
  }

  /**
   * Check if backend is available
   */
  private async checkBackendHealth(): Promise<{ available: boolean; error?: string }> {
    try {
      const axios = (await import('axios')).default;
      const response = await axios.get('http://localhost:3000/health', { timeout: 5000 });
      return { available: true };
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        return { 
          available: false, 
          error: 'Backend server is not running. Try reloading VS Code or check if port 3000 is in use.' 
        };
      }
      return { 
        available: false, 
        error: `Backend health check failed: ${error.message}` 
      };
    }
  }

  /**
   * Analyze user request and create execution plan
   * @param userMessage - The user's request
   * @param conversationHistory - Recent conversation for context
   * @param fileContext - Optional file context (path and selection info)
   * @param complexity - Task complexity assessment (simple/moderate/complex)
   * @param riskLevel - Security risk level (low/medium/high/critical)
   */
  public async createPlan(
    userMessage: string, 
    conversationHistory?: string, 
    fileContext?: { filePath: string; hasSelection: boolean; selectionLength: number },
    complexity?: 'simple' | 'moderate' | 'complex',
    riskLevel?: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<ExecutionPlan | null> {
    try {
      // 0. Check backend health first
      const health = await this.checkBackendHealth();
      if (!health.available) {
        return {
          goal: 'Error',
          analysis: 'Backend Connection Failed',
          steps: [],
          reasoning: health.error || 'Could not connect to HybridMind backend server.',
          metadata: { complexity, riskLevel }
        };
      }

      // 1. If file context provided directly, use it (don't extract from message)
      let fileContexts = [];
      if (fileContext?.filePath) {
        try {
          const fileUri = vscode.Uri.file(fileContext.filePath);
          const context = await this._analyzer.getFileContext(fileUri);
          if (context) {
            fileContexts.push(context);
            this._lastFoundFilePath = fileContext.filePath;
          }
        } catch (e) {
          // Fallback to extraction
        }
      }
      
      // 2. If no direct file context, extract from message/history
      if (fileContexts.length === 0) {
        let fileRefs = this._analyzer.extractFileReferences(userMessage);
        
        // Also check conversation history for file references
        if (conversationHistory && fileRefs.length === 0) {
          const historyRefs = this._analyzer.extractFileReferences(conversationHistory);
          fileRefs = historyRefs;
        }
        
        // Find and read extracted files
        for (const fileRef of fileRefs) {
          const fileUri = await this._analyzer.findFile(fileRef);
          if (fileUri) {
            const context = await this._analyzer.getFileContext(fileUri);
            if (context) {
              fileContexts.push(context);
              this._lastFoundFilePath = fileUri.fsPath;
            }
          }
        }
      }

      // If no files found but we have a remembered path, use it
      if (fileContexts.length === 0 && this._lastFoundFilePath) {
        try {
          const uri = vscode.Uri.file(this._lastFoundFilePath);
          const context = await this._analyzer.getFileContext(uri);
          if (context) {
            fileContexts.push(context);
          }
        } catch (e) {
          // File no longer exists, clear the remembered path
          this._lastFoundFilePath = null;
        }
      }

      // 3. Get project context
      const projectContext = await this._analyzer.getProjectContext();

      // 4. Build context for AI
      let fullContext = `# User Request\n${userMessage}\n\n`;
      
      if (fileContexts.length > 0) {
        fullContext += `# Referenced Files\n`;
        for (const fc of fileContexts) {
          fullContext += `\n## ${fc.path} (${fc.language}, ${fc.lines} lines)\n`;
          fullContext += `\`\`\`${fc.language}\n${fc.content}\n\`\`\`\n`;
        }
      }

      if (projectContext.name) {
        fullContext += `\n# Project Context\n`;
        fullContext += `Name: ${projectContext.name}\n`;
        if (projectContext.description) {
          fullContext += `Description: ${projectContext.description}\n`;
        }
        if (projectContext.structure) {
          fullContext += `\nStructure: ${projectContext.structure.slice(0, 20).join(', ')}...\n`;
        }
      }

      // Add conversation history if available
      if (conversationHistory) {
        fullContext += `\n# Recent Conversation\n${conversationHistory}\n`;
      }

      // Get the first file reference for execution context (use absolute path)
      const targetFile = fileContexts.length > 0 ? fileContexts[0].absolutePath : null;
      
      // Get workspace root for new file creation
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

      // 5. Build context for protocol handler
      const additionalContext = `${fullContext}\n\n**Target File:** ${targetFile || 'Not specified'}${workspaceRoot ? `\n**Workspace Root:** ${workspaceRoot}` : ''}`;
      
      // 6. Add to conversation history
      this._protocolHandler.addToHistory('user', userMessage);

      // 7. Build structured request
      const request = await this._protocolHandler.buildRequest(
        `Analyze the request and provide a detailed response.

For REVIEW/ANALYSIS requests (only analyzing, no changes): Respond with JSON including analysis steps:
{
  "goal": "Review [filename] and provide feedback",
  "analysis": "detailed analysis with strengths, weaknesses, and suggestions",
  "reasoning": "why these improvements matter",
  "steps": [
    {"id": 1, "type": "refactor", "description": "Analyze code structure and patterns", "file": "${targetFile || 'FULL_PATH'}", "reasoning": "identify improvement areas"},
    {"id": 2, "type": "refactor", "description": "Check for best practices and anti-patterns", "file": "${targetFile || 'FULL_PATH'}", "reasoning": "ensure code quality"},
    {"id": 3, "type": "refactor", "description": "Provide specific recommendations", "file": "${targetFile || 'FULL_PATH'}", "reasoning": "actionable feedback"}
  ]
}

For EXECUTION requests (making actual changes to files): Include specific steps WITH FILE PATHS:
{
  "goal": "what we're accomplishing",
  "analysis": "analysis of what needs to be done",
  "reasoning": "why this approach makes sense",
  "steps": [
    {"id": 1, "type": "create", "description": "create new file", "file": "${workspaceRoot}\\\\filename.ext", "reasoning": "why"},
    {"id": 2, "type": "edit", "description": "specific change to make", "file": "${targetFile || workspaceRoot + '\\\\filename.ext'}", "reasoning": "why"}
  ]
}

CRITICAL RULES:
- For NEW file creation, use type "create" and provide the FULL PATH starting with workspace root: ${workspaceRoot}\\filename.ext
- For EDITING existing files, use the exact file path: ${targetFile}
- EVERY step must include the "file" property with a complete absolute path
- If creating a file in the workspace root, use: ${workspaceRoot}\\filename.ext
- If editing the same file multiple times, repeat the exact file path in each step

User Request: ${userMessage}

Respond with ONLY the JSON object (no markdown code blocks).`,
        this._currentModel,
        additionalContext
      );

      // 8. Call AI with structured prompt
      const axios = (await import('axios')).default;
      console.log(`[AgentPlanner] Planning with model: ${this._currentModel}`);
      const apiResponse = await axios.post('http://localhost:3000/run/single', {
        model: this._currentModel,
        prompt: request.systemPrompt + '\n\n' + request.userMessage
      }, {
        timeout: 60000, // 60 second timeout
        validateStatus: (status) => status < 500 // Don't throw on 4xx errors
      });

      const rawResponse = apiResponse.data?.data || apiResponse.data;
      
      // 9. Parse response using protocol handler
      const aiResponse = this._protocolHandler.parseResponse(rawResponse);
      
      // 10. Add to conversation history
      this._protocolHandler.addToHistory('assistant', aiResponse.content);
      
      // Parse the plan from response, passing file contexts to fix paths
      const plan = this._parsePlanFromResponse(aiResponse.content, userMessage, fileContexts);
      return plan;

    } catch (error: any) {
      console.error('[AgentPlanner] Error creating plan:', error);
      
      // Return a plan with error details instead of null
      return {
        goal: 'Error',
        analysis: `Failed to analyze request: ${error.message || 'Unknown error'}`,
        steps: [],
        reasoning: error.code === 'ECONNREFUSED' 
          ? 'Cannot connect to HybridMind backend. The embedded server may not be running. Try reloading the VS Code window.'
          : error.response?.status === 500
          ? `Backend error: ${error.response?.data?.error || 'Internal server error'}. Check if your API keys are configured correctly.`
          : `Error details: ${error.stack || error.toString()}`
      };
    }
  }

  /**
   * Execute a plan with autonomy checks
   */
  public async executePlan(
    plan: ExecutionPlan, 
    onProgress?: (step: ExecutionStep, status: string) => void,
    constraints?: {
      readOnly?: boolean;
      noDelete?: boolean;
      noCreate?: boolean;
      noTerminal?: boolean;
    }
  ): Promise<ExecutionResult> {
    this._actionLog = [];
    let completed = 0;
    let failed = 0;

    for (const step of plan.steps) {
      // Check constraints before permission check
      const violatesConstraints = this._checkConstraintViolation(step, constraints);
      if (violatesConstraints) {
        this._actionLog.push({
          step: step.id,
          type: step.type,
          description: step.description,
          status: 'skipped',
          details: `Skipped due to constraint: ${violatesConstraints}`
        });
        onProgress?.(step, 'skipped');
        continue;
      }

      // Skip permission check for read-only analysis steps
      const isReadOnly = step.type === 'refactor';
      
      if (!isReadOnly) {
        onProgress?.(step, 'checking-permission');

        // Check autonomy permission for action steps
        const allowed = await this._autonomy.requestPermission({
          type: step.type as any,
          description: step.description,
          files: step.file ? [step.file] : undefined,
          command: step.command
        });

        if (!allowed) {
          this._actionLog.push({
            step: step.id,
            type: step.type,
            description: step.description,
            status: 'skipped',
            details: 'User denied permission'
          });
          continue;
        }
      }

      onProgress?.(step, 'executing');

      // Execute the step (unless read-only mode)
      let result;
      if (constraints?.readOnly) {
        // In read-only mode, simulate execution
        result = {
          success: true,
          details: 'Reviewed (read-only mode)'
        };
      } else {
        result = await this._executeStep(step);
      }
      
      if (result.success) {
        completed++;
        this._actionLog.push({
          step: step.id,
          type: step.type,
          description: step.description,
          status: 'completed',
          details: result.details
        });
      } else {
        failed++;
        this._actionLog.push({
          step: step.id,
          type: step.type,
          description: step.description,
          status: 'failed',
          details: result.error
        });
      }

      onProgress?.(step, result.success ? 'completed' : 'failed');
    }

    // Generate summary and next steps
    const summary = this._generateSummary(plan, completed, failed);
    const nextSteps = await this._generateNextSteps(plan, this._actionLog);

    return {
      success: failed === 0,
      stepsCompleted: completed,
      stepsFailed: failed,
      actions: this._actionLog,
      summary,
      nextSteps
    };
  }

  /**
   * Check if step violates execution constraints
   */
  private _checkConstraintViolation(
    step: ExecutionStep, 
    constraints?: { readOnly?: boolean; noDelete?: boolean; noCreate?: boolean; noTerminal?: boolean }
  ): string | null {
    if (!constraints) return null;
    
    if (constraints.readOnly && (step.type === 'edit' || step.type === 'create' || step.type === 'delete')) {
      return 'read-only mode';
    }
    
    if (constraints.noDelete && step.type === 'delete') {
      return 'no deletions allowed';
    }
    
    if (constraints.noCreate && step.type === 'create') {
      return 'no file creation allowed';
    }
    
    if (constraints.noTerminal && step.type === 'terminal') {
      return 'no terminal commands allowed';
    }
    
    return null;
  }

  /**
   * Execute a single step
   */
  private async _executeStep(step: ExecutionStep): Promise<{ success: boolean; details?: string; error?: string }> {
    try {
      switch (step.type) {
        case 'terminal':
          if (step.command) {
            // Execute terminal command
            const terminal = vscode.window.createTerminal('HybridMind Agent');
            terminal.show();
            terminal.sendText(step.command);
            return { success: true, details: `Executed: ${step.command}` };
          }
          return { success: false, error: 'No command provided' };

        case 'edit':
        case 'create':
        case 'delete':
        case 'refactor':
          // Generate and execute the actual code changes
          if (step.tool) {
            // Execute pre-generated tool call from planning
            const result = await this._executeToolCall(step.tool);
            return result;
          }
          
          // No tool call provided - generate it now based on step description
          // Use step.file or fall back to remembered file path
          let targetFile = step.file || this._lastFoundFilePath;
          
          if (targetFile) {
            try {
              // Resolve to absolute path if relative
              let fileUri: vscode.Uri;
              if (path.isAbsolute(targetFile)) {
                fileUri = vscode.Uri.file(targetFile);
              } else {
                // Relative path - resolve against workspace
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (workspaceFolder) {
                  fileUri = vscode.Uri.joinPath(workspaceFolder.uri, targetFile);
                  targetFile = fileUri.fsPath; // Update to absolute path
                } else {
                  return { success: false, error: 'No workspace folder open' };
                }
              }
              
              // For create operations, don't try to read existing file
              let content = '';
              if (step.type === 'create') {
                // For file creation, start with empty content
                content = '';
              } else {
                // For edit/refactor, read existing file content for context
                try {
                  const fileContent = await vscode.workspace.fs.readFile(fileUri);
                  content = Buffer.from(fileContent).toString('utf8');
                } catch (error: any) {
                  return { success: false, error: `Failed to read file ${targetFile}: ${error.message}` };
                }
              }
              
              // Ensure step has the correct file path for code generation
              step.file = targetFile;
              
              // Call AI to generate specific code changes
              const toolCall = await this._generateCodeChange(step, content);
              if (toolCall) {
                const result = await this._executeToolCall(toolCall);
                return result;
              } else {
                return { success: false, error: `AI failed to generate valid code changes for: ${step.description}` };
              }
            } catch (error: any) {
              return { success: false, error: `Failed to generate code changes: ${error.message}` };
            }
          }
          
          return { success: false, error: `Cannot execute ${step.type} without file path (step.file: ${step.file}, lastFound: ${this._lastFoundFilePath})` };

        case 'install':
          if (step.command) {
            const terminal = vscode.window.createTerminal('Package Install');
            terminal.show();
            terminal.sendText(step.command);
            return { success: true, details: `Installing: ${step.command}` };
          }
          return { success: false, error: 'No install command provided' };

        default:
          return { success: false, error: `Unsupported step type: ${step.type}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate code changes using AI for a specific step
   */
  private async _generateCodeChange(step: ExecutionStep, fileContent: string): Promise<any | null> {
    try {
      const axios = (await import('axios')).default;
      
      // Choose tool based on step type
      const isCreateOperation = step.type === 'create';
      
      // Use a simple, direct prompt WITHOUT the full system prompt to ensure JSON response
      let directPrompt: string;
      
      if (isCreateOperation) {
        // For create operations, use create_file tool
        directPrompt = `You are a code editor AI. Generate ONLY a JSON tool call to create a new file.

File to create: ${step.file}
Task: ${step.description}

CRITICAL: Respond with ONLY a valid JSON object. No explanations, no markdown, no code blocks.

Required JSON format:
{
  "tool": "create_file",
  "path": "${step.file}",
  "content": "file content here"
}

Example:
{
  "tool": "create_file",
  "path": "${step.file}",
  "content": "<html>\\n<head><title>Test</title></head>\\n<body>Hello World</body>\\n</html>"
}

RESPOND WITH ONLY THE JSON OBJECT:`;
      } else {
        // For edit/refactor operations, use apply_edit tool
        directPrompt = `You are a code editor AI. Generate ONLY a JSON tool call, nothing else.

File: ${step.file}
Task: ${step.description}

Current File Content (line numbers for reference):
${this._addLineNumbers(fileContent)}

CRITICAL: Respond with ONLY a valid JSON object. No explanations, no markdown, no code blocks.

Required JSON format:
{
  "tool": "apply_edit",
  "file": "${step.file}",
  "start": {"line": LINE_NUMBER, "character": 0},
  "end": {"line": LINE_NUMBER, "character": 0},
  "text": "replacement code"
}

Example:
{
  "tool": "apply_edit",
  "file": "${step.file}",
  "start": {"line": 45, "character": 0},
  "end": {"line": 47, "character": 0},
  "text": "const newCode = 'improved';"
}

RESPOND WITH ONLY THE JSON OBJECT:`;
      }

      console.log(`[AgentPlanner] Generating code with model: ${this._currentModel} for task: ${step.description}`);
      const response = await axios.post('http://localhost:3000/run/single', {
        model: this._currentModel,
        prompt: directPrompt
      });

      const rawResponse = response.data?.data || response.data;
      const output = rawResponse.output || rawResponse.content || JSON.stringify(rawResponse);
      
      console.log(`[AgentPlanner] AI Response length: ${output.length} chars`);
      console.log(`[AgentPlanner] AI Response preview: ${output.substring(0, 300)}...`);
      
      // Parse JSON from response - try to extract just the JSON part
      let jsonMatch = output.match(/\{[\s\S]*\}/);
      
      // If wrapped in code blocks, extract
      if (!jsonMatch) {
        const codeBlockMatch = output.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (codeBlockMatch) {
          jsonMatch = [codeBlockMatch[1]];
        }
      }
      
      if (jsonMatch) {
        try {
          const toolCall = JSON.parse(jsonMatch[0]);
          console.log(`[AgentPlanner] ✅ Successfully parsed tool call: ${toolCall.tool} at line ${toolCall.start?.line || toolCall.position?.line || '?'}`);
          return toolCall;
        } catch (parseError) {
          console.error(`[AgentPlanner] ❌ Failed to parse JSON: ${parseError}`);
          console.error(`[AgentPlanner] Attempted to parse: ${jsonMatch[0].substring(0, 500)}`);
          return null;
        }
      }
      
      console.warn(`[AgentPlanner] ❌ No JSON found in AI response. Full response: ${output}`);
      return null;
      console.warn(`[AgentPlanner] ❌ No JSON found in AI response. Full response: ${output}`);
      return null;
    } catch (error) {
      console.error('Error generating code change:', error);
      return null;
    }
  }

  /**
   * Execute a tool call from the agent
   */
  private async _executeToolCall(toolCall: any): Promise<{ success: boolean; details?: string; error?: string }> {
    try {
      // Import and use the toolExecutor with change tracking
      const { ToolExecutor } = await import('./toolExecutor');
      const executor = new ToolExecutor(this._changeTracker);
      
      await executor.execute(toolCall);
      return { success: true, details: `Executed ${toolCall.tool}` };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Parse execution plan from AI response
   */
  private _parsePlanFromResponse(response: any, fallbackGoal: string, fileContexts: any[] = []): ExecutionPlan {
    try {
      // Try to parse JSON from response
      let planData;
      
      if (response.toolCall && typeof response.toolCall === 'object') {
        planData = response.toolCall;
      } else if (typeof response === 'string') {
        // Extract JSON from markdown or plain text
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          planData = JSON.parse(jsonMatch[0]);
        }
      }

      if (planData) {
        // Get the actual file path from file contexts
        const actualFilePath = fileContexts.length > 0 ? fileContexts[0].path : null;
        
        // Validate, filter, and fix steps
        const validSteps = Array.isArray(planData.steps) 
          ? planData.steps
              .filter((s: any) => s && s.id && s.type && s.description)
              .map((s: any) => {
                // Always use the actual file path if we have one
                // This fixes AI returning placeholder paths like "C:\middleware\rateLimiter.js"
                if (actualFilePath) {
                  s.file = actualFilePath;
                }
                return s;
              })
          : [];

        return {
          goal: planData.goal || fallbackGoal,
          analysis: planData.analysis || '',
          reasoning: planData.reasoning || '',
          steps: validSteps
        };
      }

      // Fallback: create simple plan
      return {
        goal: fallbackGoal,
        analysis: 'Unable to parse detailed plan from AI response',
        reasoning: 'Proceeding with manual analysis',
        steps: []
      };
    } catch (error) {
      console.error('Error parsing plan:', error);
      return {
        goal: fallbackGoal,
        analysis: 'Error parsing plan',
        reasoning: 'Will proceed manually',
        steps: []
      };
    }
  }

  /**
   * Generate execution summary
   */
  private _generateSummary(plan: ExecutionPlan, completed: number, failed: number): string {
    let summary = `## Execution Summary\n\n`;
    summary += `**Goal:** ${plan.goal}\n\n`;
    summary += `**Results:** ${completed} completed, ${failed} failed\n\n`;
    summary += `### Actions Taken:\n`;
    
    for (const action of this._actionLog) {
      const icon = action.status === 'completed' ? '✅' : action.status === 'failed' ? '❌' : '⏭️';
      summary += `${icon} **${action.description}**\n`;
      if (action.details) {
        summary += `   ${action.details}\n`;
      }
    }

    return summary;
  }

  /**
   * Generate intelligent next step suggestions
   */
  private async _generateNextSteps(plan: ExecutionPlan, actions: ActionRecord[]): Promise<NextStep[]> {
    const nextSteps: NextStep[] = [];

    // Analyze what was done and suggest logical next actions
    const hasEdits = actions.some(a => a.type === 'edit' || a.type === 'refactor');
    const hasTests = actions.some(a => a.description.toLowerCase().includes('test'));
    const hasErrors = actions.some(a => a.status === 'failed');

    if (hasErrors) {
      nextSteps.push({
        id: 'retry-failed',
        title: 'Retry Failed Actions',
        description: 'Attempt to fix and retry the failed steps',
        priority: 'high',
        reasoning: 'Some actions failed - we should investigate and retry'
      });
    }

    if (hasEdits && !hasTests) {
      nextSteps.push({
        id: 'add-tests',
        title: 'Generate Tests',
        description: 'Create unit tests for the modified code',
        priority: 'high',
        reasoning: 'Code was modified but no tests were created'
      });
    }

    if (hasEdits) {
      nextSteps.push({
        id: 'verify-changes',
        title: 'Verify Changes',
        description: 'Run tests and check for errors',
        priority: 'medium',
        reasoning: 'Should verify the changes work correctly'
      });
    }

    // Check if there are related files that might need updates
    if (plan.steps.some(s => s.file)) {
      nextSteps.push({
        id: 'check-dependencies',
        title: 'Review Related Files',
        description: 'Check if related files need updates',
        priority: 'medium',
        reasoning: 'Changes might affect dependent files'
      });
    }

    // Only suggest documentation if significant changes were made
    if (actions.length >= 3) {
      nextSteps.push({
        id: 'update-docs',
        title: 'Update Documentation',
        description: 'Document the changes made',
        priority: 'low',
        reasoning: 'Significant changes should be documented'
      });
    }

    // If no logical next steps, return empty array
    if (nextSteps.length === 0 && actions.every(a => a.status === 'completed')) {
      // Task is complete, no further action needed
      return [];
    }

    return nextSteps.slice(0, 4); // Limit to top 4 suggestions
  }

  /**
   * Add line numbers to file content for AI reference
   */
  private _addLineNumbers(content: string): string {
    const lines = content.split('\n');
    return lines.map((line, index) => `${String(index + 1).padStart(4, ' ')} | ${line}`).join('\n');
  }
}
