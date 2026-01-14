/**
 * HybridMind v1.1 - Chat Panel
 * Persistent chat interface with multi-turn conversations
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

export class ChatPanel {
  public static currentPanel: ChatPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _messages: ChatMessage[] = [];
  private _serverPort: number;
  private _currentModel: string = 'gpt-4';
  private _licenseManager: LicenseManager;

  public static createOrShow(extensionUri: vscode.Uri, serverPort: number) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (ChatPanel.currentPanel) {
      ChatPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'hybridmindChat',
      'HybridMind Chat',
      column || vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri]
      }
    );

    ChatPanel.currentPanel = new ChatPanel(panel, extensionUri, serverPort);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, serverPort: number) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._serverPort = serverPort;
    this._licenseManager = LicenseManager.getInstance();

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'sendMessage':
            await this.handleSendMessage(message.text);
            break;
          case 'changeModel':
            await this.handleChangeModel(message.model);
            break;
          case 'clearChat':
            await this.handleClearChat();
            break;
          case 'insertCode':
            await this.handleInsertCode(message.code);
            break;
          case 'copyCode':
            await this.handleCopyCode(message.code);
            break;
          case 'explain':
            await this.handleExplain();
            break;
          case 'refactor':
            await this.handleRefactor();
            break;
          case 'generate':
            await this.handleGenerate(message.prompt);
            break;
          case 'debug':
            await this.handleDebug();
            break;
          case 'chain':
            await this.handleChain();
            break;
        }
      },
      null,
      this._disposables
    );
  }

  private async handleSendMessage(text: string) {
    if (!text.trim()) {
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date()
    };
    this._messages.push(userMessage);
    this._updateMessages();

    // Show thinking indicator
    this._panel.webview.postMessage({ command: 'thinking', value: true });

    try {
      // Call AI model
      const response = await this.callModel(text);

      // Add assistant message
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.content,
        model: this._currentModel,
        timestamp: new Date(),
        tokens: response.tokens,
        cost: response.cost
      };
      this._messages.push(assistantMessage);
      this._updateMessages();

    } catch (error: any) {
      vscode.window.showErrorMessage(`Chat error: ${error.message}`);
      
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `❌ Error: ${error.message}`,
        timestamp: new Date()
      };
      this._messages.push(errorMessage);
      this._updateMessages();
    } finally {
      this._panel.webview.postMessage({ command: 'thinking', value: false });
    }
  }

  private async handleChangeModel(model: string) {
    // Check if model requires Pro tier
    const isPro = this._licenseManager.isPro();
    const premiumModels = ['gpt-4', 'claude-3-5-sonnet', 'claude-3-opus', 'gemini-1.5-pro'];

    if (!isPro && premiumModels.includes(model)) {
      await this._licenseManager.promptForUpgrade('Premium Models');
      return;
    }

    this._currentModel = model;
    this._panel.webview.postMessage({ command: 'modelChanged', model });
    
    // Update tier info in webview
    const tierInfo = {
      isPro,
      modelLimit: this._licenseManager.getModelLimit(),
      tier: this._licenseManager.getTier()
    };
    this._panel.webview.postMessage({ command: 'updateTierInfo', tierInfo });
  }

  private async handleClearChat() {
    this._messages = [];
    this._updateMessages();
  }

  private async handleInsertCode(code: string) {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      editor.edit(editBuilder => {
        editBuilder.insert(editor.selection.active, code);
      });
    }
  }

  private async handleCopyCode(code: string) {
    await vscode.env.clipboard.writeText(code);
    vscode.window.showInformationMessage('Code copied to clipboard');
  }

  private async handleExplain() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor');
      return;
    }

    const selection = editor.selection;
    const code = editor.document.getText(selection.isEmpty ? undefined : selection);

    if (!code) {
      vscode.window.showErrorMessage('No code to explain');
      return;
    }

    const prompt = `Explain this code:\n\n\`\`\`${editor.document.languageId}\n${code}\n\`\`\``;
    await this.handleSendMessage(prompt);
  }

  private async handleRefactor() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor');
      return;
    }

    const selection = editor.selection;
    const code = editor.document.getText(selection.isEmpty ? undefined : selection);

    if (!code) {
      vscode.window.showErrorMessage('No code to refactor');
      return;
    }

    const prompt = `Refactor this code for better readability and performance:\n\n\`\`\`${editor.document.languageId}\n${code}\n\`\`\``;
    await this.handleSendMessage(prompt);
  }

  private async handleGenerate(prompt: string) {
    const editor = vscode.window.activeTextEditor;
    const language = editor?.document.languageId || 'javascript';
    const fullPrompt = `Generate ${language} code for: ${prompt}`;
    await this.handleSendMessage(fullPrompt);
  }

  private async handleDebug() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor');
      return;
    }

    const selection = editor.selection;
    const code = editor.document.getText(selection.isEmpty ? undefined : selection);

    if (!code) {
      vscode.window.showErrorMessage('No code to debug');
      return;
    }

    const prompt = `Debug this code and explain any issues:\n\n\`\`\`${editor.document.languageId}\n${code}\n\`\`\``;
    await this.handleSendMessage(prompt);
  }

  private async handleChain() {
    // Check if chains feature is available
    const canUseChains = await this._licenseManager.canUseFeature('agentic-chains');
    
    if (!canUseChains) {
      await this._licenseManager.promptForUpgrade('Agentic Chains');
      return;
    }

    vscode.window.showInformationMessage('Chain workflows coming soon!');
  }

  private async callModel(prompt: string): Promise<{ content: string; tokens?: number; cost?: number }> {
    // Build context from message history
    const context = this._messages.slice(-10).map(m => ({
      role: m.role,
      content: m.content
    }));

    // Add current prompt
    context.push({ role: 'user', content: prompt });

    const response = await fetch(`http://localhost:${this._serverPort}/api/models/chat`, {
      method: 'POST',
      headers: this._licenseManager.getApiHeaders(),
      body: JSON.stringify({
        model: this._currentModel,
        messages: context,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.json() as { error?: string };
      throw new Error(error.error || 'Model request failed');
    }

    const data = await response.json() as { content?: string; response?: string; usage?: { total_tokens?: number }; cost?: number };
    return {
      content: data.content || data.response || '',
      tokens: data.usage?.total_tokens,
      cost: data.cost
    };
  }

  private _updateMessages() {
    this._panel.webview.postMessage({
      command: 'updateMessages',
      messages: this._messages.map(m => ({
        ...m,
        timestamp: m.timestamp.toISOString()
      }))
    });
  }

  private _update() {
    const webview = this._panel.webview;
    this._panel.title = 'HybridMind Chat';
    this._panel.webview.html = this._getHtmlForWebview(webview);
    
    // Send initial tier info to webview
    const isPro = this._licenseManager.isPro();
    const tierInfo = {
      isPro,
      modelLimit: this._licenseManager.getModelLimit(),
      tier: this._licenseManager.getTier()
    };
    
    // Delay to ensure webview is loaded
    setTimeout(() => {
      this._panel.webview.postMessage({ command: 'updateTierInfo', tierInfo });
    }, 100);
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
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
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    .header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editorGroupHeader-tabsBackground);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
    }

    .tier-badge {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .tier-badge.free {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .tier-badge.pro {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .upgrade-link {
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
      font-size: 11px;
      cursor: pointer;
    }

    .upgrade-link:hover {
      text-decoration: underline;
    }

    .model-selector {
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }

    .clear-button {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 4px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }

    .clear-button:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .message {
      max-width: 85%;
      padding: 12px 16px;
      border-radius: 12px;
      line-height: 1.5;
      word-wrap: break-word;
    }

    .message.user {
      align-self: flex-end;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .message.assistant {
      align-self: flex-start;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
    }

    .message pre {
      background: var(--vscode-textCodeBlock-background);
      padding: 8px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 8px 0;
    }

    .message code {
      font-family: var(--vscode-editor-font-family);
      font-size: 13px;
    }

    .message-meta {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
      display: flex;
      gap: 12px;
    }

    .action-buttons {
      display: flex;
      gap: 6px;
      margin-top: 8px;
    }

    .action-button {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
    }

    .action-button:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .quick-actions {
      padding: 12px 16px;
      border-top: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editorGroupHeader-tabsBackground);
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .quick-action {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .quick-action:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .input-container {
      padding: 16px;
      border-top: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editor-background);
      display: flex;
      gap: 8px;
    }

    .message-input {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      padding: 10px 12px;
      border-radius: 8px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      resize: none;
      min-height: 40px;
      max-height: 120px;
    }

    .message-input:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }

    .send-button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 0 20px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
    }
 style="display: flex; align-items: center; gap: 12px;">
      <label for="modelSelect">Model:</label>
      <select id="modelSelect" class="model-selector">
        <option value="gpt-4">GPT-4</option>
        <option value="gpt-4-turbo">GPT-4 Turbo</option>
        <option value="claude-3-5-sonnet">Claude 3.5 Sonnet ⭐</option>
        <option value="claude-3-sonnet">Claude 3 Sonnet</option>
        <option value="gemini-1.5-pro">Gemini 1.5 Pro ⭐</option>
        <option value="gemini-pro">Gemini Pro</option>
        <option value="deepseek-coder">DeepSeek Coder ⚡</option>
        <option value="groq-llama3-70b">Groq Llama3 70B ⚡</option>
        <option value="qwen-max">Qwen Max</option>
      </select>
    </div>
    <div style="display: flex; align-items: center; gap: 12px;">
      <span id="tierBadge" class="tier-badge free">Free (2 models)</span>
      <button class="clear-button" id="clearButton">Clear Chat</button>
    </div
      color: var(--vscode-descriptionForeground);
      font-style: italic;
    }

    .thinking::after {
      content: '...';
      animation: dots 1.5s steps(4, end) infinite;
    }

    @keyframes dots {
      0%, 20% { content: '.'; }
      40% { content: '..'; }
      60%, 100% { content: '...'; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <label for="modelSelect">Model:</label>
      <select id="modelSelect" class="model-selector">
        <option value="gpt-4">GPT-4</option>
        <option value="gpt-4-turbo">GPT-4 Turbo</option>
        <option value="claude-3-5-sonnet">Claude 3.5 Sonnet ⭐</option>
        <option value="claude-3-sonnet">Claude 3 Sonnet</option>
        <option value="gemini-1.5-pro">Gemini 1.5 Pro ⭐</option>
        <option value="gemini-pro">Gemini Pro</option>
        <option value="deepseek-coder">DeepSeek Coder ⚡</option>
        <option value="groq-llama3-70b">Groq Llama3 70B ⚡</option>
        <option value="qwen-max">Qwen Max</option>
      </select>
    </div>
    <button class="clear-button" id="clearButton">Clear Chat</button>
  </div>

  <div class="messages" id="messages"></div>

  <div class="quick-actions">
    <button class="quick-action" id="explainBtn">📖 Explain</button>
    <button class="quick-action" id="refactorBtn">♻️ Refactor</button>
    <button class="quick-action" id="debugBtn">🐛 Debug</button>
    <button class="quick-action" id="chainBtn">🔗 Chain ⭐</button>
  </div>

  <div class="input-container">
    <textarea
      id="messageInput"
      class="message-input"
      placeholder="Type a message... (Shift+Enter for new line)"
      rows="1"
    ></textarea>
    <button class="send-button" id="sendButton">Send</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const messagesContainer = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const modelSelect = document.getElementById('modelSelect');
    const clearButton = document.getElementById('clearButton');

    let isThinking = false;

    // Send message
    function sendMessage() {
      const text = messageInput.value.trim();
      if (!text || isThinking) return;

      vscode.postMessage({ command: 'sendMessage', text });
      messageInput.value = '';
      autoResize();
    }

    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    messageInput.addEventListener('input', autoResize);

    modelSelect.addEventListener('change', (e) => {
      vscode.postMessage({ command: 'changeModel', model: e.target.value });
    });

    clearButton.addEventListener('click', () => {
      vscode.postMessage({ command: 'clearChat' });
    });

    document.getElementById('explainBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'explain' });
    });

    document.getElementById('refactorBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'refactor' });
    });

    document.getElementById('debugBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'debug' });
    });

    document.getElementById('chainBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'chain' });
    });

    // Auto-resize textarea
    function autoResize() {
      messageInput.style.height = 'auto';
      messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    }

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;

      switch (message.command) {
        case 'updateMessages':
          renderMessages(message.messages);
          break;
        case 'thinking':
          isThinking = message.value;
          sendButton.disabled = message.value;
          if (message.value) {
            showThinking();
          } else {
            hideThinking();
          }
          break;
        case 'updateTierInfo':
          updateTierBadge(message.tierInfo);
          break;
      }
    });

    function updateTierBadge(tierInfo) {
      const badge = document.getElementById('tierBadge');
      if (!badge) return;
      
      const tierText = tierInfo.isPro ? 'Pro' : 'Free';
      const modelLimit = tierInfo.modelLimit || 2;
      
      badge.className = \`tier-badge \${tierInfo.isPro ? 'pro' : 'free'}\`;
      badge.innerHTML = tierInfo.isPro 
        ? \`⭐ \${tierText} (\${modelLimit} models)\`
        : \`\${tierText} (\${modelLimit} models) <a class="upgrade-link" id="upgradeLink" style="margin-left: 8px;">Upgrade →</a>\`;
      
      if (!tierInfo.isPro) {
        setTimeout(() => {
          const upgradeLink = document.getElementById('upgradeLink');
          if (upgradeLink) {
            upgradeLink.addEventListener('click', (e) => {
              e.preventDefault();
              window.open('https://hybridmind.dev/pricing', '_blank');
            });
          }
        }, 50);
      }
    }   modelSelect.value = message.model;
          break;
      }
    });

    function renderMessages(messages) {
      hideThinking();
      messagesContainer.innerHTML = messages.map(msg => renderMessage(msg)).join('');
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function renderMessage(msg) {
      const isUser = msg.role === 'user';
      const formattedContent = formatContent(msg.content);
      const meta = msg.model || msg.tokens || msg.cost ? 
        \`<div class="message-meta">
          \${msg.model ? \`<span>Model: \${msg.model}</span>\` : ''}
          \${msg.tokens ? \`<span>Tokens: \${msg.tokens}</span>\` : ''}
          \${msg.cost ? \`<span>Cost: $\${msg.cost.toFixed(4)}</span>\` : ''}
        </div>\` : '';

      return \`<div class="message \${msg.role}">
        <div>\${formattedContent}</div>
        \${meta}
      </div>\`;
    }

    function formatContent(content) {
      // Simple markdown-like formatting
      return content
        .replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>')
        .replace(/\\\`([^\\\`]+)\\\`/g, '<code>$1</code>')
        .replace(/\\n/g, '<br>');
    }

    function showThinking() {
      const thinking = document.createElement('div');
      thinking.className = 'thinking';
      thinking.id = 'thinking';
      thinking.textContent = 'Thinking';
      messagesContainer.appendChild(thinking);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function hideThinking() {
      const thinking = document.getElementById('thinking');
      if (thinking) {
        thinking.remove();
      }
    }
  </script>
</body>
</html>`;
  }

  public dispose() {
    ChatPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
