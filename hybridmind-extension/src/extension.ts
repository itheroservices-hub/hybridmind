import * as vscode from 'vscode';
import { startEmbeddedServer, stopEmbeddedServer } from './embeddedServer';
import { ChatPanel } from './views/chatPanel';
import { ChatSidebarProvider } from './views/chatSidebarProvider';
import { InlineChatProvider } from './views/inlineChatProvider';
import { LicenseManager } from './auth/licenseManager';
import { AgentConfig } from './agents/agentConfig';
import { registerAgenticCommands } from './commands/agenticCommands';
import { registerMultiModelCommands } from './commands/multiModelCommands';
import { UsageTracker } from './utils/usageTracker';

let serverPort: number | null = null;
let licenseManager: LicenseManager;
let inlineChatProvider: InlineChatProvider;
let usageTracker: UsageTracker;

export async function activate(context: vscode.ExtensionContext) {
  console.log('HybridMind extension activating...');

  // Initialize license manager
  licenseManager = LicenseManager.getInstance();
  // Initialize usage tracker
  usageTracker = new UsageTracker();
  context.subscriptions.push(usageTracker.getStatusBarItem());
  
  // Make tracker globally available for API calls
  (global as any).hybridmindUsageTracker = usageTracker;

  // Reset warning flag every hour
  setInterval(() => usageTracker.resetWarning(), 3600000);

  // DISABLED: Use standalone backend on port 3000 instead
  // Start the embedded server automatically
  // try {
  //   serverPort = await startEmbeddedServer(context);
  //   
  //   // Show tier status
  //   const tier = licenseManager.isPro() ? 'Pro' : 'Free';
  //   vscode.window.showInformationMessage(`HybridMind ${tier} is ready! (Server on port ${serverPort})`);
  // } catch (error: any) {
  //   vscode.window.showErrorMessage(`Failed to start HybridMind server: ${error.message}`);
  //   return;
  // }
  
  serverPort = 3000; // Use standalone backend
  const tier = licenseManager.isPro() ? 'Pro' : 'Free';
  vscode.window.showInformationMessage(`HybridMind ${tier} is ready! (Using backend on port ${serverPort})`);

  // Check if backend has models available (non-blocking, 4s timeout)
  const _ctl = new AbortController();
  const _timer = setTimeout(() => _ctl.abort(), 4000);
  fetch(`http://localhost:${serverPort}/models`, {
    signal: _ctl.signal,
    headers: licenseManager.getApiHeaders()
  }).then(async (response) => {
    clearTimeout(_timer);
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
  }).catch(() => {
    clearTimeout(_timer);
    // Server not running or unreachable — silently skip check
  });

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

  // Verify license and refresh UI once resolved
  licenseManager.verifyLicense().then(() => {
    sidebarProvider.refreshTier();
  }).catch(() => {/* silent */});

  // Register inline chat provider
  inlineChatProvider = new InlineChatProvider(serverPort);
  context.subscriptions.push(inlineChatProvider);

  // Register commands
  registerCommands(context);

  // Register agentic commands (these actually execute actions!)
  registerAgenticCommands(context, serverPort);
  
  // Register multi-model commands
  registerMultiModelCommands(context, serverPort);

  console.log('HybridMind extension activated successfully.');
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

  // Open Agent Mode (agent customization & teams)
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.openAgentMode', async () => {
      // reveal the view in the sidebar
      await vscode.commands.executeCommand(
        'workbench.view.extension.hybridmind.agentSidebar'
      );
    })
  );

  // Run a configured agent team
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.runAgentTeam', async () => {
      const cfg = AgentConfig.load();
      if (!cfg.teams.length) {
        vscode.window.showInformationMessage('No teams configured. Add agents and create a team first.');
        return;
      }
      type TeamPick = { label: string; index: number };
      const pick = await vscode.window.showQuickPick<TeamPick>(
        cfg.teams.map((team, idx) => ({
          label: team.map(t => t.display).join(', '),
          index: idx
        })),
        { placeHolder: 'Select team to execute' }
      );
      if (!pick) return;
      const team = cfg.teams[pick.index];
      // translate slot IDs to backend agent types (simple mapping example)
      const map: Record<string,string> = {
        'code-generator': 'code_generator',
        'code-reviewer': 'code_reviewer',
        'architect': 'architect',
        'reasoner': 'reasoner',
        // add other mappings or assume id matches
      };
      const agentTypes = team.map((s: any) => map[s.id] || s.id);
      // ask for task description
      const task = await vscode.window.showInputBox({ prompt: 'Describe the task for this team' });
      if (!task) return;

      try {
        const res = await fetch(`http://localhost:${serverPort}/agent/team-collaboration`, {
          method: 'POST',
          headers: licenseManager.getApiHeaders(),
          body: JSON.stringify({ task, agents: agentTypes })
        });
        const data: any = await res.json();
        vscode.window.showInformationMessage(`Team result: ${data.result}`);
      } catch (e: any) {
        vscode.window.showErrorMessage(`Team execution failed: ${e.message}`);
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
          vscode.env.openExternal(vscode.Uri.parse('https://hybridmind.ca/pricing'));
          break;
      }
    })
  );

  // Bring‑Your‑Own‑Key (BYOK) command — 20+ providers
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.setApiKey', async () => {
      type ProviderItem = vscode.QuickPickItem & { value: string };
      const providers: ProviderItem[] = [
        { label: '$(key) OpenAI',          description: 'GPT-4.1, GPT-4o, o1, o3, Codex',          value: 'OpenAI' },
        { label: '$(key) Anthropic',       description: 'Claude Sonnet 4.5, Opus 4.5, Haiku',       value: 'Anthropic' },
        { label: '$(key) OpenRouter',      description: '200+ models via single key (recommended)',  value: 'OpenRouter' },
        { label: '$(key) Google (Gemini)', description: 'Gemini 2.5 Pro, Flash, Nano',              value: 'Google' },
        { label: '$(key) Groq',            description: 'Ultra-fast Llama, Mixtral, DeepSeek',       value: 'Groq' },
        { label: '$(key) DeepSeek',        description: 'DeepSeek V3, R1, R1-Distill',              value: 'DeepSeek' },
        { label: '$(key) xAI (Grok)',      description: 'Grok 3, Grok 2, Grok Vision',              value: 'xAI' },
        { label: '$(key) Mistral AI',      description: 'Mistral Large, Codestral, Devstral',        value: 'Mistral' },
        { label: '$(key) Cohere',          description: 'Command R+, Command A, Embed v4',           value: 'Cohere' },
        { label: '$(key) Together AI',     description: 'Llama, Mixtral, Qwen via Together',         value: 'TogetherAI' },
        { label: '$(key) Fireworks AI',    description: 'Fast open-source inference',                value: 'FireworksAI' },
        { label: '$(key) Perplexity',      description: 'Sonar Pro (online LLMs with search)',       value: 'Perplexity' },
        { label: '$(key) HuggingFace',     description: 'Open-source model hub (Inference API)',     value: 'HuggingFace' },
        { label: '$(key) Replicate',       description: 'Open-source model hosting & fine-tunes',    value: 'Replicate' },
        { label: '$(key) Azure OpenAI',    description: 'Microsoft-hosted OpenAI models',            value: 'AzureOpenAI' },
        { label: '$(key) AWS Bedrock',     description: 'Claude, Titan, Llama via AWS',              value: 'AWSBedrock' },
        { label: '$(key) Vertex AI',       description: 'Gemini and more via Google Cloud',          value: 'VertexAI' },
        { label: '$(key) AI21 Labs',       description: 'Jamba 1.5 Large, Jamba Mini',               value: 'AI21' },
        { label: '$(key) Qwen (Alibaba)',  description: 'Qwen 2.5, Qwen3, QwQ Coder',               value: 'Qwen' },
        { label: '$(key) Novita AI',       description: 'Fast Llama, Flux image, open models',       value: 'NovitaAI' },
        { label: '$(key) Cloudflare AI',   description: 'Edge inference via Cloudflare Workers AI',  value: 'CloudflareAI' },
        { label: '$(key) Ollama (Local)',  description: 'Self-hosted local models (http://localhost:11434)', value: 'Ollama' },
        { label: '$(key) LM Studio',       description: 'Local GGUF model server (OpenAI-compatible)', value: 'LMStudio' },
        { label: '$(key) Other / Custom',  description: 'Enter any provider name manually',          value: '__custom__' }
      ];

      const selected = await vscode.window.showQuickPick(providers, {
        placeHolder: 'Select AI provider to configure',
        title: 'HybridMind BYOK — Bring Your Own Key (24 providers)'
      });
      if (!selected) return;

      let providerName = selected.value;
      if (providerName === '__custom__') {
        const custom = await vscode.window.showInputBox({
          prompt: 'Enter the provider name',
          placeHolder: 'MyProvider'
        });
        if (!custom) return;
        providerName = custom;
      }

      const displayName = selected.label.replace('$(key) ', '');
      const key = await vscode.window.showInputBox({
        prompt: `Enter your ${displayName} API key`,
        password: true,
        placeHolder: providerName === 'OpenAI' ? 'sk-...' : providerName === 'Anthropic' ? 'sk-ant-...' : 'Enter API key'
      });
      if (!key) return;

      const lm = LicenseManager.getInstance();
      await lm.setUserApiKey(providerName, key);
      vscode.window.showInformationMessage(`✓ ${displayName} API key saved. HybridMind will route requests through your key.`);
    })
  );

  // Show Usage Details
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.showUsageDetails', async () => {
      if (!serverPort) {
        vscode.window.showErrorMessage('Server not running');
        return;
      }

      try {
        const response = await fetch(`http://localhost:${serverPort}/cost-stats`, {
          headers: licenseManager.getApiHeaders()
        });
        const data = await response.json() as any;
        const stats = data.data;

        const tier = licenseManager.isPro() ? 'Pro' : 'Free';
        const limits = tier === 'Pro' 
          ? { requests: '500/hour', cost: '$50/day' }
          : { requests: '50/hour', cost: '$2/day' };

        const message = `
**HybridMind Usage Statistics**

**Your Tier:** ${tier} ${tier === 'Pro' ? '💎' : '🆓'}

**Requests:**
- Last Hour: ${stats.requestsLastHour}
- Today: ${stats.requestsToday}
- Limit: ${limits.requests}

**Cost Budget:**
- Used Today: $${stats.dailySpent}
- Remaining: $${stats.dailyRemaining}
- Daily Limit: ${limits.cost}
- Usage: ${stats.percentUsed}%

**Resets in:** ${stats.resetsIn}

${stats.warning || ''}
${tier === 'Free' && parseFloat(stats.percentUsed) > 50 ? '\n💡 **Upgrade to Pro** for 10x higher limits!' : ''}
        `.trim();

        const action = tier === 'Free' && parseFloat(stats.percentUsed) > 50
          ? await vscode.window.showInformationMessage(message, '💎 Upgrade to Pro', 'OK')
          : await vscode.window.showInformationMessage(message, 'OK');

        if (action === '💎 Upgrade to Pro') {
          vscode.env.openExternal(vscode.Uri.parse('https://hybridmind.ca/pricing'));
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to get usage stats: ${error.message}`);
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

  // Agentic command ids like optimize/generate/refactor are registered via registerAgenticCommands.

  // Agentic command ids like fixBugs are registered via registerAgenticCommands.

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
      headers: licenseManager.getApiHeaders(),
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
    vscode.env.openExternal(vscode.Uri.parse('https://hybridmind.ca/pricing'));
  } else if (action === 'Manage License') {
    vscode.commands.executeCommand('hybridmind.manageLicense');
  }
}

