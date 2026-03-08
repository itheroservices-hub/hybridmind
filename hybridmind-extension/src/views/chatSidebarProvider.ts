/**
 * HybridMind v1.1 - Sidebar Chat Provider
 * GitHub Copilot-style persistent chat sidebar
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { LicenseManager } from '../auth/licenseManager';
import { WorkspaceAnalyzer } from '../agents/workspaceAnalyzer';
import { AutonomyManager, AutonomyLevel, ToolPermissions } from '../agents/autonomyManager';
import { AgentPlanner, ExecutionResult, NextStep } from '../agents/agentPlanner';
import { getDesignSystemCSS } from '../design/designSystem';
import { UIComponents } from '../design/uiComponents';

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
  private _workflowMode: 'single' | 'parallel' | 'chain' | 'agentic' | 'all-to-all' = 'single';
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
  private _lastPlan: any = null; // Store last plan for confirmation
  private _activeRalphStreamId: string | null = null;
  private _activeRalphChainId: string | null = null;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    serverPort: number
  ) {
    this._serverPort = serverPort;
    this._licenseManager = LicenseManager.getInstance();
    
    // Initialize autonomous agent system
    this._autonomyManager = new AutonomyManager(AutonomyLevel.Advisory, {
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
          vscode.env.openExternal(vscode.Uri.parse('https://hybridmind.ca'));
          break;
        case 'executeNextStep':
          await this._handleNextStep(data.stepId, data.models);
          break;
        case 'viewDiff':
          await this._viewFileDiff(data.filePath);
          break;
        case 'acceptChanges':
          this._acceptAllChanges();
          break;
        case 'rejectChanges':
          await this._rejectAllChanges();
          break;
        case 'killRalphLoop':
          await this._killRalphLoop();
          break;
        case 'openByok':
          // Toggle inline BYOK panel in the webview
          this._view?.webview.postMessage({ type: 'toggleByokPanel' });
          break;
        case 'saveApiKey':
          await this._handleSaveApiKey(data.provider, data.key);
          break;
        case 'verifyApiKey':
          await this._handleVerifyApiKey(data.provider, data.key);
          break;
        case 'openAgentPicker':
          await this._handleAddAgent();
          break;
        case 'removeAgent':
          // Agent chip removal is handled entirely in the webview
          break;
      }
    });
  }

  /** Show a QuickPick of the agent catalog and post the selection back into the webview. */
  private async _handleAddAgent() {
    const catalog = [
      { label: '🐛 Bug Hunter',       id: 'bug-hunter',            description: 'Finds & explains bugs in your code' },
      { label: '💻 Code Generator',   id: 'code-generator',        description: 'Writes complete, production-ready code' },
      { label: '🔧 Refactoring',      id: 'refactoring',           description: 'Cleans up and restructures existing code' },
      { label: '🗺 Strategic Planner', id: 'strategic-planner',     description: 'Breaks complex tasks into step-by-step plans' },
      { label: '🔬 Research Agent',   id: 'research-synthesizer',  description: 'Researches and synthesises technical answers' },
      { label: '⚖️ Evaluator',        id: 'critical-evaluator',    description: 'Critically reviews plans and code for flaws' },
      { label: '🧠 Memory Curator',   id: 'memory-curator',        description: 'Tracks context across long conversations' },
      { label: '✅ Logic Verifier',   id: 'logic-verifier',        description: 'Verifies correctness of logic and algorithms' },
      { label: '🎭 Scenario Sim',     id: 'scenario-simulation',   description: 'Simulates edge cases and what-if scenarios' },
      { label: '🔒 Constraints',      id: 'constraint-solver',     description: 'Identifies and resolves constraints in a design' },
      { label: '📋 Documenter',       id: 'documenter',            description: 'Writes clear docs, README files, and comments' },
      { label: '🔐 Security Auditor', id: 'security-auditor',      description: 'Checks code for security vulnerabilities' },
      { label: '⚡ Performance Guru', id: 'perf-optimizer',        description: 'Finds and fixes performance bottlenecks' },
      { label: '🧪 Test Writer',      id: 'test-writer',           description: 'Generates comprehensive unit and integration tests' },
    ];

    const picked = await vscode.window.showQuickPick(catalog, {
      placeHolder: 'Select an agent to add to your session',
      title: 'HybridMind — Add Agent'
    });

    if (picked) {
      this._view?.webview.postMessage({
        type: 'agentAdded',
        id: picked.id,
        label: picked.label
      });
    }
  }

  /** Save a BYOK API key from the inline panel. */
  private async _handleSaveApiKey(provider: string, key: string) {
    if (!provider || !key) {
      this._view?.webview.postMessage({ type: 'byokStatus', status: 'error', message: 'Provider and key are required.' });
      return;
    }
    await this._licenseManager.setUserApiKey(provider, key);
    this._view?.webview.postMessage({ type: 'byokStatus', status: 'saved', message: `✅ ${provider} API key saved. Requests will route through your key.` });
  }

  /** Verify a BYOK API key by making a test call. */
  private async _handleVerifyApiKey(provider: string, key: string) {
    if (!provider || !key) {
      this._view?.webview.postMessage({ type: 'byokStatus', status: 'error', message: 'Enter provider and key first.' });
      return;
    }
    this._view?.webview.postMessage({ type: 'byokStatus', status: 'verifying', message: '⏳ Verifying key…' });
    try {
      const response = await fetch('http://localhost:3000/run/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Api-Provider': provider, 'X-User-Api-Key': key },
        body: JSON.stringify({ model: 'llama-3.3-70b', prompt: 'Reply with only the word OK', maxTokens: 5 })
      });
      if (response.ok) {
        this._view?.webview.postMessage({ type: 'byokStatus', status: 'verified', message: `✅ Key verified! ${provider} is working correctly.` });
      } else {
        const err = await response.text();
        this._view?.webview.postMessage({ type: 'byokStatus', status: 'error', message: `❌ Verification failed (${response.status}): ${err.substring(0, 120)}` });
      }
    } catch (e: any) {
      this._view?.webview.postMessage({ type: 'byokStatus', status: 'error', message: `❌ Could not reach backend: ${e.message}` });
    }
  }

  private async _handleSendMessage(userMessage: string, models?: string[], workflow?: string, includeContext?: boolean, isDirectExecution?: boolean) {
    const selectedModels = models || this._selectedModels;
    let workflowMode = workflow || this._workflowMode;
    const isDraftCommand = /(^|\s)draft\s+(init|new-track|new\s+track|status)\b/i.test(userMessage);

    if (isDraftCommand && workflowMode !== 'agentic') {
      workflowMode = 'agentic';
      vscode.window.showInformationMessage('Draft command detected: switched workflow to Agentic mode for command execution.');
    }
    
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
      let contextFile = '';
      
      if (includeContext && editor && editor.selection) {
        contextCode = editor.document.getText(editor.selection);
        contextFile = editor.document.fileName;
        
        // If no selection, note that whole file is available
        if (!contextCode || contextCode.trim() === '') {
          contextCode = ''; // Don't include whole file - agent will read it
        }
        
        // For agentic mode: Don't bloat prompt - pass file path for agent to read
        // For non-agentic mode: Include small code snippets only
        if (workflowMode === 'agentic') {
          // Agentic mode: Just mention the file, agent will read it
          if (contextCode) {
            userMessage = `${userMessage}\n\n[Context: ${contextCode.length} characters selected in ${path.basename(contextFile)}]`;
          } else {
            userMessage = `${userMessage}\n\n[Context: File ${path.basename(contextFile)}]`;
          }
        } else {
          // Non-agentic mode: Include code for simple Q&A (limit to 2000 chars)
          if (contextCode && contextCode.length <= 2000) {
            userMessage = `${userMessage}\n\nSelected code:\n\`\`\`\n${contextCode}\n\`\`\``;
          } else if (contextCode) {
            userMessage = `${userMessage}\n\n[Context: ${contextCode.length} characters selected - too large to include, please ask specific questions]`;
          }
        }
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
        await this._handleAutonomousExecution(userMessage, selectedModels, contextFile, contextCode);
        return;
      }

      // Choose the appropriate endpoint based on workflow
      let endpoint = '';
      const wantsRalphLoop = workflowMode === 'chain'
        ? !/\b(no\s+ralph|disable\s+ralph|no\s+self[-\s]?heal)\b/i.test(userMessage)
        : /\bralph\b|self[-\s]?heal/i.test(userMessage);

      if (workflowMode === 'chain' && wantsRalphLoop) {
        await this._streamRalphTelemetry({
          selectedModels,
          userMessage,
          contextCode,
          contextFile
        });
        return;
      }

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
          options: {
            readOnly: this._readOnly,
            ralphLoop: wantsRalphLoop,
            testCommand: 'npm test'
          }
        };
      } else if (workflowMode === 'all-to-all') {
        endpoint = '/run/all-to-all';
        requestBody = {
          models: selectedModels,
          prompt: userMessage,
          code: contextCode,
          options: { 
            readOnly: this._readOnly,
            iterations: 2 // Number of communication rounds
          }
        };
      } else {
        // Single model mode — send full conversation history as messages array
        endpoint = '/run/single';
        const historyMessages = this._messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .slice(-20)
          .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
        // Append current user message
        historyMessages.push({ role: 'user', content: userMessage });
        requestBody = {
          model: selectedModels[0],
          prompt: userMessage,  // kept for backward compat with other call sites
          messages: historyMessages
        };
      }

      // Call backend API - always use port 3000 (OpenRouter backend)
      const backendPort = 3000;
      console.log(`[HybridMind] Calling ${endpoint} on port ${backendPort} (mode: ${workflowMode})`);
      const response = await fetch(`http://localhost:${backendPort}${endpoint}`, {
        method: 'POST',
        headers: this._licenseManager.getApiHeaders(),
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

        const ralphTelemetry = responseData.ralphTelemetry;
        if (Array.isArray(ralphTelemetry) && ralphTelemetry.length > 0) {
          const telemetryLines = ralphTelemetry
            .map((entry: any, index: number) => {
              const status = entry?.status || 'yellow';
              const dot = status === 'green' ? '🟢' : status === 'red' ? '🔴' : '🟡';
              const attempt = entry?.attempt || (index + 1);
              const message = entry?.message || 'No telemetry message';
              return `${dot} Attempt ${attempt}: ${message}`;
            })
            .join('\n\n');

          const telemetryMsg: ChatMessage = {
            role: 'assistant',
            content: `**🧠 Ralph Live Thought Stream**\n\n${telemetryLines}`,
            model: 'Ralph',
            timestamp: new Date()
          };
          this._messages.push(telemetryMsg);
        }
      } else if (workflowMode === 'all-to-all' && responseData.mode === 'all-to-all') {
        // Show all-to-all mesh collaboration results
        const synthesis = responseData.synthesis || {};
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: `${responseData.output || 'No output'}

**All-to-All Mesh Collaboration:**
- ${synthesis.modelsContributed || 0} models collaborated
- ${synthesis.totalInteractions || 0} total interactions
- ${synthesis.communicationRounds || 0} communication rounds

Models evolved their solutions ${synthesis.communicationRounds || 0} times, each learning from the others.`,
          model: 'all-to-all-mesh',
          timestamp: new Date(),
          tokens: responseData.usage?.total_tokens,
          cost: responseData.cost
        };
        this._messages.push(assistantMsg);
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
      // Use AI to analyze the error and suggest fixes
      const context = `User message: unknown\nWorkflow mode: unknown`;
      const suggestion = await this._analyzeError(error, context);
      
      vscode.window.showErrorMessage(`HybridMind Error: ${suggestion}`);
      
      // Add AI-analyzed error message to chat
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `❌ Error Analysis:\n\n**Problem:** ${error.message}\n\n**Suggestion:** ${suggestion}`,
        timestamp: new Date()
      };
      this._messages.push(errorMsg);
      this._updateWebview();
    }
  }

  /**
   * Use AI to detect user intent (confirm, cancel, adjust, or new request)
   */
  private async _detectIntent(userMessage: string): Promise<'confirm' | 'cancel' | 'adjust' | 'new_request'> {
    const msgLower = userMessage.toLowerCase().trim();

    try {
      // Get last few messages for context
      const recentContext = this._messages
        .slice(-4)
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.substring(0, 200)}`)
        .join('\n');
      
      // Call backend with fast model for intent classification
      const response = await fetch(`http://localhost:3000/run/single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile', // Fast, free model
          prompt: `You are classifying user intent in a coding-agent confirmation flow.

Recent conversation:
${recentContext}

The agent just showed an execution plan and is waiting for confirmation.

User's latest message: "${userMessage}"

Valid intents:
- confirm: user approves execution of current stored plan
- cancel: user rejects current stored plan
- adjust: user wants to modify/refine current stored plan
- new_request: user asks for a different task

Respond ONLY with strict JSON:
{"intent":"confirm|cancel|adjust|new_request","confidence":0-1,"reason":"short"}`,
          maxTokens: 60
        })
      });

      if (!response.ok) {
        const fallback = this._fallbackIntent(userMessage);
        console.log(`[Intent Detection] Backend status ${response.status}, fallback intent: ${fallback}`);
        return fallback;
      }

      const data = await response.json();
      const output = (data as any).data?.output || (data as any).output || '';
      const modelIntent = this._extractIntentFromModelOutput(output);
      
      // Debug log
      console.log(`[Intent Detection] User: "${userMessage}" → Raw output: "${output}" → Intent: "${modelIntent}"`);

      if (modelIntent) {
        return modelIntent;
      }

      const fallback = this._fallbackIntent(userMessage);
      console.log(`[Intent Detection] Unparseable model output, fallback intent: ${fallback}`);
      return fallback;
    } catch (error) {
      const fallback = this._fallbackIntent(userMessage);
      console.log(`[Intent Detection] Error: ${error}, fallback intent: ${fallback}`);
      return fallback;
    }
  }

  private _extractIntentFromModelOutput(output: string): 'confirm' | 'cancel' | 'adjust' | 'new_request' | null {
    const normalized = String(output || '').trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (['confirm', 'cancel', 'adjust', 'new_request'].includes(normalized)) {
      return normalized as any;
    }

    try {
      const jsonMatch = normalized.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const intent = String(parsed.intent || '').toLowerCase();
        if (['confirm', 'cancel', 'adjust', 'new_request'].includes(intent)) {
          return intent as any;
        }
      }
    } catch {
      // Ignore JSON parse issues and continue with token extraction.
    }

    const tokenMatch = normalized.match(/\b(confirm|cancel|adjust|new_request)\b/);
    return tokenMatch ? tokenMatch[1] as any : null;
  }

  private _fallbackIntent(userMessage: string): 'confirm' | 'cancel' | 'adjust' | 'new_request' {
    const normalized = userMessage.toLowerCase().trim().replace(/[^a-z0-9\s']/g, ' ');
    const tokens = normalized.split(/\s+/).filter(Boolean);

    const hasAny = (terms: string[]) => terms.some(term => normalized.includes(term));

    const confirmTerms = [
      'ok', 'okay', 'sure', 'yes', 'yep', 'yeah', 'affirmative', 'approved', 'approve',
      'proceed', 'continue', 'execute', 'run', 'ship it', 'go ahead', 'go for it',
      'sounds good', 'looks good', 'perfect', 'do it', 'lets do it', "let's do it"
    ];
    const cancelTerms = ['cancel', 'stop', 'abort', 'nevermind', 'never mind', "don't", 'do not', 'skip it', 'no thanks'];
    const adjustTerms = ['adjust', 'modify', 'change', 'tweak', 'revise', 'update plan', 'different approach', 'instead'];

    if (hasAny(cancelTerms)) {
      return 'cancel';
    }
    if (hasAny(adjustTerms)) {
      return 'adjust';
    }

    const shortAffirmation = tokens.length <= 4 && hasAny(confirmTerms);
    if (shortAffirmation || hasAny(confirmTerms)) {
      return 'confirm';
    }

    return 'new_request';
  }

  /**
   * Use AI to detect execution constraints from natural language
   * Understands: "be gentle", "don't mess up", "you can look but don't touch", typos, etc.
   */
  private async _detectConstraints(message: string): Promise<{
    readOnly?: boolean;
    noDelete?: boolean;
    noCreate?: boolean;
    noTerminal?: boolean;
  }> {
    try {
      const response = await fetch('http://localhost:3000/run/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'groq/llama-3.3-70b-versatile',
          prompt: `Analyze this user message for execution constraints:

"${message}"

Identify if the user wants any of these constraints:
- READ_ONLY: Just analyze/review, don't change anything ("just look", "be gentle", "don't mess up", "view only")
- NO_DELETE: Don't delete files ("keep existing", "preserve files", "don't remove")
- NO_CREATE: Don't create new files ("only modify existing", "no new files")
- NO_TERMINAL: Don't run commands ("no terminal", "don't execute")

Respond with ONLY a JSON object like: {"readOnly": true, "noDelete": false, "noCreate": false, "noTerminal": false}
If no constraints are mentioned, all values should be false.`,
          maxTokens: 50
        })
      });

      const data = await response.json();
      const output = (data as any).data?.output || (data as any).output || '{}';
      const result = output.trim();
      
      // Parse JSON response
      try {
        const constraints = JSON.parse(result || '{}');
        return {
          readOnly: constraints.readOnly || constraints.READ_ONLY || false,
          noDelete: constraints.noDelete || constraints.NO_DELETE || false,
          noCreate: constraints.noCreate || constraints.NO_CREATE || false,
          noTerminal: constraints.noTerminal || constraints.NO_TERMINAL || false
        };
      } catch {
        return {}; // Invalid JSON, no constraints
      }
    } catch (error) {
      // Fallback to basic keyword matching
      const msgLower = message.toLowerCase();
      return {
        readOnly: /\b(just|only)\s+(review|look|analyze)|read.?only|don't\s+change|no\s+changes/i.test(message),
        noDelete: /don't\s+delete|no\s+delet/i.test(message),
        noCreate: /don't\s+create|no\s+(new\s+)?files/i.test(message),
        noTerminal: /don't\s+run|no\s+terminal|no\s+commands/i.test(message)
      };
    }
  }

  /**
   * Assess security risk of an operation using AI
   */
  private async _assessSecurityRisk(operation: string, filesAffected: string[]): Promise<'low' | 'medium' | 'high' | 'critical'> {
    try {
      const response = await fetch('http://localhost:3000/run/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'groq/llama-3.3-70b-versatile',
          prompt: `Assess the security risk of this operation:

Operation: ${operation}
Files affected: ${filesAffected.join(', ')}

Risk levels:
- LOW: Read-only operations, safe file edits
- MEDIUM: Creating files, modifying configs, installing known packages
- HIGH: Deleting files, modifying system files, running terminal commands
- CRITICAL: Deleting multiple files, rm -rf, system-wide changes, unknown packages

Respond with ONLY one word: low, medium, high, or critical`,
          maxTokens: 5
        })
      });

      const data = await response.json();
      const output = (data as any).data?.output || (data as any).output || 'medium';
      const risk = output.trim().toLowerCase();
      
      if (['low', 'medium', 'high', 'critical'].includes(risk)) {
        return risk as any;
      }
      return 'medium'; // Default
    } catch (error) {
      // Fallback: assess based on keywords
      const opLower = operation.toLowerCase();
      if (/delete|remove|rm\s+-rf|uninstall/i.test(operation)) return 'high';
      if (/create|install|modify|update/i.test(operation)) return 'medium';
      return 'low';
    }
  }

  /**
   * Analyze errors using AI to understand root cause and suggest fixes
   */
  private async _analyzeError(error: Error, context: string): Promise<string> {
    try {
      const response = await fetch('http://localhost:3000/run/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'groq/llama-3.3-70b-versatile',
          prompt: `Analyze this error and suggest a fix:

Error: ${error.message}
Stack: ${error.stack?.slice(0, 200)}
Context: ${context}

Provide a clear, actionable suggestion in 1-2 sentences. Be specific about what to do next.`,
          maxTokens: 100
        })
      });

      const data = await response.json();
      const output = (data as any).data?.output || (data as any).output || error.message;
      return output.trim();
    } catch {
      return error.message;
    }
  }

  /**
   * Assess task complexity to determine if confirmation is needed
   */
  private async _assessTaskComplexity(task: string): Promise<'simple' | 'moderate' | 'complex'> {
    try {
      const response = await fetch('http://localhost:3000/run/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'groq/llama-3.3-70b-versatile',
          prompt: `Assess the complexity of this coding task:

"${task}"

Complexity levels:
- SIMPLE: Single file changes, adding a button, reviewing code, simple bug fixes
- MODERATE: Multi-file changes, refactoring a module, adding a feature
- COMPLEX: Architecture changes, refactoring entire systems, database migrations

Respond with ONLY one word: simple, moderate, or complex`,
          maxTokens: 5
        })
      });

      const data = await response.json();
      const output = (data as any).data?.output || (data as any).output || 'moderate';
      const complexity = output.trim().toLowerCase();
      
      if (['simple', 'moderate', 'complex'].includes(complexity)) {
        return complexity as any;
      }
      return 'moderate'; // Default
    } catch (error) {
      // Fallback: assess based on keywords
      if (/review|analyze|check|look|read/i.test(task)) return 'simple';
      if (/refactor|migrate|architecture|system|entire/i.test(task)) return 'complex';
      return 'moderate';
    }
  }

  /**
   * Detect if user request is ambiguous and needs clarification
   */
  private async _detectAmbiguity(message: string): Promise<{ isAmbiguous: boolean; clarification?: string }> {
    // Only flag truly empty or single-word messages — let the agent handle everything else.
    const words = message.trim().split(/\s+/);
    if (words.length <= 1 && message.trim().length < 3) {
      return { isAmbiguous: true, clarification: 'What would you like me to do?' };
    }
    return { isAmbiguous: false };
  }

  /**
   * Handle autonomous agent execution with file discovery and planning
   */
  private async _handleAutonomousExecution(
    userMessage: string, 
    models: string[], 
    contextFile: string = '', 
    contextCode: string = ''
  ) {
    try {
      console.log(`[Autonomous] User message received: "${userMessage}"`);
      console.log(`[Autonomous] _lastPlan exists: ${!!this._lastPlan}`);
      
      // Use AI to detect intent if we have a stored plan
      if (this._lastPlan) {
        console.log(`[Autonomous] Stored plan exists, detecting intent for: "${userMessage}"`);
        const intent = await this._detectIntent(userMessage);
        console.log(`[Autonomous] Detected intent: ${intent}`);
        
        if (intent === 'cancel') {
          this._lastPlan = null;
          const cancelMsg: ChatMessage = {
            role: 'system',
            content: '❌ Plan cancelled. How can I help you?',
            timestamp: new Date()
          };
          this._messages.push(cancelMsg);
          this._updateWebview();
          return;
        }
        
        if (intent === 'adjust') {
          const adjustMsg: ChatMessage = {
            role: 'assistant',
            content: '📝 What would you like to adjust in the plan? Please describe the changes you want.',
            timestamp: new Date()
          };
          this._messages.push(adjustMsg);
          this._updateWebview();
          return;
        }
        
        if (intent === 'confirm') {
          // Use AI to detect constraints from message (e.g., "ok, but just review")
          const constraints = await this._detectConstraints(userMessage);
          
          // Show constraint acknowledgment if any
          if (constraints.readOnly || constraints.noDelete || constraints.noCreate || constraints.noTerminal) {
            const constraintParts = [];
            if (constraints.readOnly) constraintParts.push('read-only mode');
            if (constraints.noDelete) constraintParts.push('no deletions');
            if (constraints.noCreate) constraintParts.push('no file creation');
            if (constraints.noTerminal) constraintParts.push('no terminal commands');
            
            const constraintMsg: ChatMessage = {
              role: 'system',
              content: `🔒 Executing with constraints: ${constraintParts.join(', ')}`,
              timestamp: new Date()
            };
            this._messages.push(constraintMsg);
          }
          
          // STEP 3: Assess security risk before execution
          const filesAffected = this._lastPlan.steps.map((s: any) => s.file || 'unknown');
          const risk = await this._assessSecurityRisk(this._lastPlan.goal, filesAffected);
          
          // Show risk level and ask for confirmation on high/critical risk
          if (risk === 'high' || risk === 'critical') {
            const riskMsg: ChatMessage = {
              role: 'system',
              content: `⚠️ ${risk.toUpperCase()} RISK OPERATION detected!\n\nThis operation could potentially cause significant changes. Type "confirm ${risk}" to proceed.`,
              timestamp: new Date()
            };
            this._messages.push(riskMsg);
            this._updateWebview();
            
            // Check if user explicitly confirmed the risk
            if (!userMessage.toLowerCase().includes(`confirm ${risk}`)) {
              this._lastPlan = null; // Cancel plan
              return;
            }
          }
          
          // Execute the stored plan with constraints
          const executingMsg: ChatMessage = {
            role: 'system',
            content: constraints.readOnly ? '👁️ Reviewing previous plan (read-only)...' : `⚙️ Executing previous plan (${risk} risk)...`,
            timestamp: new Date()
          };
          this._messages.push(executingMsg);
          this._updateWebview();

          const result = await this._agentPlanner.executePlan(this._lastPlan, (step, status) => {
            const progressMsg: ChatMessage = {
              role: 'system',
              content: `${status === 'completed' ? '✅' : status === 'failed' ? '❌' : '🔄'} Step ${step.id}: ${step.description}`,
              timestamp: new Date()
            };
            this._messages.push(progressMsg);
            this._updateWebview();
          }, constraints);

          this._currentExecution = result;
          this._lastPlan = null; // Clear stored plan

          const summaryMsg: ChatMessage = {
            role: 'assistant',
            content: result.summary,
            model: 'Agent Summary',
            timestamp: new Date()
          };
          this._messages.push(summaryMsg);
          this._updateWebview();
          return;
        }
        
        // If intent is 'new_request', fall through to create new plan
      }

      // STEP 1: Check for ambiguity - ask for clarification if needed
      const ambiguityCheck = await this._detectAmbiguity(userMessage);
      if (ambiguityCheck.isAmbiguous) {
        const clarificationMsg: ChatMessage = {
          role: 'assistant',
          content: `❓ ${ambiguityCheck.clarification || 'Could you be more specific about what you want to do?'}`,
          timestamp: new Date()
        };
        this._messages.push(clarificationMsg);
        this._updateWebview();
        return;
      }

      // STEP 2: Assess task complexity - determines if we need confirmation
      const complexity = await this._assessTaskComplexity(userMessage);
      const needsConfirmation = complexity === 'complex'; // Complex tasks always need confirmation

      // Show planning message
      const planningMsg: ChatMessage = {
        role: 'system',
        content: `🧠 Analyzing request and creating execution plan... (${complexity} task)`,
        timestamp: new Date()
      };
      this._messages.push(planningMsg);
      this._updateWebview();

      // Update autonomy manager based on current settings
      const autonomyLevel = this._autonomyLevel === 3 ? AutonomyLevel.FullAuto :
                           this._autonomyLevel === 2 ? AutonomyLevel.Assisted :
                           AutonomyLevel.Advisory;
      
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

      // Pass file context separately so agent can read it
      const fileContext = contextFile ? {
        filePath: contextFile,
        hasSelection: contextCode.length > 0,
        selectionLength: contextCode.length
      } : undefined;

      // STEP 4: Create execution plan with complexity and risk metadata
      const plan = await this._agentPlanner.createPlan(userMessage, recentMessages, fileContext, complexity, undefined);
      
      if (!plan) {
        const errorMsg: ChatMessage = {
          role: 'assistant',
          content: `I encountered an error analyzing your request. Please try again.\n\nIf this persists, try:\n- Reloading VS Code window\n- Checking Developer Console (Help > Toggle Developer Tools) for errors\n- Verifying your API keys are configured`,
          timestamp: new Date()
        };
        this._messages.push(errorMsg);
        this._updateWebview();
        return;
      }
      
      // Check if plan contains error
      if (plan.goal === 'Error') {
        const errorMsg: ChatMessage = {
          role: 'assistant',
          content: `## ❌ Error\n\n${plan.analysis}\n\n${plan.reasoning}`,
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

      // STEP 5: Assess security risk after creating the plan
      const filesAffected = plan.steps.map((s: any) => s.file || 'unknown');
      const riskLevel = await this._assessSecurityRisk(plan.goal, filesAffected);
      
      // Store risk in plan metadata
      plan.metadata = { complexity, riskLevel };
      
      // Show risk indicator in plan message
      const riskEmoji = riskLevel === 'critical' ? '🔴' : riskLevel === 'high' ? '🟠' : riskLevel === 'medium' ? '🟡' : '🟢';
      const confirmationText = (riskLevel === 'high' || riskLevel === 'critical') 
        ? `\n\n⚠️ **${riskLevel.toUpperCase()} RISK OPERATION** - Type "confirm ${riskLevel}" to proceed.`
        : `\n\n💬 *Reply "ok" to execute this plan, or provide feedback to adjust it.*`;

      // Show the plan with steps
      const planMsg: ChatMessage = {
        role: 'assistant',
        content: `## 📋 Execution Plan\n\n**Goal:** ${plan.goal}\n\n**Analysis:** ${plan.analysis}\n\n**Steps:**\n${plan.steps.map((s: any) => `${s.id}. ${s.description} (${s.type})`).join('\n')}\n\n**Reasoning:** ${plan.reasoning}\n\n**Complexity:** ${complexity} | **Risk:** ${riskEmoji} ${riskLevel}\n**Autonomy Level:** ${this._autonomyManager.getLevelDescription()}${confirmationText}`,
        model: 'Agent Planner',
        timestamp: new Date()
      };
      this._messages.push(planMsg);
      this._updateWebview();

      // Store the plan for confirmation
      this._lastPlan = plan;
      console.log(`[Autonomous] Plan stored! Goal: "${plan.goal}", Steps: ${plan.steps.length}`);

      // Don't auto-execute - wait for user confirmation (especially for high/critical risk)
      return;
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
    await this._handleAutonomousExecution(nextStepMessage, models || this._selectedModels, '', '');
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

  private async _streamRalphTelemetry(params: {
    selectedModels: string[];
    userMessage: string;
    contextCode: string;
    contextFile: string;
  }) {
    const backendPort = 3000;
    const payload = {
      models: params.selectedModels,
      prompt: params.userMessage,
      code: params.contextCode,
      options: {
        ralphLoop: true,
        workspacePath: params.contextFile ? path.dirname(params.contextFile) : undefined,
        targetFile: params.contextFile || undefined,
        testCommand: 'npm test'
      }
    };

    this._view?.webview.postMessage({ type: 'telemetryClear' });
    this._view?.webview.postMessage({ type: 'telemetryState', active: true, title: 'Ralph loop started…' });

    const response = await fetch(`http://localhost:${backendPort}/run/chain/stream`, {
      method: 'POST',
      headers: this._licenseManager.getApiHeaders(),
      body: JSON.stringify(payload)
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      throw new Error(`SSE stream failed (${response.status}): ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const processEvent = (rawEvent: string) => {
      const lines = rawEvent.split('\n').map(line => line.trim()).filter(Boolean);
      if (!lines.length) return;

      let eventName = 'message';
      let dataText = '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim();
        }
        if (line.startsWith('data:')) {
          dataText += line.slice(5).trim();
        }
      }

      if (!dataText) return;

      let payload: any;
      try {
        payload = JSON.parse(dataText);
      } catch {
        payload = { raw: dataText };
      }

      if (eventName === 'connected') {
        this._activeRalphStreamId = payload.streamId;
        this._activeRalphChainId = payload.chainId;
        this._view?.webview.postMessage({
          type: 'telemetryState',
          active: true,
          title: `Ralph live stream (${payload.streamId})`
        });
        return;
      }

      if (eventName === 'telemetry') {
        this._view?.webview.postMessage({
          type: 'telemetryEvent',
          event: payload
        });
        return;
      }

      if (eventName === 'done') {
        const output = payload?.result?.output || 'Ralph loop completed.';
        const doneMsg: ChatMessage = {
          role: 'assistant',
          content: `**🧠 Ralph Loop Complete**\n\n${output}`,
          model: 'Ralph',
          timestamp: new Date()
        };
        this._messages.push(doneMsg);
        this._updateWebview();
        this._view?.webview.postMessage({ type: 'telemetryState', active: false, title: 'Ralph loop completed' });
        this._activeRalphStreamId = null;
        this._activeRalphChainId = null;
        return;
      }

      if (eventName === 'error') {
        const errorMsg: ChatMessage = {
          role: 'assistant',
          content: `❌ Ralph stream error: ${payload.error || 'Unknown error'}`,
          timestamp: new Date()
        };
        this._messages.push(errorMsg);
        this._updateWebview();
        this._view?.webview.postMessage({ type: 'telemetryState', active: false, title: 'Ralph loop stopped with error' });
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const eventChunk of events) {
        processEvent(eventChunk);
      }
    }

    this._view?.webview.postMessage({ type: 'telemetryState', active: false, title: 'Ralph stream closed' });
  }

  private async _killRalphLoop() {
    try {
      if (!this._activeRalphStreamId) {
        vscode.window.showInformationMessage('No active Ralph loop to kill.');
        return;
      }

      const backendPort = 3000;
      const response = await fetch(`http://localhost:${backendPort}/run/chain/kill/${encodeURIComponent(this._activeRalphStreamId)}`, {
        method: 'POST',
        headers: this._licenseManager.getApiHeaders()
      });

      const data = await response.json() as any;
      if (!response.ok || !data.success) {
        throw new Error(data.error || `Kill failed (${response.status})`);
      }

      const killedMsg: ChatMessage = {
        role: 'system',
        content: `🛑 Ralph kill switch activated. Cleaned ${data.cleanedApprovalTickets?.updated || 0} pending approval ticket(s).`,
        timestamp: new Date()
      };
      this._messages.push(killedMsg);
      this._updateWebview();
      this._view?.webview.postMessage({ type: 'telemetryState', active: false, title: 'Ralph loop killed by user' });

      this._activeRalphStreamId = null;
      this._activeRalphChainId = null;
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to kill Ralph loop: ${error.message}`);
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

  /** Called after license verification resolves to re-render the UI with the correct tier. */
  public refreshTier() {
    if (this._view) {
      this._view.webview.html = this._getHtmlForWebview(this._view.webview);
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
    
    // Render messages using UI components
    const messagesHtml = this._messages.length === 0 
      ? UIComponents.emptyState(isPro)
      : this._messages.map(msg => UIComponents.message(msg)).join('');
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HybridMind Chat</title>
  <style>
    ${getDesignSystemCSS()}
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
      background: linear-gradient(135deg, #0b6a76 0%, #084a54 100%);
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
      box-shadow: 0 2px 8px rgba(11, 106, 118, 0.35);
    }

    .upgrade-banner:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(11, 106, 118, 0.45);
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
      background: linear-gradient(90deg, rgba(11, 106, 118, 0.12) 0%, rgba(11, 106, 118, 0.04) 100%);
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      font-weight: 600;
      user-select: none;
      border-left: 2px solid #0b6a76;
    }
    
    .config-header:hover {
      background: linear-gradient(90deg, rgba(11, 106, 118, 0.2) 0%, rgba(11, 106, 118, 0.08) 100%);
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
      border: 1px solid rgba(11, 106, 118, 0.45);
      border-radius: 6px;
      font-size: 11px;
    }

    .compact-select:focus {
      outline: none;
      border-color: #0b6a76;
      box-shadow: 0 0 0 1px rgba(11, 106, 118, 0.35);
    }

    .toolbar-button {
      padding: 6px 10px;
      font-size: 11px;
      background: rgba(11, 106, 118, 0.1);
      color: var(--vscode-foreground);
      border: 1px solid rgba(11, 106, 118, 0.35);
      border-radius: 6px;
      cursor: pointer;
    }

    .toolbar-button:hover {
      background: rgba(11, 106, 118, 0.2);
      border-color: #0b6a76;
    }

    .button {
      background: #0b6a76;
      border-radius: 8px;
      font-weight: 600;
    }

    .button:hover {
      background: #0a5a65;
    }

    .suggestion {
      border-radius: 8px;
      border-left: 2px solid rgba(11, 106, 118, 0.5);
    }

    .suggestion:hover {
      border-left-color: #0b6a76;
    }

    /* === FULL-HEIGHT LAYOUT === */
    html, body { height: 100%; overflow: hidden; }
    body { display: flex; flex-direction: column; }
    .messages-container { flex: 1 1 0 !important; min-height: 0 !important; }

    /* === RATE TRACKER BAR === */
    .rate-tracker {
      display: flex; align-items: center; justify-content: space-between;
      padding: 4px 10px; font-size: 10px;
      background: rgba(11, 106, 118, 0.07);
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
    }
    .tracker-item { display: flex; align-items: center; gap: 5px; opacity: 0.85; }
    .rate-bar { width: 44px; height: 3px; background: var(--vscode-panel-border); border-radius: 2px; overflow: hidden; }
    .rate-bar-fill { height: 100%; background: #0b6a76; border-radius: 2px; transition: width 0.4s; }
    .rate-bar-fill.warn { background: #f59e0b; }
    .rate-bar-fill.crit { background: #ef4444; }
    .tracker-credits { font-weight: 600; color: #0b6a76; }

    /* === AGENTS INLINE SECTION === */
    .agent-chip {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 9px; font-size: 10px;
      background: rgba(11, 106, 118, 0.08);
      border: 1px solid rgba(11, 106, 118, 0.25);
      border-radius: 12px; cursor: pointer; transition: all 0.15s;
      white-space: nowrap;
    }
    .agent-chip:hover { background: rgba(11, 106, 118, 0.18); border-color: #0b6a76; }
    .agent-chip.active-agent { background: rgba(11, 106, 118, 0.28); border-color: #0b6a76; color: #0b6a76; font-weight: 600; }
    .chip-remove {
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 10px; line-height: 1; margin-left: 2px; padding: 0 1px;
      opacity: 0.5; transition: opacity 0.1s;
    }
    .chip-remove:hover { opacity: 1; color: var(--vscode-errorForeground); }
    .agent-chips-wrap { display: flex; flex-wrap: wrap; gap: 5px; padding: 6px 12px 4px; }
    .agents-actions { display: flex; gap: 6px; padding: 0 12px 8px; }
    .agents-actions button { font-size: 10px; padding: 3px 8px; border-radius: 5px;
      background: rgba(11, 106, 118, 0.1); border: 1px solid rgba(11, 106, 118, 0.3);
      color: var(--vscode-foreground); cursor: pointer;
    }
    .agents-actions button:hover { background: rgba(11, 106, 118, 0.2); }

    /* === CODEGPT-STYLE CHAT INPUT === */
    .chat-input-area {
      padding: 8px 10px 10px;
      background: var(--vscode-sideBar-background);
      border-top: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
    }
    .chat-input-box {
      display: flex; flex-direction: column;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 12px; overflow: hidden;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .chat-input-box:focus-within {
      border-color: #0b6a76;
      box-shadow: 0 0 0 1px rgba(11, 106, 118, 0.25);
    }
    .chat-input-box textarea#messageInput {
      width: 100%; padding: 10px 12px 6px;
      background: transparent; color: var(--vscode-input-foreground);
      border: none; outline: none; resize: none;
      font-family: var(--vscode-font-family); font-size: 13px; line-height: 1.5;
      min-height: 42px; max-height: 130px; box-sizing: border-box;
    }
    .chat-input-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: 5px 8px; border-top: 1px solid rgba(11, 106, 118, 0.15);
    }
    .chat-input-left { display: flex; align-items: center; gap: 5px; }
    .active-model-pill {
      display: flex; align-items: center; gap: 3px;
      font-size: 10px; padding: 2px 7px;
      background: rgba(11, 106, 118, 0.1);
      border: 1px solid rgba(11, 106, 118, 0.22);
      border-radius: 10px; max-width: 110px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .icon-btn {
      background: none; border: none; padding: 4px 5px; cursor: pointer;
      border-radius: 5px; opacity: 0.55; font-size: 13px; line-height: 1;
    }
    .icon-btn:hover { opacity: 1; background: rgba(11, 106, 118, 0.1); }
    .icon-btn.ib-active { opacity: 1; color: #0b6a76; }
    .send-btn {
      width: 32px; height: 32px; border-radius: 9px;
      background: #0b6a76; border: none; color: white;
      cursor: pointer; font-size: 16px;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s; flex-shrink: 0;
    }
    .send-btn:hover { background: #0a5a65; }
    .send-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  </style>
</head>
<body>
  <!-- Rate / Usage Tracker -->
  <div class="rate-tracker" id="rateTracker">
    <div class="tracker-item">
      <span>🔑</span>
      <span id="trackerCredits" class="tracker-credits">··· cr</span>
      <span style="opacity:0.5;">credits</span>
    </div>
    <div class="tracker-item">
      <span>📊</span>
      <span id="trackerReqs">0 / ${isPro ? '500' : '50'}</span>
      <div class="rate-bar"><div class="rate-bar-fill" id="reqBar" style="width:0%"></div></div>
    </div>
    <div class="tracker-item">
      <span id="trackerTier" style="font-size:9px; padding:1px 6px; border-radius:8px; background:${isPro ? 'rgba(59,130,246,0.2)' : 'rgba(16,185,129,0.2)'}; border:1px solid ${isPro ? 'rgba(59,130,246,0.4)' : 'rgba(16,185,129,0.4)'};">${isPro ? '💎 PRO' : '🆓 FREE'}</span>
    </div>
  </div>

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
            <option value="claude-3.5-sonnet">Claude 3.5 Sonnet ✱</option>
          </optgroup>
          <optgroup label="🧠 Reasoning">
            <option value="o3-mini">OpenAI o3-mini</option>
            <option value="o1">OpenAI o1 (ULTRA)</option>
          </optgroup>
          <optgroup label="💻 Coding Specialist">
            <option value="gpt-codex">GPT Codex Mini ✱</option>
            <option value="claude-sonnet-4.5">Claude Sonnet 4.5 ✱</option>
          </optgroup>
          <optgroup label="👑 Flagship">
            <option value="gpt-4.1">GPT-4.1</option>
            <option value="claude-sonnet-4">Claude Sonnet 4</option>
            <option value="claude-opus-4">Claude Opus 4</option>
            <option value="claude-opus-4.5">Claude Opus 4.5 ✱ (ULTRA)</option>
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

  <!-- Agents — Embedded AgentSync Section -->
  <div class="config-section">
    <div class="config-header" id="agentsHeader">
      <span>🤖 Agents <span class="tier-badge" style="background:rgba(11,106,118,0.15);color:#0b6a76;padding:1px 6px;border-radius:6px;font-size:9px;">AgentSync</span></span>
      <span class="collapse-icon">▼</span>
    </div>
    <div class="config-content" id="agentsContent">
      <div class="agent-chips-wrap" id="agentChipsWrap">
        <span class="agent-chip removable" data-id="bug-hunter">🐛 Bug Hunter <span class="chip-remove" data-id="bug-hunter">×</span></span>
        <span class="agent-chip removable" data-id="code-generator">💻 Code Gen <span class="chip-remove" data-id="code-generator">×</span></span>
        <span class="agent-chip removable" data-id="refactoring">🔧 Refactor <span class="chip-remove" data-id="refactoring">×</span></span>
        <span class="agent-chip removable" data-id="strategic-planner">🗺 Planner <span class="chip-remove" data-id="strategic-planner">×</span></span>
        <span class="agent-chip removable" data-id="research-synthesizer">🔬 Research <span class="chip-remove" data-id="research-synthesizer">×</span></span>
        <span class="agent-chip removable" data-id="critical-evaluator">⚖️ Evaluator <span class="chip-remove" data-id="critical-evaluator">×</span></span>
        <span class="agent-chip removable" data-id="memory-curator">🧠 Memory <span class="chip-remove" data-id="memory-curator">×</span></span>
        <span class="agent-chip removable" data-id="logic-verifier">✅ Verifier <span class="chip-remove" data-id="logic-verifier">×</span></span>
        <span class="agent-chip removable" data-id="scenario-simulation">🎭 Scenario <span class="chip-remove" data-id="scenario-simulation">×</span></span>
        <span class="agent-chip removable" data-id="constraint-solver">🔒 Constraints <span class="chip-remove" data-id="constraint-solver">×</span></span>
      </div>
      <div style="font-size:9px;color:var(--vscode-descriptionForeground);padding:0 4px 4px;">Click a chip to activate its persona. ✕ to remove.</div>
      <div class="agents-actions">
        <button id="agentByokBtn" title="Configure your own API key">🔑 API Key (BYOK)</button>
        <button id="agentAddBtn" title="Add agent from catalog">＋ Add Agent</button>
      </div>

      <!-- Inline BYOK Panel -->
      <div id="byokPanel" style="display:none; padding:8px; border:1px solid var(--vscode-panel-border); border-radius:6px; margin-top:8px; background:var(--vscode-input-background);">
        <div style="font-size:11px; font-weight:600; margin-bottom:6px;">🔑 Bring Your Own Key</div>
        <select id="byokProvider" style="width:100%; margin-bottom:6px; padding:4px 6px; font-size:11px; background:var(--vscode-input-background); color:var(--vscode-input-foreground); border:1px solid var(--vscode-input-border); border-radius:4px;">
          <option value="">Select provider…</option>
          <option value="OpenAI">OpenAI (GPT-4.1, o1, Codex)</option>
          <option value="Anthropic">Anthropic (Claude Sonnet/Opus)</option>
          <option value="OpenRouter">OpenRouter (200+ models)</option>
          <option value="Google">Google (Gemini 2.5 Pro)</option>
          <option value="Groq">Groq (Ultra-fast Llama)</option>
          <option value="DeepSeek">DeepSeek (V3, R1)</option>
          <option value="xAI">xAI (Grok 3)</option>
          <option value="Mistral">Mistral AI (Devstral)</option>
          <option value="Cohere">Cohere (Command R+)</option>
          <option value="TogetherAI">Together AI</option>
          <option value="FireworksAI">Fireworks AI</option>
          <option value="Perplexity">Perplexity (Sonar)</option>
          <option value="HuggingFace">HuggingFace (Inference API)</option>
          <option value="Replicate">Replicate</option>
          <option value="AzureOpenAI">Azure OpenAI</option>
          <option value="AWSBedrock">AWS Bedrock</option>
          <option value="VertexAI">Vertex AI (Google Cloud)</option>
          <option value="Ollama">Ollama (Local)</option>
          <option value="LMStudio">LM Studio (Local)</option>
          <option value="Custom">Other / Custom</option>
        </select>
        <input id="byokKey" type="password" placeholder="Enter API key…" style="width:100%; margin-bottom:6px; padding:4px 6px; font-size:11px; background:var(--vscode-input-background); color:var(--vscode-input-foreground); border:1px solid var(--vscode-input-border); border-radius:4px; box-sizing:border-box;" />
        <div style="display:flex; gap:6px; margin-bottom:6px;">
          <button id="byokSaveBtn" style="flex:1; padding:4px; font-size:11px; background:var(--vscode-button-background); color:var(--vscode-button-foreground); border:none; border-radius:4px; cursor:pointer;">💾 Save</button>
          <button id="byokVerifyBtn" style="flex:1; padding:4px; font-size:11px; background:rgba(11,106,118,0.2); color:var(--vscode-foreground); border:1px solid rgba(11,106,118,0.4); border-radius:4px; cursor:pointer;">✓ Verify</button>
        </div>
        <div id="byokStatus" style="font-size:10px; min-height:14px; color:var(--vscode-descriptionForeground);"></div>
      </div>
    </div>
  </div>

  <!-- Autonomy & Permissions Section (always visible, collapsed by default) -->
  <div class="config-section" id="autonomySection">
    <div class="config-header" id="autonomyHeader">
      <span>⚙️ Autonomy &amp; Permissions</span>
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

  <div id="telemetryVisualizer" style="display:none; padding: 8px 16px; border-bottom: 1px solid var(--vscode-panel-border); background: var(--vscode-sideBar-background);">
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 6px;">
      <span id="telemetryTitle" style="font-size:11px; font-weight:600;">🧠 Ralph Live Thought Stream</span>
      <button id="killRalphButton" style="display:none; font-size:10px; padding:4px 8px; border:1px solid var(--vscode-button-border); border-radius:4px; background: var(--vscode-errorForeground); color:white; cursor:pointer;">🛑 Kill</button>
    </div>
    <div id="telemetryRows" style="display:flex; flex-direction:column; gap:4px;"></div>
  </div>
  
  ${!isPro ? `
  <div style="padding: 8px 16px; border-bottom: 1px solid var(--vscode-panel-border);">
    <button class="upgrade-banner" id="upgradeButton" style="width: 100%; padding: 8px; background: linear-gradient(135deg, #0b6a76 0%, #084a54 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 11px;">
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
  
  <div class="chat-input-area">
    <div class="chat-input-box">
      <textarea
        id="messageInput"
        placeholder="Ask HybridMind anything…"
        rows="1"
      ></textarea>
      <div class="chat-input-footer">
        <div class="chat-input-left">
          <div class="active-model-pill" id="activemodelPill">
            <span>⚡</span><span id="activemodelLabel">Llama 3.3 70B</span>
          </div>
          <button class="icon-btn" id="contextButton" title="Attach selected code">📎</button>
          <button class="icon-btn" id="clearButton" title="Clear chat">🗑</button>
        </div>
        <button class="send-btn" id="sendButton" title="Send (Enter)">↑</button>
      </div>
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
    const telemetryVisualizer = document.getElementById('telemetryVisualizer');
    const telemetryRows = document.getElementById('telemetryRows');
    const telemetryTitle = document.getElementById('telemetryTitle');
    const killRalphButton = document.getElementById('killRalphButton');
    
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

    if (killRalphButton) {
      killRalphButton.addEventListener('click', () => {
        vscode.postMessage({ type: 'killRalphLoop' });
      });
    }
    
    let messages = [];
    let includeContext = false;
    let selectedModels = ['llama-3.3-70b']; // Default
    let telemetryItems = [];
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
    setupCollapse('agentsHeader', 'agentsContent');

    // ── Rate Tracker ──────────────────────────────────────────────────────────
    async function updateRateTracker() {
      try {
        const res = await fetch('http://localhost:3000/cost-stats', {
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        const s = data.data || {};
        const credits = (s.dailyRemaining !== undefined) ? '$' + Number(s.dailyRemaining).toFixed(2) : '—';
        const reqsUsed = s.requestsToday || 0;
        const reqsMax = ${isPro ? 500 : 50};
        const pct = Math.min(100, (reqsUsed / reqsMax) * 100);
        const credEl = document.getElementById('trackerCredits');
        const barEl = document.getElementById('reqBar');
        const reqEl = document.getElementById('trackerReqs');
        if (credEl) credEl.textContent = credits;
        if (reqEl) reqEl.textContent = reqsUsed + ' / ' + reqsMax;
        if (barEl) {
          barEl.style.width = pct + '%';
          barEl.className = 'rate-bar-fill' + (pct > 90 ? ' crit' : pct > 70 ? ' warn' : '');
        }
      } catch (_) {}
    }
    updateRateTracker();
    setInterval(updateRateTracker, 30000);

    // ── Agents Inline Section (Embedded AgentSync) ───────────────────────────
    let activeAgents = new Set(); // active agent IDs whose persona will be prepended

    function bindAgentChips() {
      document.querySelectorAll('.agent-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
          // Ignore clicks on the × remove button
          if ((e.target as Element).classList.contains('chip-remove')) return;
          const id = (chip as HTMLElement).dataset.id || '';
          if (activeAgents.has(id)) {
            activeAgents.delete(id);
            chip.classList.remove('active-agent');
          } else {
            activeAgents.add(id);
            chip.classList.add('active-agent');
          }
        });
      });
      document.querySelectorAll('.chip-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = (btn as HTMLElement).dataset.id || '';
          const chip = document.querySelector('.agent-chip[data-id="' + id + '"]');
          if (chip) chip.remove();
          activeAgents.delete(id);
        });
      });
    }
    bindAgentChips();

    // BYOK panel toggle
    document.getElementById('agentByokBtn')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'openByok' });
    });

    // Add Agent — opens VS Code QuickPick via extension host
    document.getElementById('agentAddBtn')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'openAgentPicker' });
    });

    // BYOK panel save & verify
    document.getElementById('byokSaveBtn')?.addEventListener('click', () => {
      const provider = (document.getElementById('byokProvider') as HTMLSelectElement)?.value || '';
      const key = (document.getElementById('byokKey') as HTMLInputElement)?.value || '';
      vscode.postMessage({ type: 'saveApiKey', provider, key });
    });
    document.getElementById('byokVerifyBtn')?.addEventListener('click', () => {
      const provider = (document.getElementById('byokProvider') as HTMLSelectElement)?.value || '';
      const key = (document.getElementById('byokKey') as HTMLInputElement)?.value || '';
      vscode.postMessage({ type: 'verifyApiKey', provider, key });
    });

    // ── Active model pill update ──────────────────────────────────────────────
    function updateModelPill() {
      const labelEl = document.getElementById('activemodelLabel');
      if (!labelEl) return;
      const modelNames = {
        'llama-3.3-70b': 'Llama 3.3 70B', 'llama-3.1-8b': 'Llama 3.1 8B',
        'gemini-flash': 'Gemini Flash', 'deepseek-v3': 'DeepSeek V3',
        'deepseek-r1': 'DeepSeek R1', 'qwen3-coder': 'Qwen3 Coder',
        'devstral': 'Devstral 2', 'mimo-flash': 'MiMo Flash',
        'glm-4.5-air': 'GLM 4.5 Air', 'llama-4-maverick': 'Llama 4 Maverick',
        'llama-4-scout': 'Llama 4 Scout', 'gemini-2.0-flash': 'Gemini 2.0 Flash',
        'gpt-4.1': 'GPT-4.1', 'gpt-codex': 'Codex Mini',
        'claude-3.5-sonnet': 'Claude 3.5 Sonnet', 'claude-sonnet-4': 'Claude Sonnet 4',
        'claude-sonnet-4.5': 'Claude Sonnet 4.5', 'claude-opus-4': 'Claude Opus 4',
        'claude-opus-4.5': 'Claude Opus 4.5', 'gemini-2.5-pro': 'Gemini 2.5 Pro',
        'grok-3': 'Grok 3', 'o3-mini': 'o3-mini', 'o1': 'o1'
      };
      const first = selectedModels[0] || 'llama-3.3-70b';
      labelEl.textContent = (modelNames[first] || first).substring(0, 18);
      if (selectedModels.length > 1) labelEl.textContent += ' +' + (selectedModels.length - 1);
    }

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
          'gpt-4o': '👑 GPT-4.1 (legacy alias)',
          'gpt-4.1': '👑 GPT-4.1',
          'gpt-codex': '💻 GPT Codex Mini',
          'claude-3.5-sonnet': '👑 Claude 3.5 Sonnet',
          'claude-sonnet-4': '👑 Claude Sonnet 4',
          'claude-sonnet-4.5': '👑 Claude Sonnet 4.5',
          'claude-opus-4': '👑 Claude Opus 4',
          'claude-opus-4.5': '👑 Claude Opus 4.5',
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
      updateModelPill();
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
        updateModelPill();
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
        updateModelPill();
        vscode.postMessage({ type: 'changeModels', models: selectedModels });
      }
      e.target.value = '';
    });
    
    // Initial render
    renderSelectedModels();
    updateModelPill();
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
      let message = messageInput.value.trim();
      if (!message) return;
      
      if (selectedModels.length === 0) {
        alert('Please select at least one model');
        return;
      }

      // Prepend active agent persona hints to the message
      if (activeAgents.size > 0) {
        const agentLabels: Record<string, string> = {
          'bug-hunter': 'Bug Hunter (find issues)',
          'code-generator': 'Code Generator (write production code)',
          'refactoring': 'Refactoring Expert (clean code)',
          'strategic-planner': 'Strategic Planner (step-by-step plans)',
          'research-synthesizer': 'Research Synthesizer (thorough research)',
          'critical-evaluator': 'Critical Evaluator (find flaws)',
          'memory-curator': 'Memory Curator (track context)',
          'logic-verifier': 'Logic Verifier (check correctness)',
          'scenario-simulation': 'Scenario Simulator (edge cases)',
          'constraint-solver': 'Constraint Solver (resolve blockers)',
          'documenter': 'Documenter (write clear docs)',
          'security-auditor': 'Security Auditor (find vulnerabilities)',
          'perf-optimizer': 'Performance Optimizer (speed)',
          'test-writer': 'Test Writer (write tests)',
        };
        const activeLabels = Array.from(activeAgents).map(id => agentLabels[id as string] || id).join(', ');
        message = '[Active agents: ' + activeLabels + ']\n\n' + message;
      }

      vscode.postMessage({
        type: 'sendMessage',
        message: message,
        models: selectedModels,
        workflow: workflowSelector.value,
        includeContext: includeContext
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
      } else if (message.type === 'toggleByokPanel') {
        const panel = document.getElementById('byokPanel');
        if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      } else if (message.type === 'byokStatus') {
        const statusEl = document.getElementById('byokStatus');
        if (statusEl) {
          statusEl.textContent = message.message || '';
          statusEl.style.color = message.status === 'error' ? 'var(--vscode-errorForeground)' :
                                  message.status === 'verified' || message.status === 'saved' ? '#10b981' :
                                  'var(--vscode-descriptionForeground)';
        }
      } else if (message.type === 'agentAdded') {
        // Dynamically add a new agent chip
        const wrap = document.getElementById('agentChipsWrap');
        if (wrap && message.id && !wrap.querySelector('.agent-chip[data-id="' + message.id + '"]')) {
          const chip = document.createElement('span');
          chip.className = 'agent-chip removable';
          chip.dataset.id = message.id;
          chip.innerHTML = message.label + ' <span class="chip-remove" data-id="' + message.id + '">×</span>';
          wrap.appendChild(chip);
          bindAgentChips(); // re-bind events for new chip
        }
      } else if (message.type === 'telemetryClear') {
        telemetryItems = [];
        if (telemetryRows) {
          telemetryRows.innerHTML = '';
        }
      } else if (message.type === 'telemetryState') {
        if (telemetryVisualizer) {
          telemetryVisualizer.style.display = 'block';
        }
        if (telemetryTitle) {
          telemetryTitle.textContent = '🧠 ' + (message.title || 'Ralph Live Thought Stream');
        }
        if (killRalphButton) {
          killRalphButton.style.display = message.active ? 'inline-block' : 'none';
        }
      } else if (message.type === 'telemetryEvent' && message.event) {
        const status = message.event.status || 'yellow';
        const dot = status === 'green' ? '🟢' : status === 'red' ? '🔴' : '🟡';
        const attempt = message.event.attempt || (telemetryItems.length + 1);
        const text = dot + ' Attempt ' + attempt + ': ' + (message.event.message || 'No telemetry message');
        telemetryItems.push(text);

        if (telemetryRows) {
          const row = document.createElement('div');
          row.style.fontSize = '12px';
          row.style.opacity = '0';
          row.style.transform = 'translateY(4px)';
          row.style.transition = 'opacity 180ms ease, transform 180ms ease';
          row.textContent = text;
          telemetryRows.appendChild(row);

          requestAnimationFrame(() => {
            row.style.opacity = '1';
            row.style.transform = 'translateY(0)';
          });
        }

        if (telemetryVisualizer) {
          telemetryVisualizer.style.display = 'block';
        }
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
