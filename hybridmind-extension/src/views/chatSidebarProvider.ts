/**
 * HybridMind v1.1 - Sidebar Chat Provider
 * GitHub Copilot-style persistent chat sidebar
 */

import * as vscode from 'vscode';
import { LicenseManager } from '../auth/licenseManager';

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

  constructor(
    private readonly _extensionUri: vscode.Uri,
    serverPort: number
  ) {
    this._serverPort = serverPort;
    this._licenseManager = LicenseManager.getInstance();
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
          await this._handleSendMessage(data.message, data.models, data.workflow);
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
      }
    });
  }

  private async _handleSendMessage(userMessage: string, models?: string[], workflow?: string, isDirectExecution?: boolean) {
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

    // Add user message
    const userMsg: ChatMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    this._messages.push(userMsg);
    this._updateWebview();

    try {
      // Get active editor context
      const editor = vscode.window.activeTextEditor;
      let contextCode = '';
      if (editor && editor.selection) {
        contextCode = editor.document.getText(editor.selection);
      }

      // Choose the appropriate endpoint based on workflow
      let endpoint = '';
      let requestBody: any = {
        tier: this._licenseManager.isPro() ? 'pro' : 'free'
      };

      if (workflowMode === 'agentic') {
        endpoint = '/agent/execute';
        requestBody = {
          goal: userMessage,
          code: contextCode,
          tier: requestBody.tier,
          isDirectExecution: isDirectExecution || false, // Flag for suggestion clicks
          autonomyLevel: this._autonomyLevel,
          permissions: this._permissions
        };
      } else if (workflowMode === 'parallel') {
        endpoint = '/run/parallel';
        requestBody = {
          models: selectedModels,
          prompt: userMessage
        };
      } else if (workflowMode === 'chain') {
        endpoint = '/run/chain';
        requestBody = {
          models: selectedModels,
          prompt: userMessage
        };
      } else {
        // Single model mode
        endpoint = '/run/single';
        requestBody = {
          model: selectedModels[0],
          prompt: userMessage
        };
      }

      // Call backend API
      const response = await fetch(`http://localhost:${this._serverPort}${endpoint}`, {
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

      // Handle multi-model responses
      if (workflowMode === 'parallel' && data.results) {
        // Add multiple assistant messages for parallel execution
        for (const result of data.results) {
          const assistantMsg: ChatMessage = {
            role: 'assistant',
            content: result.content || result.response,
            model: result.model,
            timestamp: new Date(),
            tokens: result.usage?.total_tokens,
            cost: result.cost
          };
          this._messages.push(assistantMsg);
        }
      } else if (workflowMode === 'chain' && data.steps) {
        // Add messages for each step in the chain
        for (const step of data.steps) {
          const assistantMsg: ChatMessage = {
            role: 'assistant',
            content: `**${step.model}**: ${step.content || step.response}`,
            model: step.model,
            timestamp: new Date(),
            tokens: step.usage?.total_tokens,
            cost: step.cost
          };
          this._messages.push(assistantMsg);
        }
      } else if (workflowMode === 'agentic' && data.result) {
        // Agentic workflow with real-time agent steps!
        if (data.steps && data.steps.length > 0) {
          // Show each agent step
          for (const step of data.steps) {
            const stepMsg: ChatMessage = {
              role: 'assistant',
              content: `🤖 **${step.action}**${step.tool ? ` using \`${step.tool}\`` : ''}\n${
                step.result ? `✅ ${step.result.success ? 'Success' : '❌ ' + step.result.error}` : ''
              }${step.aiResponse ? `\n\n${step.aiResponse}` : ''}`,
              model: 'Agent Step',
              timestamp: new Date()
            };
            this._messages.push(stepMsg);
          }
        }
        
        // Final result
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: `**🎯 Autonomous Agent Complete**\n\n${data.result}\n\n*${data.plan || 'Task completed'}*`,
          model: 'Autonomous Agent',
          timestamp: new Date(),
          tokens: data.totalTokens,
          cost: data.totalCost
        };
        this._messages.push(assistantMsg);
        
        // Add suggestions if available
        if (data.suggestions && data.suggestions.length > 0) {
          const suggestionsMsg: ChatMessage = {
            role: 'system',
            content: JSON.stringify({ 
              type: 'suggestions', 
              suggestions: data.suggestions 
            }),
            timestamp: new Date()
          };
          this._messages.push(suggestionsMsg);
        }
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
  </style>
</head>
<body>
  <div class="header">
    <h4 style="margin: 0 0 8px 0; font-size: 12px;">
      Select Models <span class="tier-badge">${isPro ? 'PRO: Up to 4' : 'FREE: Up to 2'}</span>
    </h4>
    <div class="model-checkboxes">
      <!-- FREE TIER -->
      <label class="model-checkbox">
        <input type="checkbox" value="llama-3.3-70b" class="model-check" checked /> 
        <span>⚡ Llama 3.3 70B <span class="badge-free">FREE</span></span>
      </label>
      <label class="model-checkbox">
        <input type="checkbox" value="llama-3.1-8b" class="model-check" /> 
        <span>⚡ Llama 3.1 8B Instant <span class="badge-free">FREE</span></span>
      </label>
      <label class="model-checkbox">
        <input type="checkbox" value="gemini-flash" class="model-check" /> 
        <span>⚡ Gemini Flash <span class="badge-free">FREE</span></span>
      </label>
      <label class="model-checkbox">
        <input type="checkbox" value="deepseek-v3" class="model-check" /> 
        <span>⚡ DeepSeek V3 <span class="badge-free">FREE</span></span>
      </label>
      <label class="model-checkbox">
        <input type="checkbox" value="deepseek/deepseek-r1-distill-llama-70b" class="model-check" /> 
        <span>⚡ DeepSeek R1 Distill <span class="badge-free">FREE</span></span>
      </label>
      <label class="model-checkbox">
        <input type="checkbox" value="meta-llama/llama-3.3-70b-instruct" class="model-check" /> 
        <span>⚡ Llama 3.3 70B OR <span class="badge-free">FREE</span></span>
      </label>
      
      <!-- PREMIUM TIER: REASONING MODELS -->
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--vscode-panel-border); font-size: 10px; color: var(--vscode-descriptionForeground);">
        🧠 REASONING MODELS
      </div>
      <label class="model-checkbox ${isPro ? '' : 'disabled'}">
        <input type="checkbox" value="deepseek/deepseek-r1-0528" class="model-check" ${isPro ? '' : 'disabled'} /> 
        <span>🧠 DeepSeek R1 Latest <span class="badge-premium">PRO</span></span>
      </label>
      <label class="model-checkbox ${isPro ? '' : 'disabled'}">
        <input type="checkbox" value="openai/o3-deep-research" class="model-check" ${isPro ? '' : 'disabled'} /> 
        <span>🧠 o3 Deep Research <span class="badge-ultra">ULTRA</span></span>
      </label>
      <label class="model-checkbox ${isPro ? '' : 'disabled'}">
        <input type="checkbox" value="microsoft/phi-4-reasoning-plus" class="model-check" ${isPro ? '' : 'disabled'} /> 
        <span>🧠 Phi-4 Reasoning <span class="badge-premium">PRO</span></span>
      </label>
      <label class="model-checkbox ${isPro ? '' : 'disabled'}">
        <input type="checkbox" value="deepseek/deepseek-r1" class="model-check" ${isPro ? '' : 'disabled'} /> 
        <span>🧠 DeepSeek R1 <span class="badge-premium">PRO</span></span>
      </label>
      
      <!-- PREMIUM TIER: BEST MODELS -->
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--vscode-panel-border); font-size: 10px; color: var(--vscode-descriptionForeground);">
        👑 FLAGSHIP MODELS
      </div>
      <label class="model-checkbox ${isPro ? '' : 'disabled'}">
        <input type="checkbox" value="openai/gpt-4o" class="model-check" ${isPro ? '' : 'disabled'} /> 
        <span>👑 GPT-4o <span class="badge-premium">PRO</span></span>
      </label>
      <label class="model-checkbox ${isPro ? '' : 'disabled'}">
        <input type="checkbox" value="anthropic/claude-opus-4.5" class="model-check" ${isPro ? '' : 'disabled'} /> 
        <span>👑 Claude Opus 4.5 <span class="badge-ultra">ULTRA</span></span>
      </label>
      <label class="model-checkbox ${isPro ? '' : 'disabled'}">
        <input type="checkbox" value="anthropic/claude-sonnet-4.5" class="model-check" ${isPro ? '' : 'disabled'} /> 
        <span>👑 Claude Sonnet 4.5 <span class="badge-premium">PRO</span></span>
      </label>
      <label class="model-checkbox ${isPro ? '' : 'disabled'}">
        <input type="checkbox" value="anthropic/claude-3.5-sonnet" class="model-check" ${isPro ? '' : 'disabled'} /> 
        <span>👑 Claude 3.5 Sonnet <span class="badge-premium">PRO</span></span>
      </label>
      <label class="model-checkbox ${isPro ? '' : 'disabled'}">
        <input type="checkbox" value="google/gemini-2.5-pro" class="model-check" ${isPro ? '' : 'disabled'} /> 
        <span>👑 Gemini 2.5 Pro <span class="badge-premium">PRO</span></span>
      </label>
      
      <!-- PREMIUM TIER: FAST & CHEAP -->
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--vscode-panel-border); font-size: 10px; color: var(--vscode-descriptionForeground);">
        ⚡ FAST & AFFORDABLE PRO
      </div>
      <label class="model-checkbox ${isPro ? '' : 'disabled'}">
        <input type="checkbox" value="openai/gpt-4o-mini" class="model-check" ${isPro ? '' : 'disabled'} /> 
        <span>⚡ GPT-4o Mini <span class="badge-premium">PRO</span></span>
      </label>
      <label class="model-checkbox ${isPro ? '' : 'disabled'}">
        <input type="checkbox" value="anthropic/claude-haiku-4.5" class="model-check" ${isPro ? '' : 'disabled'} /> 
        <span>⚡ Claude Haiku 4.5 <span class="badge-premium">PRO</span></span>
      </label>
      <label class="model-checkbox ${isPro ? '' : 'disabled'}">
        <input type="checkbox" value="google/gemini-2.5-flash" class="model-check" ${isPro ? '' : 'disabled'} /> 
        <span>⚡ Gemini 2.5 Flash <span class="badge-premium">PRO</span></span>
      </label>
      
      <!-- PREMIUM TIER: SPECIALIZED -->
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--vscode-panel-border); font-size: 10px; color: var(--vscode-descriptionForeground);">
        🎯 SPECIALIZED MODELS
      </div>
      <label class="model-checkbox ${isPro ? '' : 'disabled'}">
        <input type="checkbox" value="mistralai/codestral-2508" class="model-check" ${isPro ? '' : 'disabled'} /> 
        <span>💻 Codestral 2508 <span class="badge-premium">PRO</span></span>
      </label>
      <label class="model-checkbox ${isPro ? '' : 'disabled'}">
        <input type="checkbox" value="mistralai/devstral-2512" class="model-check" ${isPro ? '' : 'disabled'} /> 
        <span>💻 Devstral 2512 <span class="badge-premium">PRO</span></span>
      </label>
      <label class="model-checkbox ${isPro ? '' : 'disabled'}">
        <input type="checkbox" value="qwen/qwen-2.5-coder-32b-instruct" class="model-check" ${isPro ? '' : 'disabled'} /> 
        <span>💻 Qwen Coder <span class="badge-premium">PRO</span></span>
      </label>
      <label class="model-checkbox ${isPro ? '' : 'disabled'}">
        <input type="checkbox" value="qwen/qwen3-coder-plus" class="model-check" ${isPro ? '' : 'disabled'} /> 
        <span>💻 Qwen 3 Coder Plus <span class="badge-premium">PRO</span></span>
      </label>
      <label class="model-checkbox ${isPro ? '' : 'disabled'}">
        <input type="checkbox" value="perplexity/sonar-pro-search" class="model-check" ${isPro ? '' : 'disabled'} /> 
        <span>🌐 Perplexity Sonar Pro <span class="badge-premium">PRO</span></span>
      </label>
      <label class="model-checkbox ${isPro ? '' : 'disabled'}">
        <input type="checkbox" value="x-ai/grok-4" class="model-check" ${isPro ? '' : 'disabled'} /> 
        <span>⚡ Grok 4 <span class="badge-premium">PRO</span></span>
      </label>
      <label class="model-checkbox ${isPro ? '' : 'disabled'}">
        <input type="checkbox" value="meta-llama/llama-3.1-405b-instruct" class="model-check" ${isPro ? '' : 'disabled'} /> 
        <span>🦙 Llama 405B <span class="badge-premium">PRO</span></span>
      </label>
    </div>
    
    ${!isPro ? `
    <button class="upgrade-banner" id="upgradeButton">
      <div class="upgrade-title">
        <span>⭐</span>
        <span>Unlock Premium Models</span>
        <span>⭐</span>
      </div>
      <div class="upgrade-desc">
        Access 25+ AI models including Claude 4.5, GPT-4o, Gemini 2.5 Pro
      </div>
      <div class="upgrade-features">
        🚀 Up to 4 models simultaneously • 🧠 Advanced reasoning • 💎 Premium support
      </div>
    </button>
    ` : ''}
    
    <select id="workflowSelector" class="workflow-selector">
      <option value="single">🎯 Single (Use first selected)</option>
      <option value="parallel">⚡ Parallel (All models respond)</option>
      <option value="chain">🔗 Chain (Sequential refinement)</option>
      <option value="agentic">🤖 Agentic (Planner → Executor → Reviewer)</option>
    </select>
    
    <!-- Autonomy Control Panel (only visible in agentic mode) -->
    <div id="autonomyPanel" class="autonomy-panel" style="display: none;">
      <div style="font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
        <span>⚙️ Autonomy Level</span>
      </div>
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
      <div class="permissions-grid">
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
  
  <div class="toolbar">
    <button class="toolbar-button" id="clearButton">🗑️ Clear Chat</button>
    <button class="toolbar-button" id="contextButton">📎 Include Selection</button>
  </div>
  
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
    const modelCheckboxes = document.querySelectorAll('.model-check');
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

    // Autonomy panel visibility
    const autonomyPanel = document.getElementById('autonomyPanel');
    workflowSelector.addEventListener('change', () => {
      if (workflowSelector.value === 'agentic') {
        autonomyPanel.style.display = 'block';
      } else {
        autonomyPanel.style.display = 'none';
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

    // Handle model checkbox changes
    modelCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        selectedModels = Array.from(modelCheckboxes)
          .filter(cb => cb.checked)
          .map(cb => cb.value);
        
        // Enforce max models limit
        if (selectedModels.length > MAX_MODELS) {
          checkbox.checked = false;
          selectedModels = selectedModels.slice(0, MAX_MODELS);
          alert(\`\${IS_PRO ? 'Pro' : 'Free'} tier limited to \${MAX_MODELS} models!\`);
        }
        
        // Update disabled state
        if (selectedModels.length >= MAX_MODELS) {
          modelCheckboxes.forEach(cb => {
            if (!cb.checked) {
              cb.parentElement.classList.add('disabled');
            }
          });
        } else {
          modelCheckboxes.forEach(cb => {
            cb.parentElement.classList.remove('disabled');
          });
        }
        
        vscode.postMessage({
          type: 'changeModels',
          models: selectedModels
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
        workflow: workflowSelector.value
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

    // Suggestion clicks
    document.querySelectorAll('.suggestion').forEach(btn => {
      btn.addEventListener('click', () => {
        messageInput.value = btn.dataset.prompt;
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
            messageInput.value = btn.dataset.prompt;
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
          } catch (e) {
            // Not a suggestions message, render normally
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
