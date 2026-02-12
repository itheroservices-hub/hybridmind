/**
 * Multi-Model Orchestration VS Code Commands
 * 
 * Commands for selecting models, managing chains, and viewing model capabilities
 */

import * as vscode from 'vscode';

export function registerMultiModelCommands(context: vscode.ExtensionContext, serverPort: number) {
  // Command: Select Model Chain Template
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.selectChainTemplate', async () => {
      const templates = [
        {
          label: '$(rocket) Coding Standard',
          description: 'Balanced quality/cost - Claude Sonnet → Qwen → Claude Sonnet',
          detail: 'Medium cost, Fast speed',
          value: 'coding-standard'
        },
        {
          label: '$(star) Coding Premium',
          description: 'Highest quality - o1 → Claude Sonnet → Claude Opus → Gemini',
          detail: 'High cost, Slow speed',
          value: 'coding-premium'
        },
        {
          label: '$(zap) Coding Budget',
          description: 'Cost-optimized - Llama 70B → Qwen → Llama 70B',
          detail: 'Low cost, Ultra-fast speed',
          value: 'coding-budget'
        },
        {
          label: '$(search) Research Deep',
          description: 'Comprehensive research - Gemini → o1 → Claude Opus',
          detail: 'High cost, Slow speed',
          value: 'research-deep'
        },
        {
          label: '$(checklist) Review Comprehensive',
          description: 'Multi-perspective review - Claude Opus → GPT-4 → Claude Sonnet',
          detail: 'High cost, Slow speed',
          value: 'review-comprehensive'
        },
        {
          label: '$(dashboard) Quick Fix',
          description: 'Instant turnaround - Llama 70B → Llama 70B',
          detail: 'Very low cost, Instant',
          value: 'quick-fix'
        }
      ];

      const selected = await vscode.window.showQuickPick(templates, {
        placeHolder: 'Select a chain template',
        title: 'HybridMind Multi-Model Chains'
      });

      if (selected) {
        // Save to settings
        const config = vscode.workspace.getConfiguration('hybridmind');
        await config.update('modelSelection.defaultTemplate', selected.value, vscode.ConfigurationTarget.Global);
        
        vscode.window.showInformationMessage(`Chain template set to: ${selected.label}`);
      }
    })
  );

  // Command: Configure Custom Chain
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.configureCustomChain', async () => {
      const models = await getAvailableModels(serverPort);
      
      // Select planner model
      const planner = await vscode.window.showQuickPick(models, {
        placeHolder: 'Select model for planning/analysis',
        title: 'Step 1/4: Planner Model'
      });
      if (!planner) return;

      // Select builder model
      const builder = await vscode.window.showQuickPick(models, {
        placeHolder: 'Select model for code generation',
        title: 'Step 2/4: Builder Model'
      });
      if (!builder) return;

      // Select reviewer model
      const reviewer = await vscode.window.showQuickPick(models, {
        placeHolder: 'Select model for code review',
        title: 'Step 3/4: Reviewer Model'
      });
      if (!reviewer) return;

      // Optional: Select documenter model
      const documenter = await vscode.window.showQuickPick(
        [{ label: '$(x) Skip', value: null }, ...models],
        {
          placeHolder: 'Select model for documentation (optional)',
          title: 'Step 4/4: Documenter Model'
        }
      );

      // Save custom chain
      const config = vscode.workspace.getConfiguration('hybridmind');
      await config.update('models.planner', planner.value, vscode.ConfigurationTarget.Global);
      await config.update('models.builder', builder.value, vscode.ConfigurationTarget.Global);
      await config.update('models.reviewer', reviewer.value, vscode.ConfigurationTarget.Global);
      if (documenter && documenter.value) {
        await config.update('models.documenter', documenter.value, vscode.ConfigurationTarget.Global);
      }

      await config.update('modelSelection.mode', 'manual', vscode.ConfigurationTarget.Global);

      vscode.window.showInformationMessage(
        `Custom chain configured: ${planner.label} → ${builder.label} → ${reviewer.label}` +
        (documenter && documenter.value ? ` → ${documenter.label}` : '')
      );
    })
  );

  // Command: View Model Capabilities
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.viewModelCapabilities', async () => {
      const panel = vscode.window.createWebviewPanel(
        'modelCapabilities',
        'HybridMind Model Capabilities',
        vscode.ViewColumn.One,
        { enableScripts: true }
      );

      panel.webview.html = getModelCapabilitiesHtml();
    })
  );

  // Command: Toggle Model Selection Mode
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.toggleModelMode', async () => {
      const modes = [
        {
          label: '$(robot) Auto Mode',
          description: 'System intelligently selects best models for each task',
          value: 'auto'
        },
        {
          label: '$(wrench) Manual Mode',
          description: 'You specify exact models to use for each role',
          value: 'manual'
        },
        {
          label: '$(list-tree) Template Mode',
          description: 'Use pre-configured chain templates',
          value: 'template'
        }
      ];

      const selected = await vscode.window.showQuickPick(modes, {
        placeHolder: 'Select model selection mode',
        title: 'HybridMind Model Selection'
      });

      if (selected) {
        const config = vscode.workspace.getConfiguration('hybridmind');
        await config.update('modelSelection.mode', selected.value, vscode.ConfigurationTarget.Global);
        
        vscode.window.showInformationMessage(`Model selection mode: ${selected.label}`);

        // If manual mode, prompt to configure
        if (selected.value === 'manual') {
          const configure = await vscode.window.showInformationMessage(
            'Would you like to configure your custom model chain now?',
            'Configure', 'Later'
          );
          if (configure === 'Configure') {
            vscode.commands.executeCommand('hybridmind.configureCustomChain');
          }
        }

        // If template mode, prompt to select template
        if (selected.value === 'template') {
          const configure = await vscode.window.showInformationMessage(
            'Would you like to select a chain template now?',
            'Select', 'Later'
          );
          if (configure === 'Select') {
            vscode.commands.executeCommand('hybridmind.selectChainTemplate');
          }
        }
      }
    })
  );

  // Note: Budget priority removed - cost control is handled server-side via profit margin protection
  // Users don't control API costs since we use centralized API keys
}

