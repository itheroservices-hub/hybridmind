import * as vscode from 'vscode';
import { startEmbeddedServer, stopEmbeddedServer } from './embeddedServer';
import { ChatPanel } from './views/chatPanel';
import { ChatSidebarProvider } from './views/chatSidebarProvider';
import { InlineChatProvider } from './views/inlineChatProvider';
import { LicenseManager } from './auth/licenseManager';

let serverPort: number | null = null;
let licenseManager: LicenseManager;
let inlineChatProvider: InlineChatProvider;

export async function activate(context: vscode.ExtensionContext) {
  console.log('HybridMind extension activating...');

  // Initialize license manager
  licenseManager = LicenseManager.getInstance();

  // Start the embedded server automatically
  try {
    serverPort = await startEmbeddedServer(context);
    
    // Show tier status
    const tier = licenseManager.isPro() ? 'Pro' : 'Free';
    vscode.window.showInformationMessage(`HybridMind ${tier} is ready! (Server on port ${serverPort})`);
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to start HybridMind server: ${error.message}`);
    return;
  }

  // Check if backend has models available (backend reads from .env)
  try {
    const response = await fetch(`http://localhost:${serverPort}/models`);
    const result = await response.json() as any;
    const models = result.data?.models || [];
    
    if (!models || models.length === 0) {
      const action = await vscode.window.showWarningMessage(
        'No AI models available. Please check your .env file in the backend.',
        'Open .env File'
      );
      if (action === 'Open .env File') {
        const envPath = vscode.Uri.file('e:\\IThero\\HybridMind\\.env');
        vscode.window.showTextDocument(envPath);
      }
    }
  } catch (error) {
    // Server might not be fully ready yet, skip check
    console.log('Could not check models availability:', error);
  }

  // Create status bar item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = licenseManager.isPro() ? '$(star-full) HybridMind Pro' : 'HybridMind Free';
  statusBarItem.tooltip = 'Click to manage license';
  statusBarItem.command = 'hybridmind.manageLicense';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Register sidebar chat view
  const sidebarProvider = new ChatSidebarProvider(context.extensionUri, serverPort);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatSidebarProvider.viewType, sidebarProvider)
  );

  // Register inline chat provider
  inlineChatProvider = new InlineChatProvider(serverPort);
  context.subscriptions.push(inlineChatProvider);

  // Register commands
  registerCommands(context);
}

export function deactivate() {
  stopEmbeddedServer();
}

