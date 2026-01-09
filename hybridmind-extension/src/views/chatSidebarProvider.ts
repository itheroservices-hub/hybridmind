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
        case 'insertCode':
          this._insertCodeAtCursor(data.code);
          break;
      }
    });
  }

  private async _handleSendMessage(userMessage: string, models?: string[], workflow?: string) {
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
          tier: requestBody.tier
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
        throw new Error(`API error: ${response.status}`);
      }

      const data: any = await response.json();

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
        // Add agentic workflow result
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: `**Agentic Result**:\n${data.result}\n\n*Plan:* ${data.plan || 'N/A'}`,
          model: 'Multi-Agent',
          timestamp: new Date(),
          tokens: data.totalTokens,
          cost: data.totalCost
        };
        this._messages.push(assistantMsg);
      } else {
        // Single model response
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: data.content || data.response || data.message,
          model: data.model || selectedModels[0],
          timestamp: new Date(),
          tokens: data.usage?.total_tokens,
          cost: data.cost
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
    }
    
    .suggestion:hover {
      background-color: var(--vscode-list-hoverBackground);
    }
  </style>
</head>
<body>
  <div class="header">
    <h4 style="margin: 0 0 8px 0; font-size: 12px;">
      Select Models <span class="tier-badge">${isPro ? 'PRO: Up to 4' : 'FREE: Up to 2'}</span>
    </h4>
    <div class="model-checkboxes">
      <label class="model-checkbox">
        <input type="checkbox" value="gpt-4" class="model-check" /> GPT-4
      </label>
      <label class="model-checkbox">
        <input type="checkbox" value="claude-3-sonnet" class="model-check" /> Claude 3
      </label>
      <label class="model-checkbox">
        <input type="checkbox" value="llama-3.1-70b" class="model-check" checked /> Llama 3.1
      </label>
      <label class="model-checkbox">
        <input type="checkbox" value="gemini-pro" class="model-check" /> Gemini Pro
      </label>
      <label class="model-checkbox">
        <input type="checkbox" value="deepseek-chat" class="model-check" /> DeepSeek
      </label>
      <label class="model-checkbox">
        <input type="checkbox" value="qwen-max" class="model-check" /> Qwen Max
      </label>
      <label class="model-checkbox">
        <input type="checkbox" value="mixtral-8x7b" class="model-check" /> Mixtral 8x7B
      </label>
      <label class="model-checkbox">
        <input type="checkbox" value="gpt-3.5-turbo" class="model-check" /> GPT-3.5
      </label>
    </div>
    
    <select id="workflowSelector" class="workflow-selector">
      <option value="single">🎯 Single (Use first selected)</option>
      <option value="parallel">⚡ Parallel (All models respond)</option>
      <option value="chain">🔗 Chain (Sequential refinement)</option>
      <option value="agentic">🤖 Agentic (Planner → Executor → Reviewer)</option>
    </select>
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
    
    const MAX_MODELS = ${maxModels};
    const IS_PRO = ${isPro};
    
    let messages = [];
    let includeContext = false;
    let selectedModels = ['llama-3.1-70b']; // Default

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

      messagesContainer.innerHTML = messages.map(msg => {
        const time = new Date(msg.timestamp).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
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
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function formatCodeBlocks(content) {
      // Match code blocks with language
      content = content.replace(/\`\`\`(\w+)?\n([\s\S]*?)\`\`\`/g, (match, lang, code) => {
        const escapedCode = escapeHtml(code);
        return \`<div class="code-block"><button class="copy-button" data-code="\${escapeHtml(code)}">Copy</button><pre><code>\${escapedCode}</code></pre></div>\`;
      });
      
      // Match inline code
      content = content.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
      
      return content;
    }
  </script>
</body>
</html>`;
  }
}
