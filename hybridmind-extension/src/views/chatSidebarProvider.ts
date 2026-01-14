/**
 * HybridMind v1.1 - Sidebar Chat Provider
 * GitHub Copilot-style persistent chat sidebar
 */

import * as vscode from 'vscode';
import { LicenseManager } from '../auth/licenseManager';
import { WorkspaceAnalyzer } from '../agents/workspaceAnalyzer';
import { AutonomyManager, AutonomyLevel, ToolPermissions } from '../agents/autonomyManager';
import { AgentPlanner, ExecutionResult, NextStep } from '../agents/agentPlanner';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  timestamp: Date;
  tokens?: number;
  cost?: number;
}

export class ChatSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'hybridmind.chatView';
  private _view?: vscode.WebviewView;
  private _messages: ChatMessage[] = [];
  private _serverPort: number;
  private _selectedModels: string[] = [];
  private _workflowMode: 'single' | 'parallel' | 'chain' | 'agentic' = 'single';
  private _licenseManager: LicenseManager;
  private _autonomyLevel: number = 3; // Default to Full Auto
  private _readOnly: boolean = false; // Prevent file changes
  private _permissions: { [key: string]: boolean } = {
    read: true,
    edit: true,
    terminal: true,
    create: true,
    delete: false,
    'multi-step': true,
    restructure: false,
    network: false
  };
  
  // Autonomous agent system
  private _autonomyManager: AutonomyManager;
  private _agentPlanner: AgentPlanner;
  private _currentExecution: ExecutionResult | null = null;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    serverPort: number
  ) {
    this._serverPort = serverPort;
    this._licenseManager = LicenseManager.getInstance();
    
    // Initialize autonomous agent system
    this._autonomyManager = new AutonomyManager(AutonomyLevel.L1, {
      allowFileEdits: true,
      allowFileCreation: true,
      allowFileDeletion: false,
      allowTerminalCommands: true,
      allowPackageInstalls: false
    });
    this._agentPlanner = new AgentPlanner(this._autonomyManager);
  }

  /**
   * Get provider for a given model
   */
  private _getProviderForModel(model: string): string {
    if (model.includes('gpt')) return 'openai';
    if (model.includes('llama') || model.includes('mixtral')) return 'groq';
    if (model.includes('deepseek')) return 'deepseek';
    if (model.includes('claude')) return 'anthropic';
    if (model.includes('gemini')) return 'google';
    if (model.includes('qwen')) return 'qwen';
    return 'groq'; // Default to groq (free)
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'sendMessage':
          await this._handleSendMessage(data.message, data.models, data.workflow, data.includeContext);
          break;
        case 'clearHistory':
          this._messages = [];
          this._updateWebview();
          break;
        case 'changeModels':
          this._selectedModels = data.models;
          break;
        case 'changeWorkflow':
          this._workflowMode = data.workflow;
          break;
        case 'changeAutonomy':
          this._autonomyLevel = data.level;
          this._permissions = data.permissions;
          break;
        case 'toggleReadOnly':
          this._readOnly = data.readOnly;
          break;
        case 'insertCode':
          this._insertCodeAtCursor(data.code);
          break;
        case 'executeSuggestion':
          // Handle autonomous execution of suggested task
          await this._handleSendMessage(data.task, data.models, 'agentic', true);
          break;
        case 'openUpgrade':
          // Open upgrade page in browser
          vscode.env.openExternal(vscode.Uri.parse('https://hybridmind.ai/pricing'));
          break;
        case 'executeNextStep':
          // Execute a suggested next step
          await this._handleNextStep(data.stepId, data.models);
          break;
        case 'viewDiff':
          // View diff for a specific file change
          await this._viewFileDiff(data.filePath);
          break;
        case 'acceptChanges':
          // Accept all file changes
          this._acceptAllChanges();
          break;
        case 'rejectChanges':
          // Reject all file changes
          await this._rejectAllChanges();
          break;
      }
    });
  }

  private async _handleSendMessage(userMessage: string, models?: string[], workflow?: string, includeContext?: boolean, isDirectExecution?: boolean) {
    const selectedModels = models || this._selectedModels;
    const workflowMode = workflow || this._workflowMode;
    
    // Enforce tier limits
    const maxModels = this._licenseManager.isPro() ? 4 : 2;
    if (selectedModels.length > maxModels) {
      vscode.window.showWarningMessage(`${this._licenseManager.isPro() ? 'Pro' : 'Free'} tier limited to ${maxModels} models. Upgrade for more!`);
      return;
    }

    if (selectedModels.length === 0) {
      vscode.window.showWarningMessage('Please select at least one model');
      return;
    }

    try {
      // Get active editor context if requested BEFORE adding message to chat
      const editor = vscode.window.activeTextEditor;
      let contextCode = '';
      
      if (includeContext && editor && editor.selection) {
        contextCode = editor.document.getText(editor.selection);
        
        // If no selection, get the whole file
        if (!contextCode || contextCode.trim() === '') {
          contextCode = editor.document.getText();
        }
        
        // Prepend context to message for better AI understanding
        userMessage = `${userMessage}\n\nSelected code:\n\`\`\`\n${contextCode}\n\`\`\``;
      }

      // Detect if user wants actual edits but is in non-agentic mode
      let wantsEdits = /\b(edit|change|modify|update|fix|refactor|optimize|improve|implement)\b/i.test(userMessage);
      if (wantsEdits && workflowMode !== 'agentic') {
        const switchToAgentic = await vscode.window.showInformationMessage(
          '💡 To actually edit files, switch to Agentic mode in the workflow dropdown above. Otherwise I can only provide suggestions.',
          'Switch to Agentic Mode',
          'Just Get Suggestions'
        );
        
        if (switchToAgentic === 'Switch to Agentic Mode') {
          // Inform user to manually switch - we'll handle it next time
          vscode.window.showInformationMessage('Please select "Agentic" from the workflow dropdown at the top, then ask again! 🚀');
          return;
        }
      }

      // Add user message (with context if included)
      const userMsg: ChatMessage = {
        role: 'user',
        content: userMessage,
        timestamp: new Date()
      };
      this._messages.push(userMsg);
      this._updateWebview();

      // Check if this should be autonomous execution (agentic mode)
      if (workflowMode === 'agentic') {
        // Use new autonomous agent system
        await this._handleAutonomousExecution(userMessage, selectedModels);
        return;
      }

      // Choose the appropriate endpoint based on workflow
      let endpoint = '';
      let requestBody: any = {
        tier: this._licenseManager.isPro() ? 'pro' : 'free'
      };

      if (workflowMode === 'parallel') {
        endpoint = '/run/parallel';
        requestBody = {
          models: selectedModels,
          prompt: userMessage,
          code: contextCode,
          options: { readOnly: this._readOnly }
        };
      } else if (workflowMode === 'chain') {
        endpoint = '/run/chain';
        requestBody = {
          models: selectedModels,
          prompt: userMessage,
          code: contextCode,
          options: { readOnly: this._readOnly }
        };
      } else {
        // Single model mode
        endpoint = '/run/single';
        requestBody = {
          model: selectedModels[0],
          prompt: userMessage
        };
      }

      // Call backend API - always use port 3000 (OpenRouter backend)
      const backendPort = 3000;
      console.log(`[HybridMind] Calling ${endpoint} on port ${backendPort} (mode: ${workflowMode})`);
      const response = await fetch(`http://localhost:${backendPort}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      const data: any = await response.json();

      // Check if response has error
      if (!data.success && data.error) {
        throw new Error(data.error.message || 'Unknown API error');
      }

      // Extract data from backend response wrapper
      const responseData = data.data || data;
      console.log('[HybridMind] Response:', JSON.stringify(responseData).slice(0, 500));

      // Handle multi-model responses
      if (workflowMode === 'parallel' && responseData.results) {
        // Add multiple assistant messages for parallel execution
        for (const result of responseData.results) {
          const assistantMsg: ChatMessage = {
            role: 'assistant',
            content: result.output || result.content || result.response || 'No response',
            model: result.model,
            timestamp: new Date(),
            tokens: result.usage?.total_tokens,
            cost: result.cost
          };
          this._messages.push(assistantMsg);
        }
      } else if (workflowMode === 'chain' && responseData.steps) {
        // Add messages for each step in the chain
        for (const step of responseData.steps) {
          const assistantMsg: ChatMessage = {
            role: 'assistant',
            content: `**${step.model}**: ${step.output || step.content || step.response || 'No response'}`,
            model: step.model,
            timestamp: new Date(),
            tokens: step.usage?.total_tokens,
            cost: step.cost
          };
          this._messages.push(assistantMsg);
        }
      } else if (workflowMode === 'agentic') {
        // Backend agentic workflow (Planner → Executor → Reviewer)
        const result = responseData;
        
        // Show execution steps if available
        if (result.execution?.results) {
          for (const step of result.execution.results) {
            const stepMsg: ChatMessage = {
              role: 'assistant',
              content: `**📝 ${step.stepName}** (${step.action})\n${step.success ? '✅' : '❌'} ${step.confirmation?.message || 'Executed'}\n\nChanges: ${step.changes?.linesAdded || 0} added, ${step.changes?.linesRemoved || 0} removed`,
              model: step.model,
              timestamp: new Date()
            };
            this._messages.push(stepMsg);
          }
        }
        
        // Show review if available
        if (result.review) {
          const reviewMsg: ChatMessage = {
            role: 'assistant',
            content: `**🔍 Review**\n\n${result.review.summary || 'Review complete'}\n\n**Quality Score:** ${result.review.qualityScore || 'N/A'}\n**Issues:** ${result.review.issues?.length || 0}`,
            model: 'Reviewer',
            timestamp: new Date()
          };
          this._messages.push(reviewMsg);
        }
        
        // Final result
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: `**🎯 Agentic Workflow Complete**\n\n${result.finalOutput || 'Task completed successfully'}`,
          model: 'Workflow Engine',
          timestamp: new Date(),
          tokens: result.totalUsage?.totalTokens,
          cost: 0
        };
        this._messages.push(assistantMsg);
      } else {
        // Single model response - backend returns {success: true, data: {output: "...", model: "..."}}
        const responseData = data.data || data;
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: responseData.output || responseData.content || responseData.response || responseData.message || 'No response',
          model: responseData.model || selectedModels[0],
          timestamp: new Date(),
          tokens: data.meta?.usage?.totalTokens || responseData.usage?.total_tokens,
          cost: responseData.cost
        };
        this._messages.push(assistantMsg);
      }
      
      this._updateWebview();

    } catch (error: any) {
      vscode.window.showErrorMessage(`HybridMind Error: ${error.message}`);
      
      // Add error message to chat
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `❌ Error: ${error.message}`,
        timestamp: new Date()
      };
      this._messages.push(errorMsg);
      this._updateWebview();
    }
  }

  /**
   * Handle autonomous agent execution with file discovery and planning
   */
  private async _handleAutonomousExecution(userMessage: string, models: string[]) {
    try {
      // Show planning message
      const planningMsg: ChatMessage = {
        role: 'system',
        content: '🧠 Analyzing request and creating execution plan...',
        timestamp: new Date()
      };
      this._messages.push(planningMsg);
      this._updateWebview();

      // Update autonomy manager based on current settings
      const autonomyLevel = this._autonomyLevel === 3 ? AutonomyLevel.L3 :
                           this._autonomyLevel === 2 ? AutonomyLevel.L2 :
                           AutonomyLevel.L1;
      
      this._autonomyManager.setLevel(autonomyLevel);
      this._autonomyManager.updatePermissions({
        allowFileEdits: this._permissions.edit,
        allowFileCreation: this._permissions.create,
        allowFileDeletion: this._permissions.delete,
        allowTerminalCommands: this._permissions.terminal,
        allowPackageInstalls: false // Always ask for package installs
      });

      // Build conversation history (last 3 messages for context)
      const recentMessages = this._messages
        .slice(-6) // Last 6 messages (3 exchanges)
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');

      // Set the selected model for the agent planner
      const selectedModel = models[0] || 'llama-3.3-70b-versatile';
      this._agentPlanner.setModel(selectedModel);

      // Create execution plan
      const plan = await this._agentPlanner.createPlan(userMessage, recentMessages);
      
      if (!plan) {
        const errorMsg: ChatMessage = {
          role: 'assistant',
          content: `I encountered an error analyzing your request. Please try again.`,
          timestamp: new Date()
        };
        this._messages.push(errorMsg);
        this._updateWebview();
        return;
      }

      // If no steps, this is a review/analysis-only task
      if (plan.steps.length === 0) {
        const reviewMsg: ChatMessage = {
          role: 'assistant',
          content: `## 📋 ${plan.goal}\n\n${plan.analysis}\n\n${plan.reasoning ? `**Reasoning:** ${plan.reasoning}` : ''}`,
          model: 'Agent Planner',
          timestamp: new Date()
        };
        this._messages.push(reviewMsg);
        this._updateWebview();
        return;
      }

      // Show the plan with steps
      const planMsg: ChatMessage = {
        role: 'assistant',
        content: `## 📋 Execution Plan\n\n**Goal:** ${plan.goal}\n\n**Analysis:** ${plan.analysis}\n\n**Steps:**\n${plan.steps.map(s => `${s.id}. ${s.description} (${s.type})`).join('\n')}\n\n**Reasoning:** ${plan.reasoning}\n\nAutonomy Level: **${this._autonomyManager.getLevelDescription()}**`,
        model: 'Agent Planner',
        timestamp: new Date()
      };
      this._messages.push(planMsg);
      this._updateWebview();

      // Execute the plan
      const executionMsg: ChatMessage = {
        role: 'system',
        content: '⚙️ Executing plan...',
        timestamp: new Date()
      };
      this._messages.push(executionMsg);
      this._updateWebview();

      const result = await this._agentPlanner.executePlan(plan, (step, status) => {
        // Update progress in chat
        const progressMsg: ChatMessage = {
          role: 'system',
          content: `${status === 'completed' ? '✅' : status === 'failed' ? '❌' : '🔄'} Step ${step.id}: ${step.description}`,
          timestamp: new Date()
        };
        this._messages.push(progressMsg);
        this._updateWebview();
      });

      // Store result for next steps
      this._currentExecution = result;

      // Show summary
      const summaryMsg: ChatMessage = {
        role: 'assistant',
        content: result.summary,
        model: 'Agent Summary',
        timestamp: new Date()
      };
      this._messages.push(summaryMsg);

      // Show file changes summary if any changes were made
      const changeTracker = this._agentPlanner.getChangeTracker();
      const changes = changeTracker.getChanges();
      
      if (changes.length > 0) {
        const changeSummary = changeTracker.getSummary();
        const changesMsg: ChatMessage = {
          role: 'system',
          content: JSON.stringify({
            type: 'fileChanges',
            summary: changeSummary,
            changes: changes.map(c => ({
              file: c.filePath,
              type: c.changeType
            }))
          }),
          timestamp: new Date()
        };
        this._messages.push(changesMsg);
      }

      // Show next steps as interactive buttons
      if (result.nextSteps.length > 0) {
        const nextStepsMsg: ChatMessage = {
          role: 'system',
          content: JSON.stringify({
            type: 'nextSteps',
            steps: result.nextSteps
          }),
          timestamp: new Date()
        };
        this._messages.push(nextStepsMsg);
      } else {
        const completeMsg: ChatMessage = {
          role: 'assistant',
          content: '✨ Task complete! No further actions recommended.',
          timestamp: new Date()
        };
        this._messages.push(completeMsg);
      }

      this._updateWebview();

    } catch (error: any) {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `❌ Autonomous execution error: ${error.message}`,
        timestamp: new Date()
      };
      this._messages.push(errorMsg);
      this._updateWebview();
    }
  }

  /**
   * Handle execution of a suggested next step
   */
  private async _handleNextStep(stepId: string, models?: string[]) {
    if (!this._currentExecution || !this._currentExecution.nextSteps) {
      return;
    }

    const step = this._currentExecution.nextSteps.find(s => s.id === stepId);
    if (!step) {
      return;
    }

    // Execute the next step as a new autonomous task
    const nextStepMessage = `${step.title}: ${step.description}`;
    await this._handleAutonomousExecution(nextStepMessage, models || this._selectedModels);
  }

  /**
   * View diff for a specific file change
   */
  private async _viewFileDiff(filePath: string) {
    const changeTracker = this._agentPlanner.getChangeTracker();
    await changeTracker.showDiff(filePath);
  }

  /**
   * Accept all file changes
   */
  private _acceptAllChanges() {
    const changeTracker = this._agentPlanner.getChangeTracker();
    changeTracker.acceptAll();
    
    const confirmMsg: ChatMessage = {
      role: 'system',
      content: '✅ All file changes have been accepted.',
      timestamp: new Date()
    };
    this._messages.push(confirmMsg);
    this._updateWebview();
  }

  /**
   * Reject all file changes (revert)
   */
  private async _rejectAllChanges() {
    const changeTracker = this._agentPlanner.getChangeTracker();
    await changeTracker.rejectAll();
    
    const confirmMsg: ChatMessage = {
      role: 'system',
      content: '↩️ All file changes have been reverted.',
      timestamp: new Date()
    };
    this._messages.push(confirmMsg);
    this._updateWebview();
  }

  private _updateWebview() {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'updateMessages',
        messages: this._messages
      });
    }
  }

  private _insertCodeAtCursor(code: string) {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      editor.edit((editBuilder) => {
        editBuilder.insert(editor.selection.active, code);
      });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const isPro = this._licenseManager.isPro();
    const maxModels = isPro ? 4 : 2;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HybridMind Chat</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-sidebar-background);
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    .header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background-color: var(--vscode-sideBar-background);
    }
    
    .model-selector {
      width: 100%;
      padding: 6px 8px;
      background-color: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      border-radius: 2px;
      font-size: 12px;
    }
    
    .model-checkboxes {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 8px;
    }
    
    .model-checkbox {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      padding: 4px;
      background-color: var(--vscode-editor-background);
      border-radius: 3px;
    }
    
    .model-checkbox input[type="checkbox"] {
      cursor: pointer;
    }
    
    .model-checkbox.disabled {
      opacity: 0.5;
      pointer-events: none;
    }
    
    .workflow-selector {
      width: 100%;
      padding: 6px 8px;
      margin-top: 8px;
      background-color: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      border-radius: 2px;
      font-size: 12px;
    }
    
    .tier-badge {
      display: inline-block;
      padding: 2px 6px;
      font-size: 10px;
      border-radius: 3px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      margin-left: 8px;
    }
    
    .badge-free {
      background-color: #10b981;
      color: white;
      padding: 1px 4px;
      border-radius: 2px;
      font-size: 9px;
      font-weight: bold;
    }
    
    .badge-premium {
      background-color: #3b82f6;
      color: white;
      padding: 1px 4px;
      border-radius: 2px;
      font-size: 9px;
      font-weight: bold;
    }
    
    .badge-ultra {
      background: linear-gradient(135deg, #8b5cf6, #ec4899);
      color: white;
      padding: 1px 4px;
      border-radius: 2px;
      font-size: 9px;
      font-weight: bold;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.8; }
    }

    .upgrade-banner {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 6px;
      padding: 12px;
      margin: 12px 8px;
      text-align: center;
      color: white;
      cursor: pointer;
      transition: all 0.3s ease;
      border: none;
      display: flex;
      flex-direction: column;
      gap: 6px;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }

    .upgrade-banner:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
    }

    .upgrade-title {
      font-size: 13px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .upgrade-desc {
      font-size: 11px;
      opacity: 0.9;
    }

    .upgrade-features {
      font-size: 10px;
      opacity: 0.85;
      margin-top: 4px;
    }
    
    .messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .message {
      padding: 10px 12px;
      border-radius: 4px;
      max-width: 100%;
      word-wrap: break-word;
      animation: slideIn 0.2s ease-out;
    }
    
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .message.user {
      background-color: var(--vscode-input-background);
      border-left: 3px solid var(--vscode-button-background);
    }
    
    .message.assistant {
      background-color: var(--vscode-editor-background);
      border-left: 3px solid var(--vscode-textLink-foreground);
    }
    
    .message-header {
      font-size: 11px;
      opacity: 0.7;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
    }
    
    .message-content {
      line-height: 1.5;
      white-space: pre-wrap;
    }
    
    .message-content code {
      background-color: var(--vscode-textCodeBlock-background);
      padding: 2px 4px;
      border-radius: 2px;
      font-family: var(--vscode-editor-font-family);
    }
    
    .message-content pre {
      background-color: var(--vscode-textCodeBlock-background);
      padding: 8px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 8px 0;
      position: relative;
    }
    
    .code-block {
      position: relative;
    }
    
    .copy-button {
      position: absolute;
      top: 4px;
      right: 4px;
      padding: 4px 8px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 2px;
      font-size: 11px;
      cursor: pointer;
      opacity: 0.7;
    }
    
    .copy-button:hover {
      opacity: 1;
    }
    
    .input-container {
      padding: 12px 16px;
      border-top: 1px solid var(--vscode-panel-border);
      background-color: var(--vscode-sideBar-background);
    }
    
    .input-wrapper {
      display: flex;
      gap: 8px;
      align-items: flex-end;
    }
    
    #messageInput {
      flex: 1;
      padding: 8px 10px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 3px;
      resize: none;
      max-height: 120px;
      font-family: var(--vscode-font-family);
      font-size: 13px;
    }
    
    #messageInput:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }
    
    .button {
      padding: 8px 14px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      white-space: nowrap;
    }
    
    .button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    
    .button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .toolbar {
      padding: 8px 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 8px;
    }
    
    .toolbar-button {
      padding: 4px 8px;
      font-size: 11px;
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    
    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      opacity: 0.6;
      text-align: center;
      padding: 20px;
    }
    
    .empty-state-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    
    .suggestions {
      margin-top: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .suggestion {
      padding: 8px 12px;
      background-color: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s ease;
    }
    
    .suggestion:hover {
      background-color: var(--vscode-list-hoverBackground);
      border-color: var(--vscode-focusBorder);
      transform: translateX(4px);
    }
    
    .suggestion-btn {
      border-left-width: 3px !important;
    }
    
    .suggestion:hover {
      background-color: var(--vscode-list-hoverBackground);
    }
    
    .autonomy-panel {
      background-color: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 10px;
      margin-top: 8px;
      font-size: 11px;
    }
    
    .autonomy-level {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }
    
    .level-option {
      flex: 1;
      padding: 6px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 3px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .level-option:hover {
      background-color: var(--vscode-list-hoverBackground);
    }
    
    .level-option.active {
      border-color: var(--vscode-focusBorder);
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      font-weight: bold;
    }
    
    .permissions-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      margin-top: 6px;
    }
    
    .permission-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      padding: 2px;
    }
    
    .permission-item input {
      cursor: pointer;
    }
    
    /* Next Steps Buttons */
    .next-steps-container {
      background-color: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 12px;
      margin: 8px 0;
    }
    
    .next-steps-title {
      font-weight: bold;
      margin-bottom: 10px;
      color: var(--vscode-foreground);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .next-step-btn {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 12px;
      margin: 6px 0;
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--vscode-button-border);
      border-radius: 4px;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s;
    }
    
    .next-step-btn:hover {
      background-color: var(--vscode-button-hoverBackground);
      color: var(--vscode-button-foreground);
      transform: translateY(-1px);
    }
    
    .next-step-title {
      font-weight: 600;
      font-size: 12px;
    }
    
    .next-step-desc {
      font-size: 11px;
      opacity: 0.9;
    }
    
    .next-step-priority {
      font-size: 9px;
      opacity: 0.7;
      text-transform: uppercase;
    }
    
    .next-step-priority.high { color: #f48771; }
    
    .file-changes-container {
      background-color: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 12px;
      margin: 10px 0;
    }
    
    .file-changes-header {
      display: flex;
      align-items: center;
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    
    .file-changes-summary {
      font-size: 11px;
      opacity: 0.8;
      white-space: pre-line;
      margin-bottom: 12px;
    }
    
    .file-changes-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 12px;
    }
    
    .file-change-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      background-color: var(--vscode-input-background);
      border-radius: 4px;
    }
    
    .file-change-type {
      font-size: 14px;
    }
    
    .file-change-path {
      flex: 1;
      font-size: 11px;
      font-family: var(--vscode-editor-font-family);
      cursor: pointer;
    }
    
    .file-change-path:hover {
      text-decoration: underline;
    }
    
    .view-diff-btn {
      padding: 3px 8px;
      font-size: 10px;
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--vscode-button-border);
      border-radius: 3px;
      cursor: pointer;
    }
    
    .view-diff-btn:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    
    .file-changes-actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    
    .accept-changes-btn, .reject-changes-btn {
      flex: 1;
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 600;
      border: 1px solid var(--vscode-button-border);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .accept-changes-btn {
      background-color: #4CAF50;
      color: white;
    }
    
    .accept-changes-btn:hover {
      background-color: #45a049;
    }
    
    .reject-changes-btn {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    
    .reject-changes-btn:hover {
      background-color: var(--vscode-errorForeground);
      color: white;
    }
    .next-step-priority.medium { color: #dcdcaa; }
    .next-step-priority.low { color: #9cdcfe; }
    
    /* Collapsible sections */
    .config-section {
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    
    .config-header {
      padding: 8px 16px;
      background-color: var(--vscode-sideBar-background);
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      font-weight: 600;
      user-select: none;
    }
    
    .config-header:hover {
      background-color: var(--vscode-list-hoverBackground);
    }
    
    .config-content {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease;
    }
    
    .config-content.expanded {
      max-height: 500px;
      overflow-y: auto;
    }
    
    .collapse-icon {
      transition: transform 0.3s;
    }
    
    .collapse-icon.expanded {
      transform: rotate(180deg);
    }
    
    .compact-select {
      width: 100%;
      padding: 6px 8px;
      margin: 4px 0;
      background-color: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      border-radius: 3px;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <!-- Collapsible Model Selection -->
  <div class="config-section">
    <div class="config-header" id="modelsHeader">
      <span>🤖 Models <span class="tier-badge">${isPro ? 'PRO: 4 max' : 'FREE: 2 max'}</span></span>
      <span class="collapse-icon">▼</span>
    </div>
    <div class="config-content" id="modelsContent">
      <div style="padding: 8px 16px;">
        <!-- Quick select dropdowns -->
        <select class="compact-select" id="freeModelSelect">
          <option value="">➕ Add Free Model</option>
          <optgroup label="🔥 Top Free">
            <option value="llama-3.3-70b">⚡ Llama 3.3 70B</option>
            <option value="deepseek-r1">🧠 DeepSeek R1 (Reasoning)</option>
            <option value="qwen3-coder">💻 Qwen3 Coder 480B</option>
            <option value="devstral">🚀 Devstral 2 (Agentic)</option>
          </optgroup>
          <optgroup label="⚡ Fast Free">
            <option value="gemini-flash">⚡ Gemini 2.0 Flash</option>
            <option value="deepseek-v3">⚡ DeepSeek V3</option>
            <option value="mimo-flash">⚡ MiMo V2 Flash</option>
            <option value="glm-4.5-air">⚡ GLM 4.5 Air</option>
            <option value="llama-3.1-8b">⚡ Llama 3.1 8B</option>
          </optgroup>
        </select>
        
        <select class="compact-select" id="proModelSelect" ${isPro ? '' : 'disabled'}>
          <option value="">➕ Add Premium Model ${isPro ? '' : '(PRO only)'}</option>
          <optgroup label="💰 Low Cost">
            <option value="llama-4-maverick">Llama 4 Maverick (1M ctx)</option>
            <option value="llama-4-scout">Llama 4 Scout</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash Pro</option>
          </optgroup>
          <optgroup label="🧠 Reasoning">
            <option value="o3-mini">OpenAI o3-mini</option>
            <option value="o1">OpenAI o1 (ULTRA)</option>
          </optgroup>
          <optgroup label="👑 Flagship">
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4.1">GPT-4.1 (1M ctx)</option>
            <option value="claude-sonnet-4">Claude Sonnet 4</option>
            <option value="claude-opus-4">Claude Opus 4 (ULTRA)</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
            <option value="grok-3">Grok 3 Beta</option>
          </optgroup>
        </select>
        
        <!-- Selected models -->
        <div id="selectedModelsContainer" style="margin-top: 8px;"></div>
      </div>
    </div>
  </div>
  
  <!-- Workflow Selection (always visible) -->
  <div style="padding: 8px 16px; border-bottom: 1px solid var(--vscode-panel-border);">
    <select id="workflowSelector" class="compact-select">
      <option value="single">🎯 Single Model</option>
      <option value="parallel">⚡ Parallel (All respond)</option>
      <option value="chain">🔗 Chain (Sequential)</option>
      <option value="agentic">🤖 Agentic (Autonomous)</option>
    </select>
  </div>
  
  <!-- Collapsible Autonomy Panel -->
  <div class="config-section" id="autonomySection" style="display: none;">
    <div class="config-header" id="autonomyHeader">
      <span>⚙️ Autonomy Settings</span>
      <span class="collapse-icon">▼</span>
    </div>
    <div class="config-content" id="autonomyContent">
      <div style="padding: 8px 16px;">
        <div class="autonomy-level">
          <div class="level-option" data-level="1">
            <div>🟢 L1</div>
            <div style="font-size: 9px; margin-top: 2px;">Advisory</div>
          </div>
          <div class="level-option" data-level="2">
            <div>🟡 L2</div>
            <div style="font-size: 9px; margin-top: 2px;">Assisted</div>
          </div>
          <div class="level-option active" data-level="3">
            <div>🔴 L3</div>
            <div style="font-size: 9px; margin-top: 2px;">Full Auto</div>
          </div>
        </div>
        <div class="permissions-grid" style="margin-top: 8px;">
        <label class="permission-item">
          <input type="checkbox" class="perm-check" data-perm="read" checked />
          <span>📂 Read files</span>
        </label>
        <label class="permission-item">
          <input type="checkbox" class="perm-check" data-perm="edit" checked />
          <span>✏️ Edit files</span>
        </label>
        <label class="permission-item">
          <input type="checkbox" class="perm-check" data-perm="terminal" checked />
          <span>⚡ Terminal</span>
        </label>
        <label class="permission-item">
          <input type="checkbox" class="perm-check" data-perm="create" checked />
          <span>➕ Create files</span>
        </label>
        <label class="permission-item">
          <input type="checkbox" class="perm-check" data-perm="delete" />
          <span>🗑️ Delete files</span>
        </label>
        <label class="permission-item">
          <input type="checkbox" class="perm-check" data-perm="multi-step" checked />
          <span>🔄 Multi-step</span>
        </label>
        <label class="permission-item">
          <input type="checkbox" class="perm-check" data-perm="restructure" />
          <span>🔧 Restructure</span>
        </label>
        <label class="permission-item">
          <input type="checkbox" class="perm-check" data-perm="network" />
          <span>🌐 Network</span>
        </label>
        </div>
      </div>
    </div>
  </div>
  
  <div class="toolbar">
    <button class="toolbar-button" id="clearButton">🗑️ Clear Chat</button>
    <button class="toolbar-button" id="contextButton">📎 Include Selection</button>
  </div>
  
  ${!isPro ? `
  <div style="padding: 8px 16px; border-bottom: 1px solid var(--vscode-panel-border);">
    <button class="upgrade-banner" id="upgradeButton" style="width: 100%; padding: 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
      ⭐ Upgrade to Pro - Unlock Premium Models
    </button>
  </div>
  ` : ''}
  
  <div class="messages-container" id="messagesContainer">
    <div class="empty-state">
      <div class="empty-state-icon">💬</div>
      <h3>Welcome to HybridMind</h3>
      <p>Start a conversation or try one of these:</p>
      <div class="suggestions">
        <div class="suggestion" data-prompt="Explain the selected code">Explain selected code</div>
        <div class="suggestion" data-prompt="Review this code for best practices">Review my code</div>
        <div class="suggestion" data-prompt="Generate unit tests for this function">Generate tests</div>
        <div class="suggestion" data-prompt="How can I optimize this code?">Optimize code</div>
      </div>
    </div>
  </div>
  
  <div class="input-container">
    <div class="input-wrapper">
      <textarea 
        id="messageInput" 
        placeholder="Ask HybridMind anything... (Shift+Enter for new line)"
        rows="1"
      ></textarea>
      <button id="sendButton" class="button">Send</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const messagesContainer = document.getElementById('messagesContainer');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const workflowSelector = document.getElementById('workflowSelector');
    const clearButton = document.getElementById('clearButton');
    const upgradeButton = document.getElementById('upgradeButton');
    
    const MAX_MODELS = ${maxModels};
    const IS_PRO = ${isPro};
    
    // Upgrade button handler
    if (upgradeButton) {
      upgradeButton.addEventListener('click', () => {
        vscode.postMessage({
          type: 'openUpgrade'
        });
      });
    }
    
    let messages = [];
    let includeContext = false;
    let selectedModels = ['llama-3.3-70b']; // Default
    let autonomyLevel = 3; // Default to Full Auto
    let permissions = {
      read: true,
      edit: true,
      terminal: true,
      create: true,
      delete: false,
      'multi-step': true,
      restructure: false,
      network: false
    };

    // Collapsible sections
    function setupCollapse(headerId, contentId) {
      const header = document.getElementById(headerId);
      const content = document.getElementById(contentId);
      if (!header || !content) return;
      
      const icon = header.querySelector('.collapse-icon');
      
      header.addEventListener('click', () => {
        content.classList.toggle('expanded');
        if (icon) icon.classList.toggle('expanded');
      });
    }
    
    setupCollapse('modelsHeader', 'modelsContent');
    setupCollapse('autonomyHeader', 'autonomyContent');
    
    // Model selection from dropdowns
    const selectedModelsContainer = document.getElementById('selectedModelsContainer');
    const freeModelSelect = document.getElementById('freeModelSelect');
    const proModelSelect = document.getElementById('proModelSelect');
    
    function renderSelectedModels() {
      selectedModelsContainer.innerHTML = selectedModels.map(model => {
        const modelNames = {
          // Free models
          'llama-3.3-70b': '⚡ Llama 3.3 70B',
          'llama-3.1-8b': '⚡ Llama 3.1 8B',
          'gemini-flash': '⚡ Gemini Flash',
          'deepseek-v3': '⚡ DeepSeek V3',
          'deepseek-r1': '🧠 DeepSeek R1',
          'qwen3-coder': '💻 Qwen3 Coder',
          'devstral': '🚀 Devstral 2',
          'mimo-flash': '⚡ MiMo Flash',
          'glm-4.5-air': '⚡ GLM 4.5 Air',
          // Low cost
          'llama-4-maverick': '🦙 Llama 4 Maverick',
          'llama-4-scout': '🦙 Llama 4 Scout',
          'gemini-2.0-flash': '⚡ Gemini 2.0 Flash',
          // Premium
          'gpt-4o': '👑 GPT-4o',
          'gpt-4.1': '👑 GPT-4.1',
          'claude-sonnet-4': '👑 Claude Sonnet 4',
          'claude-opus-4': '👑 Claude Opus 4',
          'gemini-2.5-pro': '👑 Gemini 2.5 Pro',
          'grok-3': '👑 Grok 3',
          'o3-mini': '🧠 o3-mini',
          'o1': '🧠 o1'
        };
        const displayName = modelNames[model] || model;
        return \`
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 3px; margin: 2px 0; font-size: 11px;">
            <span>\${displayName}</span>
            <button onclick="removeModel('\${model}')" style="background: none; border: none; color: var(--vscode-foreground); cursor: pointer; opacity: 0.6; padding: 2px 6px;">✕</button>
          </div>
        \`;
      }).join('');
    }
    
    window.removeModel = function(model) {
      selectedModels = selectedModels.filter(m => m !== model);
      renderSelectedModels();
      vscode.postMessage({ type: 'changeModels', models: selectedModels });
    };
    
    freeModelSelect.addEventListener('change', (e) => {
      const model = e.target.value;
      if (model && !selectedModels.includes(model)) {
        if (selectedModels.length >= MAX_MODELS) {
          alert(\`\${IS_PRO ? 'Pro' : 'Free'} tier limited to \${MAX_MODELS} models!\`);
          e.target.value = '';
          return;
        }
        selectedModels.push(model);
        renderSelectedModels();
        vscode.postMessage({ type: 'changeModels', models: selectedModels });
      }
      e.target.value = '';
    });
    
    proModelSelect.addEventListener('change', (e) => {
      const model = e.target.value;
      if (model && !selectedModels.includes(model)) {
        if (selectedModels.length >= MAX_MODELS) {
          alert(\`Pro tier limited to \${MAX_MODELS} models!\`);
          e.target.value = '';
          return;
        }
        selectedModels.push(model);
        renderSelectedModels();
        vscode.postMessage({ type: 'changeModels', models: selectedModels });
      }
      e.target.value = '';
    });
    
    // Initial render
    renderSelectedModels();
    renderMessages();

    // Autonomy panel visibility
    const autonomySection = document.getElementById('autonomySection');
    workflowSelector.addEventListener('change', () => {
      if (workflowSelector.value === 'agentic') {
        autonomySection.style.display = 'block';
      } else {
        autonomySection.style.display = 'none';
      }
      vscode.postMessage({
        type: 'changeWorkflow',
        workflow: workflowSelector.value
      });
    });

    // Autonomy level selector
    document.querySelectorAll('.level-option').forEach(option => {
      option.addEventListener('click', () => {
        // Remove active class from all
        document.querySelectorAll('.level-option').forEach(o => o.classList.remove('active'));
        // Add to clicked
        option.classList.add('active');
        autonomyLevel = parseInt(option.dataset.level);
        
        // Auto-enable permissions for higher levels
        if (autonomyLevel === 3) {
          document.querySelectorAll('.perm-check').forEach(cb => {
            if (cb.dataset.perm !== 'delete' && cb.dataset.perm !== 'network') {
              cb.checked = true;
              permissions[cb.dataset.perm] = true;
            }
          });
        }
        
        vscode.postMessage({
          type: 'changeAutonomy',
          level: autonomyLevel,
          permissions: permissions
        });
      });
    });

    // Permission checkboxes
    document.querySelectorAll('.perm-check').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        permissions[checkbox.dataset.perm] = checkbox.checked;
        vscode.postMessage({
          type: 'changeAutonomy',
          level: autonomyLevel,
          permissions: permissions
        });
      });
    });

    // Handle message sending
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-resize textarea
    messageInput.addEventListener('input', () => {
      messageInput.style.height = 'auto';
      messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    });

    function sendMessage() {
      const message = messageInput.value.trim();
      if (!message) return;
      
      if (selectedModels.length === 0) {
        alert('Please select at least one model');
        return;
      }

      vscode.postMessage({
        type: 'sendMessage',
        message: message,
        models: selectedModels,
        workflow: workflowSelector.value,
        includeContext: includeContext  // Send context flag to extension
      });

      messageInput.value = '';
      messageInput.style.height = 'auto';
      sendButton.disabled = true;
    }

    // Workflow selection
    workflowSelector.addEventListener('change', () => {
      vscode.postMessage({
        type: 'changeWorkflow',
        workflow: workflowSelector.value
      });
    });

    // Clear chat
    clearButton.addEventListener('click', () => {
      vscode.postMessage({ type: 'clearHistory' });
      messages = [];
      renderMessages();
    });

    // Context toggle
    document.getElementById('contextButton').addEventListener('click', () => {
      includeContext = !includeContext;
      document.getElementById('contextButton').textContent = 
        includeContext ? '📎 Context On' : '📎 Include Selection';
    });

    // Suggestion clicks - auto-enable context for code-related prompts
    document.querySelectorAll('.suggestion').forEach(btn => {
      btn.addEventListener('click', () => {
        const prompt = btn.dataset.prompt;
        messageInput.value = prompt;
        
        // Auto-enable context for prompts that mention "code" or "selected"
        if (prompt.toLowerCase().includes('code') || prompt.toLowerCase().includes('selected')) {
          includeContext = true;
          document.getElementById('contextButton').textContent = '📎 Context On';
        }
        
        sendMessage();
      });
    });

    // Receive messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'updateMessages') {
        messages = message.messages;
        renderMessages();
        sendButton.disabled = false;
      }
    });

    function renderMessages() {
      if (messages.length === 0) {
        messagesContainer.innerHTML = \`
          <div class="empty-state">
            <div class="empty-state-icon">💬</div>
            <h3>Welcome to HybridMind</h3>
            <p>Start a conversation or try one of these:</p>
            <div class="suggestions">
              <div class="suggestion" data-prompt="Explain the selected code">Explain selected code</div>
              <div class="suggestion" data-prompt="Review this code for best practices">Review my code</div>
              <div class="suggestion" data-prompt="Generate unit tests for this function">Generate tests</div>
              <div class="suggestion" data-prompt="How can I optimize this code?">Optimize code</div>
            </div>
          </div>
        \`;
        
        // Re-attach suggestion listeners
        document.querySelectorAll('.suggestion').forEach(btn => {
          btn.addEventListener('click', () => {
            const prompt = btn.dataset.prompt;
            messageInput.value = prompt;
            
            // Auto-enable context for prompts that mention "code" or "selected"
            if (prompt.toLowerCase().includes('code') || prompt.toLowerCase().includes('selected')) {
              includeContext = true;
              document.getElementById('contextButton').textContent = '📎 Context On';
            }
            
            sendMessage();
          });
        });
        return;
      }

      messagesContainer.innerHTML = messages.map((msg, index) => {
        const time = new Date(msg.timestamp).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        // Check if this is a suggestions message (system role with JSON)
        if (msg.role === 'system' && msg.content.startsWith('{')) {
          try {
            const data = JSON.parse(msg.content);
            if (data.type === 'suggestions' && data.suggestions) {
              return renderSuggestions(data.suggestions);
            }
            // Handle next steps buttons
            if (data.type === 'nextSteps' && data.steps) {
              return renderNextSteps(data.steps);
            }
            // Handle file changes UI
            if (data.type === 'fileChanges' && data.changes) {
              return renderFileChanges(data.summary, data.changes);
            }
          } catch (e) {
            // Not a JSON message, render normally
          }
        }
        
        let content = escapeHtml(msg.content);
        content = formatCodeBlocks(content);
        
        return \`
          <div class="message \${msg.role}">
            <div class="message-header">
              <span>\${msg.role === 'user' ? '👤 You' : '🤖 ' + (msg.model || 'AI')}</span>
              <span>\${time}</span>
            </div>
            <div class="message-content">\${content}</div>
          </div>
        \`;
      }).join('');

      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      // Add copy button listeners
      document.querySelectorAll('.copy-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const code = e.target.dataset.code;
          navigator.clipboard.writeText(code);
          e.target.textContent = 'Copied!';
          setTimeout(() => e.target.textContent = 'Copy', 2000);
        });
      });
      
      // Add suggestion button listeners
      document.querySelectorAll('.suggestion-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const task = btn.dataset.task;
          const model = btn.dataset.model;
          vscode.postMessage({
            type: 'executeSuggestion',
            task: task,
            models: model ? [model] : selectedModels
          });
        });
      });
      
      // Add next-step button listeners
      document.querySelectorAll('.next-step-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const stepId = btn.dataset.stepId;
          vscode.postMessage({
            type: 'executeNextStep',
            stepId: stepId,
            models: selectedModels
          });
        });
      });

      // Add file change button listeners
      document.querySelectorAll('.view-diff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const filePath = btn.dataset.filePath;
          vscode.postMessage({
            type: 'viewDiff',
            filePath: filePath
          });
        });
      });

      document.querySelectorAll('.accept-changes-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          vscode.postMessage({
            type: 'acceptChanges'
          });
        });
      });

      document.querySelectorAll('.reject-changes-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          vscode.postMessage({
            type: 'rejectChanges'
          });
        });
      });
    }
    
    function renderSuggestions(suggestions) {
      const priorityEmoji = {
        'high': '🔴',
        'medium': '🟡',
        'low': '🟢'
      };
      
      return \`
        <div class="message assistant">
          <div class="message-header">
            <span>💡 Suggested Next Steps</span>
          </div>
          <div class="message-content">
            <p style="margin-bottom: 12px; opacity: 0.8;">Would you like me to help with any of these?</p>
            <div class="suggestions">
              \${suggestions.map(s => \`
                <div class="suggestion suggestion-btn" 
                     data-task="\${escapeHtml(s.task)}" 
                     data-model="\${s.model || ''}"
                     style="border-left: 3px solid \${s.priority === 'high' ? '#f14c4c' : s.priority === 'medium' ? '#cca700' : '#89d185'}">
                  <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                    <span>\${priorityEmoji[s.priority] || '🔵'}</span>
                    <strong>\${escapeHtml(s.title)}</strong>
                  </div>
                  <div style="font-size: 11px; opacity: 0.9; margin-bottom: 4px;">
                    \${escapeHtml(s.description)}
                  </div>
                  <div style="font-size: 10px; opacity: 0.7;">
                    ⚡ \${s.model || 'Auto-select model'}
                  </div>
                </div>
              \`).join('')}
            </div>
          </div>
        </div>
      \`;
    }

    function renderNextSteps(steps) {
      const priorityEmoji = {
        'high': '🔴',
        'medium': '🟡',
        'low': '🟢'
      };
      
      return \`
        <div class="next-steps-container">
          <div class="next-steps-title">🚀 Suggested Next Actions</div>
          \${steps.map(step => \`
            <button class="next-step-btn" data-step-id="\${step.id}">
              <div class="next-step-title">
                <span class="next-step-priority \${step.priority}">\${priorityEmoji[step.priority]} \${step.priority.toUpperCase()}</span>
                • \${escapeHtml(step.title)}
              </div>
              <div class="next-step-desc">\${escapeHtml(step.description)}</div>
              <div style="font-size: 10px; opacity: 0.6; margin-top: 4px; font-style: italic;">
                💭 \${escapeHtml(step.reasoning)}
              </div>
            </button>
          \`).join('')}
          <div style="margin-top: 8px; font-size: 10px; opacity: 0.7; text-align: center;">
            Click any action to execute it autonomously
          </div>
        </div>
      \`;
    }

    function renderFileChanges(summary, changes) {
      const typeEmoji = {
        'edit': '✏️',
        'create': '➕',
        'delete': '🗑️'
      };
      
      return \`
        <div class="file-changes-container">
          <div class="file-changes-header">
            <span style="font-size: 18px;">📝</span>
            <span style="font-weight: 600; margin-left: 8px;">File Changes</span>
          </div>
          <div class="file-changes-summary">\${escapeHtml(summary)}</div>
          <div class="file-changes-list">
            \${changes.map(change => \`
              <div class="file-change-item">
                <span class="file-change-type">\${typeEmoji[change.type]}</span>
                <span class="file-change-path" data-file-path="\${change.file}">
                  \${change.file.split(/[\\/\\\\]/).pop()}
                </span>
                <button class="view-diff-btn" data-file-path="\${change.file}">View Diff</button>
              </div>
            \`).join('')}
          </div>
          <div class="file-changes-actions">
            <button class="accept-changes-btn">✅ Accept All Changes</button>
            <button class="reject-changes-btn">↩️ Reject All Changes</button>
          </div>
          <div style="margin-top: 8px; font-size: 10px; opacity: 0.7; text-align: center;">
            Changes are tracked until you accept or reject them
          </div>
        </div>
      \`;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function formatCodeBlocks(content) {
      // Match code blocks with language
      content = content.replace(/\\\`\\\`\\\`(\\w+)?\\n([\\s\\S]*?)\\\`\\\`\\\`/g, (match, lang, code) => {
        const escapedCode = escapeHtml(code);
        return \`<div class="code-block"><button class="copy-button" data-code="\${escapeHtml(code)}">Copy</button><pre><code>\${escapedCode}</code></pre></div>\`;
      });
      
      // Match inline code
      content = content.replace(/\\\`([^\\\`]+)\\\`/g, '<code>$1</code>');
      
      return content;
    }
  </script>
</body>
</html>`;
  }
}