function registerCommands(context: vscode.ExtensionContext) {
  // Open Chat Window (Available to all tiers)
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.openChat', async () => {
      if (serverPort) {
        ChatPanel.createOrShow(context.extensionUri, serverPort);
      } else {
        vscode.window.showErrorMessage('Server not running');
      }
    })
  );

  // Inline Chat (Ctrl+K / Cmd+K)
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.inlineChat', async () => {
      if (serverPort) {
        await inlineChatProvider.showInlineChat();
      } else {
        vscode.window.showErrorMessage('Server not running');
      }
    })
  );

  // Manage License
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.manageLicense', async () => {
      const tier = licenseManager.isPro() ? 'Pro' : 'Free';
      const action = await vscode.window.showQuickPick([
        { label: '$(info) View License Status', value: 'status' },
        { label: '$(key) Activate Pro License', value: 'activate' },
        { label: '$(trash) Deactivate License', value: 'deactivate' },
        { label: '$(rocket) Upgrade to Pro', value: 'upgrade' }
      ], {
        placeHolder: `Current Tier: ${tier}`
      });

      if (!action) return;

      switch (action.value) {
        case 'status':
          await showLicenseStatus();
          break;
        case 'activate':
          await licenseManager.activateLicense();
          break;
        case 'deactivate':
          await licenseManager.deactivateLicense();
          break;
        case 'upgrade':
          vscode.env.openExternal(vscode.Uri.parse('https://hybridmind.dev/pricing'));
          break;
      }
    })
  );

  // Quick AI Chat
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.quickChat', async () => {
      const prompt = await vscode.window.showInputBox({
        prompt: 'Ask anything...',
        placeHolder: 'What would you like to know?'
      });

      if (!prompt) return;

      const models = await getAvailableModels();
      if (models.length === 0) {
        vscode.window.showErrorMessage('No models available. Please configure API keys.');
        return;
      }

      const modelChoice = await vscode.window.showQuickPick(
        models.map(m => ({ label: m.name, model: m.id })),
        { placeHolder: 'Select a model' }
      );

      if (!modelChoice) return;

      await runPrompt(modelChoice.model, prompt);
    })
  );

  // Code Explanation
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.explainCode', async () => {
      if (serverPort) {
        await inlineChatProvider.quickFix('explain');
      } else {
        vscode.window.showErrorMessage('Server not running');
      }
    })
  );

  // Code Review
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.reviewCode', async () => {
      if (serverPort) {
        await inlineChatProvider.quickFix('review');
      } else {
        vscode.window.showErrorMessage('Server not running');
      }
    })
  );

  // Optimize Code
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.optimizeCode', async () => {
      if (serverPort) {
        await inlineChatProvider.quickFix('optimize');
      } else {
        vscode.window.showErrorMessage('Server not running');
      }
    })
  );

  // Generate Tests
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.generateTests', async () => {
      if (serverPort) {
        await inlineChatProvider.quickFix('tests');
      } else {
        vscode.window.showErrorMessage('Server not running');
      }
    })
  );

  // Fix Bugs
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.fixBugs', async () => {
      if (serverPort) {
        await inlineChatProvider.quickFix('fix');
      } else {
        vscode.window.showErrorMessage('Server not running');
      }
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.optimizeCode', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
      }

      const selection = editor.selection;
      const code = editor.document.getText(selection.isEmpty ? undefined : selection);

      if (!code) {
        vscode.window.showErrorMessage('No code to optimize');
        return;
      }

      const models = await getAvailableModels();
      if (models.length === 0) {
        vscode.window.showErrorMessage('No models available. Please configure API keys.');
        return;
      }

      const modelChoice = await vscode.window.showQuickPick(
        models.map(m => ({ label: m.name, model: m.id })),
        { placeHolder: 'Select a model' }
      );

      if (!modelChoice) return;

      const prompt = `Optimize this code for performance and readability:\n\n\`\`\`${editor.document.languageId}\n${code}\n\`\`\``;
      await runPrompt(modelChoice.model, prompt);
    })
  );

  // Generate Tests
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.generateTests', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
      }

      const selection = editor.selection;
      const code = editor.document.getText(selection.isEmpty ? undefined : selection);

      if (!code) {
        vscode.window.showErrorMessage('No code selected');
        return;
      }

      const models = await getAvailableModels();
      if (models.length === 0) {
        vscode.window.showErrorMessage('No models available. Please configure API keys.');
        return;
      }

      const modelChoice = await vscode.window.showQuickPick(
        models.map(m => ({ label: m.name, model: m.id })),
        { placeHolder: 'Select a model' }
      );

      if (!modelChoice) return;

      const prompt = `Generate comprehensive unit tests for this code:\n\n\`\`\`${editor.document.languageId}\n${code}\n\`\`\``;
      await runPrompt(modelChoice.model, prompt);
    })
  );

  // Fix Bugs
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.fixBugs', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
      }

      const selection = editor.selection;
      const code = editor.document.getText(selection.isEmpty ? undefined : selection);

      if (!code) {
        vscode.window.showErrorMessage('No code selected');
        return;
      }

      const models = await getAvailableModels();
      if (models.length === 0) {
        vscode.window.showErrorMessage('No models available. Please configure API keys.');
        return;
      }

      const modelChoice = await vscode.window.showQuickPick(
        models.map(m => ({ label: m.name, model: m.id })),
        { placeHolder: 'Select a model' }
      );

      if (!modelChoice) return;

      const prompt = `Identify and fix bugs in this code:\n\n\`\`\`${editor.document.languageId}\n${code}\n\`\`\``;
      await runPrompt(modelChoice.model, prompt);
    })
  );

  // Quick Chat - keeping for compatibility
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.quickChat', async () => {
      const prompt = await vscode.window.showInputBox({
        prompt: 'Ask anything...',
        placeHolder: 'What would you like to know?'
      });

      if (!prompt) return;

      const models = await getAvailableModels();
      if (models.length === 0) {
        vscode.window.showErrorMessage('No models available. Please configure API keys.');
        return;
      }

      const modelChoice = await vscode.window.showQuickPick(
        models.map(m => ({ label: m.name, model: m.id })),
        { placeHolder: 'Select a model' }
      );

      if (!modelChoice) return;

      await runPrompt(modelChoice.model, prompt);
    })
  );
}