async function getAvailableModels(serverPort: number): Promise<Array<{label: string, description: string, value: string}>> {
  try {
    const response = await fetch(`http://localhost:${serverPort}/models`);
    const data = await response.json() as any;
    const models = data.data?.models || [];

    return models.map((model: any) => ({
      label: model.name || model.id,
      description: model.provider || '',
      value: model.id
    }));
  } catch (error) {
    vscode.window.showErrorMessage('Failed to fetch models from backend');
    return [];
  }
}

function getModelCapabilitiesHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 20px;
    }
    h1 { color: #0b6a76; margin-bottom: 20px; }
    h2 { color: #0b6a76; margin-top: 30px; margin-bottom: 15px; }
    .model-card {
      background: var(--vscode-sideBar-background);
      border-left: 3px solid #0b6a76;
      padding: 15px;
      margin-bottom: 15px;
      border-radius: 4px;
    }
    .model-name {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .capability-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin: 10px 0;
    }
    .capability {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
    }
    .rating {
      background: #0b6a76;
      color: white;
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: bold;
    }
    .strengths, .weaknesses {
      margin-top: 10px;
      font-size: 12px;
    }
    .strengths strong, .weaknesses strong {
      color: #0b6a76;
    }
  </style>
</head>
<body>
  <h1>🤖 HybridMind Model Capabilities</h1>
  
  <h2>Premium Models</h2>
  
  <div class="model-card">
    <div class="model-name">OpenAI o1 - Reasoning Master</div>
    <div class="capability-grid">
      <div class="capability"><span>Reasoning</span><span class="rating">10/10</span></div>
      <div class="capability"><span>Planning</span><span class="rating">10/10</span></div>
      <div class="capability"><span>Code Generation</span><span class="rating">7/10</span></div>
      <div class="capability"><span>Speed</span><span class="rating">3/10</span></div>
      <div class="capability"><span>Cost Efficiency</span><span class="rating">2/10</span></div>
    </div>
    <div class="strengths"><strong>Strengths:</strong> Deep reasoning, Strategic planning, Edge case identification</div>
    <div class="weaknesses"><strong>Weaknesses:</strong> Slower, Higher cost, Overkill for simple tasks</div>
  </div>

  <div class="model-card">
    <div class="model-name">DeepSeek Qwen 480B Coder - Coding Specialist</div>
    <div class="capability-grid">
      <div class="capability"><span>Code Generation</span><span class="rating">10/10</span></div>
      <div class="capability"><span>Reasoning</span><span class="rating">7/10</span></div>
      <div class="capability"><span>Speed</span><span class="rating">8/10</span></div>
      <div class="capability"><span>Cost Efficiency</span><span class="rating">9/10</span></div>
    </div>
    <div class="strengths"><strong>Strengths:</strong> Best-in-class code generation, Very fast coding, Cost effective</div>
    <div class="weaknesses"><strong>Weaknesses:</strong> Weaker reasoning, Not great for planning</div>
  </div>

  <div class="model-card">
    <div class="model-name">Claude Opus - Review Expert</div>
    <div class="capability-grid">
      <div class="capability"><span>Code Review</span><span class="rating">10/10</span></div>
      <div class="capability"><span>Documentation</span><span class="rating">10/10</span></div>
      <div class="capability"><span>Reasoning</span><span class="rating">9/10</span></div>
      <div class="capability"><span>Speed</span><span class="rating">5/10</span></div>
      <div class="capability"><span>Cost Efficiency</span><span class="rating">3/10</span></div>
    </div>
    <div class="strengths"><strong>Strengths:</strong> Exceptional quality, Thorough reviews, Great documentation</div>
    <div class="weaknesses"><strong>Weaknesses:</strong> Expensive, Slower responses</div>
  </div>

  <h2>Recommended Chains</h2>
  
  <div class="model-card">
    <div class="model-name">🚀 Coding Standard (Recommended)</div>
    <p><strong>Chain:</strong> Claude Sonnet → Qwen 480B → Claude Sonnet</p>
    <p><strong>Cost:</strong> Medium | <strong>Speed:</strong> Fast</p>
    <p>Balanced quality and cost for everyday coding tasks.</p>
  </div>

  <div class="model-card">
    <div class="model-name">⭐ Coding Premium (Best Quality)</div>
    <p><strong>Chain:</strong> o1 → Claude Sonnet → Claude Opus → Gemini</p>
    <p><strong>Cost:</strong> High | <strong>Speed:</strong> Slow</p>
    <p>Maximum quality for critical features and complex problems.</p>
  </div>

  <div class="model-card">
    <div class="model-name">⚡ Coding Budget (Cost Optimized)</div>
    <p><strong>Chain:</strong> Llama 70B → Qwen 480B → Llama 70B</p>
    <p><strong>Cost:</strong> Low | <strong>Speed:</strong> Ultra-fast</p>
    <p>Cost-effective solution for simple tasks and prototypes.</p>
  </div>
</body>
</html>`;
}

export { getAvailableModels };