async function getAvailableModels(): Promise<any[]> {
  try {
    const response = await fetch(`http://127.0.0.1:${serverPort}/models`);
    const result: any = await response.json();
    return result.data?.models || [];
  } catch (error) {
    return [];
  }
}

async function runPrompt(model: string, prompt: string) {
  const panel = vscode.window.createWebviewPanel(
    'hybridmindResponse',
    'HybridMind Response',
    vscode.ViewColumn.Beside,
    {}
  );

  panel.webview.html = getLoadingHtml();

  try {
    const response = await fetch(`http://127.0.0.1:${serverPort}/run/single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt })
    });

    const result: any = await response.json();
    panel.webview.html = getResponseHtml(result.content, model);
  } catch (error: any) {
    panel.webview.html = getErrorHtml(error.message);
  }
}

function getLoadingHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; padding: 20px; }
    .loading { text-align: center; padding: 40px; }
  </style>
</head>
<body>
  <div class="loading">
    <h2>Thinking...</h2>
    <p>AI is processing your request...</p>
  </div>
</body>
</html>`;
}

function getResponseHtml(content: string, model: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; 
      padding: 20px;
      line-height: 1.6;
    }
    .header { 
      border-bottom: 1px solid #ddd; 
      padding-bottom: 10px; 
      margin-bottom: 20px;
    }
    .model { 
      color: #666; 
      font-size: 0.9em;
    }
    pre { 
      background: #f4f4f4; 
      padding: 15px; 
      border-radius: 5px; 
      overflow-x: auto;
    }
    code { 
      background: #f4f4f4; 
      padding: 2px 6px; 
      border-radius: 3px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="model">Model: ${model}</div>
  </div>
  <div class="content">
    ${content.replace(/\n/g, '<br>')}
  </div>
</body>
</html>`;
}

function getErrorHtml(error: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; padding: 20px; }
    .error { color: #d32f2f; padding: 20px; border: 1px solid #ffcdd2; background: #ffebee; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="error">
    <h3>Error</h3>
    <p>${error}</p>
  </div>
</body>
</html>`;
}

async function showLicenseStatus() {
  const tier = licenseManager.isPro() ? 'Pro' : 'Free';
  const modelLimit = licenseManager.getModelLimit();
  const contextLimit = licenseManager.getContextLimit();
  const rateLimit = licenseManager.getRateLimit();

  const features = licenseManager.isPro() 
    ? [
        '✅ All models (Groq, DeepSeek, GPT-4, Claude, Gemini)',
        '✅ Ultra-fast inference',
        '✅ Multi-step autonomous workflows',
        `✅ Large context window (${contextLimit.toLocaleString()} tokens)`,
        '✅ Chat window with up to 4 models',
        '✅ Agentic chains with 4-model orchestration',
        '✅ Priority 24/7 support',
        `✅ ${rateLimit} requests/hour`
      ]
    : [
        '✅ Basic models (Groq, DeepSeek, Gemini Flash, Qwen)',
        '✅ Standard inference speed',
        '✅ Single-step workflows',
        `✅ Context window (${contextLimit.toLocaleString()} tokens)`,
        `✅ Chat window with up to ${modelLimit} basic models`,
        '✅ Community support',
        '⚠️ No premium models (GPT-4, Claude 3.5, Gemini Pro)',
        '⚠️ No multi-step autonomous workflows'
      ];

  const message = `**HybridMind ${tier} Tier**\n\n${features.join('\n')}`;

  const action = await vscode.window.showInformationMessage(
    `Current Tier: ${tier}`,
    { modal: true, detail: message },
    tier === 'Free' ? 'Upgrade to Pro' : 'Manage License'
  );

  if (action === 'Upgrade to Pro') {
    vscode.env.openExternal(vscode.Uri.parse('https://hybridmind.dev/pricing'));
  } else if (action === 'Manage License') {
    vscode.commands.executeCommand('hybridmind.manageLicense');
  }
}

