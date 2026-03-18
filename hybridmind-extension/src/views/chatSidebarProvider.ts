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
  private _htmlInitialized: boolean = false;  // only set html once
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

  public updateServerPort(port: number) {
    this._serverPort = port;
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

    // Only set HTML once — re-setting it destroys the JS context and kills click events
    if (!this._htmlInitialized) {
      this._htmlInitialized = true;
      webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    }

    // Always push current tier info after the view attaches (handles the race where
    // verifyLicense() resolved before the sidebar was first opened, so the earlier
    // refreshTier() call was a no-op because this._view was null at that point).
    setTimeout(() => this.refreshTier(), 300);

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
      { label: 'Bug Hunter',       id: 'bug-hunter',            description: 'Finds & explains bugs in your code' },
      { label: 'Code Generator',   id: 'code-generator',        description: 'Writes complete, production-ready code' },
      { label: 'Refactoring',      id: 'refactoring',           description: 'Cleans up and restructures existing code' },
      { label: 'Strategic Planner', id: 'strategic-planner',     description: 'Breaks complex tasks into step-by-step plans' },
      { label: 'Research Agent',   id: 'research-synthesizer',  description: 'Researches and synthesises technical answers' },
      { label: 'Evaluator',        id: 'critical-evaluator',    description: 'Critically reviews plans and code for flaws' },
      { label: 'Memory Curator',   id: 'memory-curator',        description: 'Tracks context across long conversations' },
      { label: 'Logic Verifier',   id: 'logic-verifier',        description: 'Verifies correctness of logic and algorithms' },
      { label: 'Scenario Sim',     id: 'scenario-simulation',   description: 'Simulates edge cases and what-if scenarios' },
      { label: 'Constraints',      id: 'constraint-solver',     description: 'Identifies and resolves constraints in a design' },
      { label: 'Documenter',       id: 'documenter',            description: 'Writes clear docs, README files, and comments' },
      { label: 'Security Auditor', id: 'security-auditor',      description: 'Checks code for security vulnerabilities' },
      { label: 'Performance Guru', id: 'perf-optimizer',        description: 'Finds and fixes performance bottlenecks' },
      { label: 'Test Writer',      id: 'test-writer',           description: 'Generates comprehensive unit and integration tests' },
    ];

    const picked = await vscode.window.showQuickPick(catalog, {
      placeHolder: 'Select an agent to add to your session',
      title: 'HybridMind - Add Agent'
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
    this._view?.webview.postMessage({ type: 'byokStatus', status: 'saved', message: `Success: ${provider} API key saved. Requests will route through your key.` });
  }

  /** Verify a BYOK API key by making a test call. */
  private async _handleVerifyApiKey(provider: string, key: string) {
    if (!provider || !key) {
      this._view?.webview.postMessage({ type: 'byokStatus', status: 'error', message: 'Enter provider and key first.' });
      return;
    }
    this._view?.webview.postMessage({ type: 'byokStatus', status: 'verifying', message: 'Verifying Verifying key...' });
    try {
      const response = await fetch('http://localhost:3000/run/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Api-Provider': provider, 'X-User-Api-Key': key },
        body: JSON.stringify({ model: 'llama-3.3-70b', prompt: 'Reply with only the word OK', maxTokens: 5 })
      });
      if (response.ok) {
        this._view?.webview.postMessage({ type: 'byokStatus', status: 'verified', message: `Success: Key verified! ${provider} is working correctly.` });
      } else {
        const err = await response.text();
        this._view?.webview.postMessage({ type: 'byokStatus', status: 'error', message: `Error: Verification failed (${response.status}): ${err.substring(0, 120)}` });
      }
    } catch (e: any) {
      this._view?.webview.postMessage({ type: 'byokStatus', status: 'error', message: `Error: Could not reach backend: ${e.message}` });
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
          'Tip: To actually edit files, switch to Agentic mode in the workflow dropdown above. Otherwise I can only provide suggestions.',
          'Switch to Agentic Mode',
          'Just Get Suggestions'
        );
        
        if (switchToAgentic === 'Switch to Agentic Mode') {
          // Inform user to manually switch - we'll handle it next time
          vscode.window.showInformationMessage('Please select "Agentic" from the workflow dropdown at the top, then ask again! ');
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
        // Single model mode - send full conversation history as messages array
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
              const dot = status === 'green' ? '[ok]' : status === 'red' ? '[error]' : '[warn]';
              const attempt = entry?.attempt || (index + 1);
              const message = entry?.message || 'No telemetry message';
              return `${dot} Attempt ${attempt}: ${message}`;
            })
            .join('\n\n');

          const telemetryMsg: ChatMessage = {
            role: 'assistant',
            content: `**Ralph Ralph Live Thought Stream**\n\n${telemetryLines}`,
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
        // Backend agentic workflow (Planner -> Executor -> Reviewer)
        const result = responseData;
        
        // Show execution steps if available
        if (result.execution?.results) {
          for (const step of result.execution.results) {
            const stepMsg: ChatMessage = {
              role: 'assistant',
              content: `**Step ${step.stepName}** (${step.action})\n${step.success ? 'Success:' : 'Error:'} ${step.confirmation?.message || 'Executed'}\n\nChanges: ${step.changes?.linesAdded || 0} added, ${step.changes?.linesRemoved || 0} removed`,
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
            content: `**Review Review**\n\n${result.review.summary || 'Review complete'}\n\n**Quality Score:** ${result.review.qualityScore || 'N/A'}\n**Issues:** ${result.review.issues?.length || 0}`,
            model: 'Reviewer',
            timestamp: new Date()
          };
          this._messages.push(reviewMsg);
        }
        
        // Final result
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: `**Complete Agentic Workflow Complete**\n\n${result.finalOutput || 'Task completed successfully'}`,
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
        content: `Error: Error Analysis:\n\n**Problem:** ${error.message}\n\n**Suggestion:** ${suggestion}`,
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
      console.log(`[Intent Detection] User: "${userMessage}" -> Raw output: "${output}" -> Intent: "${modelIntent}"`);

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
    // Only flag truly empty or single-word messages - let the agent handle everything else.
    const words = message.trim().split(/\s+/);
    if (words.length <= 1 && message.trim().length < 3) {
      return { isAmbiguous: true, clarification: 'What would you like me to do?' };
    }
    return { isAmbiguous: false };
  }

  /**
   * Handle autonomous agent execution with file discovery and planning
   */
  /**
   * Returns true for conversational / Q&A messages that should be answered
   * directly without going through the plan→confirm→execute loop.
   */
  private _isQandARequest(message: string): boolean {
    const trimmed = message.trim();
    const questionStart = /^(what|how|why|explain|describe|summarize|show me|tell me|who|where|when|can you|could you|is it|are there|does it|what is|what are|what does|what happened|what's|whats|hm+|hmm+|well\?|right\?|so\?|now what|and then|what next)/i.test(trimmed);
    // Short conversational messages with no action keywords
    const actionWords = /\b(fix|create|add|delete|remove|update|change|write|move|rename|refactor|install|run|build|deploy|edit|modify|implement|generate|make|do|execute|convert|migrate|rewrite)\b/i;
    const isShortConversational = trimmed.length < 50 && !actionWords.test(trimmed);
    return questionStart || isShortConversational;
  }

  /**
   * Answer a Q&A request directly via the single-model endpoint, bypassing planning.
   */
  private async _answerDirectly(userMessage: string, models: string[], contextCode: string) {
    this._view?.webview.postMessage({ type: 'thinking', value: true });
    try {
      const model = models[0] || this._selectedModels[0] || 'llama-3.3-70b-versatile';
      const historyMessages = this._messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-20)
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      historyMessages.push({ role: 'user', content: userMessage });

      const response = await fetch('http://localhost:3000/run/single', {
        method: 'POST',
        headers: this._licenseManager.getApiHeaders(),
        body: JSON.stringify({
          model,
          prompt: userMessage,
          messages: historyMessages,
          ...(contextCode ? { code: contextCode } : {})
        })
      });

      const data: any = await response.json();

      if (!response.ok) {
        const msg = data?.error?.message || data?.message || `Backend error ${response.status}`;
        throw new Error(msg);
      }

      // Backend wraps in { success, data: { output } } via responseFormatter.modelResult
      const output = data?.data?.output
        || data?.data?.content
        || data?.output
        || data?.content
        || '';
      if (!output) { throw new Error('No response from model'); }

      const assistantMsg: ChatMessage = { role: 'assistant', content: output, model, timestamp: new Date() };
      this._messages.push(assistantMsg);
      this._updateWebview();
    } catch (e: any) {
      const errMsg: ChatMessage = { role: 'assistant', content: `Error getting response: ${e.message}`, timestamp: new Date() };
      this._messages.push(errMsg);
      this._updateWebview();
    } finally {
      this._view?.webview.postMessage({ type: 'thinking', value: false });
    }
  }

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
            content: 'Error: Plan cancelled. How can I help you?',
            timestamp: new Date()
          };
          this._messages.push(cancelMsg);
          this._updateWebview();
          return;
        }
        
        if (intent === 'adjust') {
          const adjustMsg: ChatMessage = {
            role: 'assistant',
            content: 'Step What would you like to adjust in the plan? Please describe the changes you want.',
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
              content: `Locked: Executing with constraints: ${constraintParts.join(', ')}`,
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
              content: `Warning: ${risk.toUpperCase()} RISK OPERATION detected!\n\nThis operation could potentially cause significant changes. Type "confirm ${risk}" to proceed.`,
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
            content: constraints.readOnly ? 'Read-only: Reviewing previous plan (read-only)...' : `Executing previous plan (${risk} risk)...`,
            timestamp: new Date()
          };
          this._messages.push(executingMsg);
          this._updateWebview();

          const result = await this._agentPlanner.executePlan(this._lastPlan, (step, status) => {
            const progressMsg: ChatMessage = {
              role: 'system',
              content: `${status === 'completed' ? 'Success:' : status === 'failed' ? 'Error:' : '[running]'} Step ${step.id}: ${step.description}`,
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

      // Q&A SHORTCUT: Conversational/explanation requests don't need a plan or confirmation —
      // just answer directly via the single-model endpoint.
      if (this._isQandARequest(userMessage)) {
        await this._answerDirectly(userMessage, models, contextCode);
        return;
      }

      // STEP 1: Check for ambiguity - ask for clarification if needed
      const ambiguityCheck = await this._detectAmbiguity(userMessage);
      if (ambiguityCheck.isAmbiguous) {
        const clarificationMsg: ChatMessage = {
          role: 'assistant',
          content: `Question: ${ambiguityCheck.clarification || 'Could you be more specific about what you want to do?'}`,
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
        content: `Ralph Analyzing request and creating execution plan... (${complexity} task)`,
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
          content: `## Error: Error\n\n${plan.analysis}\n\n${plan.reasoning}`,
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
          content: `## Plan: ${plan.goal}\n\n${plan.analysis}\n\n${plan.reasoning ? `**Reasoning:** ${plan.reasoning}` : ''}`,
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
      const riskEmoji = riskLevel === 'critical' ? '[error]' : riskLevel === 'high' ? '[high]' : riskLevel === 'medium' ? '[warn]' : '[ok]';
      const needsConfirm = riskLevel === 'high' || riskLevel === 'critical' || autonomyLevel !== AutonomyLevel.FullAuto;

      // Show the plan with steps
      const confirmationText = riskLevel === 'high' || riskLevel === 'critical'
        ? `\n\nWarning: **${riskLevel.toUpperCase()} RISK OPERATION** - Type "confirm ${riskLevel}" to proceed.`
        : needsConfirm
          ? `\n\n *Reply "ok" to execute this plan, or provide feedback to adjust it.*`
          : '';

      const planMsg: ChatMessage = {
        role: 'assistant',
        content: `## Execution Plan\n\n**Goal:** ${plan.goal}\n\n**Analysis:** ${plan.analysis}\n\n**Steps:**\n${plan.steps.map((s: any) => `${s.id}. ${s.description} (${s.type})`).join('\n')}\n\n**Reasoning:** ${plan.reasoning}\n\n**Complexity:** ${complexity} | **Risk:** ${riskEmoji} ${riskLevel}\n**Autonomy Level:** ${this._autonomyManager.getLevelDescription()}${confirmationText}`,
        model: 'Agent Planner',
        timestamp: new Date()
      };
      this._messages.push(planMsg);
      this._updateWebview();

      if (needsConfirm) {
        // Store plan and wait for user to say "ok"
        this._lastPlan = plan;
        console.log(`[Autonomous] Plan stored, awaiting confirmation. Goal: "${plan.goal}"`);
        return;
      }

      // Full autonomy + low/medium risk: execute immediately without asking
      console.log(`[Autonomous] Full autonomy — executing immediately. Goal: "${plan.goal}"`);
      const constraints = await this._detectConstraints(userMessage);
      const result = await this._agentPlanner.executePlan(plan, (step, status) => {
        const progressMsg: ChatMessage = {
          role: 'system',
          content: `${status === 'completed' ? 'Success:' : status === 'failed' ? 'Error:' : '[running]'} Step ${step.id}: ${step.description}`,
          timestamp: new Date()
        };
        this._messages.push(progressMsg);
        this._updateWebview();
      }, constraints);

      this._currentExecution = result;
      const summaryMsg: ChatMessage = {
        role: 'assistant',
        content: result.summary,
        model: 'Agent Summary',
        timestamp: new Date()
      };
      this._messages.push(summaryMsg);
      this._updateWebview();
      return;
    } catch (error: any) {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `Error: Autonomous execution error: ${error.message}`,
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
      content: 'Success: All file changes have been accepted.',
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
      content: 'Reverted: All file changes have been reverted.',
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
    this._view?.webview.postMessage({ type: 'telemetryState', active: true, title: 'Ralph loop started...' });

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
          content: `**Ralph Ralph Loop Complete**\n\n${output}`,
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
          content: `Error: Ralph stream error: ${payload.error || 'Unknown error'}`,
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
        content: `Stopped: Ralph kill switch activated. Cleaned ${data.cleanedApprovalTickets?.updated || 0} pending approval ticket(s).`,
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
    if (!this._view) return;
    const isPro = this._licenseManager.isPro();
    const isProPlus = this._licenseManager.isProPlus();
    const maxModels = isPro ? 4 : 2;
    const maxAgents = isProPlus ? 8 : isPro ? 4 : 0;
    // Post a message to update tier UI instead of replacing HTML
    // (replacing HTML reloads the iframe and permanently loses focus/clicks)
    this._view.webview.postMessage({ type: 'tierUpdate', isPro, isProPlus, maxModels, maxAgents });
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
    const isProPlus = this._licenseManager.isProPlus();
    const maxModels = isPro ? 4 : 2;
    const maxAgents = isProPlus ? 8 : isPro ? 4 : 0;
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'chat.js')
    );
    const logoUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'HybridMind.png')
    );
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'unsafe-inline' ${webview.cspSource}; connect-src http://localhost:3000 http://127.0.0.1:3000; img-src ${webview.cspSource} https: data:;">
<title>HybridMind</title>
<style>
/* === RESET: same as working test page === */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { margin: 0; padding: 0; }
body { margin: 0; padding: 0; font-family: var(--vscode-font-family, sans-serif); font-size: 12px; line-height: 1.5; color: var(--vscode-foreground, #ccc); background: var(--vscode-sideBar-background, #252526); }

/* === LAYOUT: position:fixed fills webview, NO overflow:hidden on root === */
#layout { position: fixed; inset: 0; display: flex; flex-direction: column;
  --t: #0b6a76; --tb: #0d8a9a; --th: #0a5a65;
  --ts: rgba(11,106,118,.10); --tm: rgba(11,106,118,.20); --tr: rgba(11,106,118,.30);
  --ok: #10b981; --warn: #f59e0b; --err: #ef4444; --info: #38bdf8;
  --r: 8px; --rs: 5px; --rp: 999px;
  --sf: var(--vscode-editor-background, #1e1e1e);
  --s2: var(--vscode-input-background, #3c3c3c);
  --bd: var(--vscode-panel-border, rgba(255,255,255,.1));
  --mu: var(--vscode-descriptionForeground, #888);
}

/* === SCROLLBAR === */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--tr); border-radius: 4px; }

/* === DIAG === */
#diag { display: flex; align-items: center; gap: 6px; padding: 3px 8px; background: #1a3a3a; font-size: 9px; font-family: monospace; flex-shrink: 0; border-bottom: 1px solid #0b6a76; }

/* === HEADER === */
.hdr { display: flex; align-items: center; justify-content: space-between; padding: 7px 12px; background: linear-gradient(135deg,rgba(11,106,118,.18),rgba(11,106,118,.04)); border-bottom: 1px solid var(--tr); flex-shrink: 0; }
.hdr-logo { display: flex; align-items: center; gap: 7px; }
.hdr-mark { width: 22px; height: 22px; border-radius: 6px; background: var(--t); display: flex; align-items: center; justify-content: center; }
.hdr-mark svg { display: block; }
.hdr-name { font-size: 12px; font-weight: 700; letter-spacing: .3px; }
.hdr-r { display: flex; align-items: center; gap: 6px; }
.tier-pill { font-size: 9px; font-weight: 700; letter-spacing: .5px; padding: 2px 7px; border-radius: var(--rp); border: 1px solid; }
.tier-pill.free  { color: var(--ok); background: rgba(16,185,129,.12); border-color: rgba(16,185,129,.35); }
.tier-pill.pro   { color: #60a5fa; background: rgba(96,165,250,.12); border-color: rgba(96,165,250,.35); }
.tier-pill.pro-plus { color: var(--tb); background: var(--ts); border-color: var(--tr); }
.ibtn { width: 26px; height: 26px; border-radius: var(--rs); border: 1px solid transparent; background: transparent; color: var(--mu); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 140ms,color 140ms,border-color 140ms; font-family: inherit; }
.ibtn:hover { background: var(--ts); color: var(--tb); border-color: var(--tr); }

/* === STATS === */
.stats { display: flex; padding: 5px 12px; background: var(--sf); border-bottom: 1px solid var(--bd); flex-shrink: 0; }
.stat { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 1px; position: relative; }
.stat + .stat::before { content: ''; position: absolute; left: 0; top: 20%; height: 60%; width: 1px; background: var(--bd); }
.slbl { font-size: 9px; color: var(--mu); text-transform: uppercase; letter-spacing: .4px; }
.sval { font-size: 11px; font-weight: 600; color: var(--tb); }
.sbar { width: 50px; height: 3px; border-radius: var(--rp); background: rgba(128,128,128,.18); overflow: hidden; margin-top: 2px; }
.sfill { height: 100%; width: 0; border-radius: var(--rp); background: var(--t); transition: width 300ms; }
.sfill.w { background: var(--warn); } .sfill.c { background: var(--err); }

/* === TABS === */
.tabs { display: flex; gap: 1px; background: var(--bd); border-bottom: 1px solid var(--bd); flex-shrink: 0; }
.tab { flex: 1; padding: 7px 4px; text-align: center; font-size: 10px; font-weight: 500; cursor: pointer; background: var(--sf); color: var(--mu); border: none; font-family: inherit; transition: background 150ms,color 150ms; position: relative; }
.tab:hover { color: var(--vscode-foreground,#fff); background: var(--ts); }
.tab.on { color: var(--tb); background: var(--s2); font-weight: 700; }
.tab.on::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px; background: var(--t); }
.panel { display: none; flex-direction: column; gap: 8px; padding: 9px 12px; background: var(--s2); flex-shrink: 0; max-height: 270px; overflow-y: auto; }
.panel.on { display: flex; }

/* === FORM === */
.flbl { font-size: 10px; color: var(--mu); font-weight: 500; letter-spacing: .3px; text-transform: uppercase; margin-bottom: 4px; }
.sel, .inp { width: 100%; padding: 6px 9px; border-radius: var(--rs); border: 1px solid var(--tr); background: var(--vscode-input-background,#3c3c3c); color: var(--vscode-input-foreground,#ccc); font-size: 11px; font-family: inherit; outline: none; transition: border-color 150ms; }
.sel:focus, .inp:focus { border-color: var(--t); box-shadow: 0 0 0 2px rgba(11,106,118,.18); }
.sel:disabled { opacity: .45; cursor: not-allowed; }

/* === MODEL TAGS === */
.tagwrap { display: flex; flex-wrap: wrap; gap: 5px; min-height: 28px; align-items: center; }
.tag { display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: var(--rp); border: 1px solid var(--tr); background: var(--ts); font-size: 10px; font-weight: 500; }
.xbtn { width: 14px; height: 14px; border-radius: 50%; border: none; background: rgba(255,255,255,.10); color: var(--mu); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 11px; line-height: 1; padding: 0; transition: background 120ms; font-family: inherit; }
.xbtn:hover { background: var(--err); color: #fff; }

/* === WORKFLOW === */
.wfgrid { display: grid; grid-template-columns: repeat(5,1fr); gap: 4px; }
.wfb { padding: 5px 2px; border-radius: var(--rs); border: 1px solid var(--bd); background: var(--sf); color: var(--mu); font-size: 10px; font-weight: 500; cursor: pointer; text-align: center; transition: all 150ms; font-family: inherit; }
.wfb:hover { border-color: var(--tr); color: var(--vscode-foreground,#fff); }
.wfb.on { border-color: var(--t); background: var(--tm); color: var(--tb); font-weight: 700; }
.wfdesc { font-size: 10px; color: var(--mu); line-height: 1.4; padding: 5px 8px; border-radius: var(--rs); border-left: 2px solid var(--tr); background: var(--ts); }

/* === AUTONOMY === */
.autogrid { display: grid; grid-template-columns: repeat(3,1fr); gap: 5px; }
.autoopt { padding: 7px 4px; border-radius: var(--rs); border: 1px solid var(--bd); background: var(--sf); text-align: center; cursor: pointer; transition: all 150ms; }
.autoopt:hover { border-color: var(--tr); }
.autoopt.on { border-color: var(--t); background: var(--tm); }
.anum { font-size: 14px; font-weight: 800; color: var(--tb); line-height: 1; margin-bottom: 2px; }
.aname { font-size: 9px; color: var(--mu); letter-spacing: .3px; }
.pgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
.prow { display: flex; align-items: center; gap: 6px; font-size: 10px; cursor: pointer; padding: 3px 5px; border-radius: 4px; transition: background 120ms; user-select: none; }
.prow:hover { background: var(--ts); }
.prow input[type=checkbox] { accent-color: var(--t); width: 12px; height: 12px; cursor: pointer; }
.togrow { display: flex; align-items: center; justify-content: space-between; padding: 5px 8px; border-radius: var(--rs); border: 1px solid var(--bd); background: var(--sf); cursor: pointer; }
.togrow:hover { border-color: var(--tr); }
.toglbl { font-size: 10px; font-weight: 500; }
.togsw { width: 30px; height: 16px; border-radius: var(--rp); background: rgba(128,128,128,.3); position: relative; cursor: pointer; transition: background 200ms; flex-shrink: 0; border: none; display: block; }
.togsw.on { background: var(--t); }
.togthumb { position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; transition: transform 200ms; box-shadow: 0 1px 3px rgba(0,0,0,.25); }
.togsw.on .togthumb { transform: translateX(14px); }

/* === AGENTS === */
.agctr { display: flex; align-items: center; justify-content: space-between; padding: 5px 0; }
.agctrlbl { font-size: 10px; color: var(--mu); }
.agctrval { font-size: 10px; font-weight: 700; color: var(--tb); }
.agslots { display: flex; flex-direction: column; gap: 5px; max-height: 160px; overflow-y: auto; }
.agslot { display: flex; align-items: center; gap: 7px; padding: 6px 8px; border-radius: var(--rs); border: 1px solid var(--tr); background: var(--ts); }
.aglbl { flex: 1; font-size: 10px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.agrm { width: 18px; height: 18px; border-radius: 50%; border: none; background: transparent; color: var(--mu); cursor: pointer; font-size: 14px; line-height: 1; display: flex; align-items: center; justify-content: center; padding: 0; flex-shrink: 0; transition: color 120ms,background 120ms; font-family: inherit; }
.agrm:hover { color: var(--err); background: rgba(239,68,68,.10); }
.freebanner { padding: 8px 10px; border-radius: var(--rs); border: 1px solid var(--tr); background: var(--ts); font-size: 10px; color: var(--tb); text-align: center; font-weight: 500; }

/* === INLINE AGENT PICKER === */
.ag-picker { display:none; flex-direction:column; border:1px solid var(--tr); border-radius:var(--rs); overflow:hidden; margin-top:4px; }
.ag-picker.open { display:flex; }
.ag-search { padding:6px 9px; border:none; border-bottom:1px solid var(--bd); background:var(--vscode-input-background,#3c3c3c); color:var(--vscode-input-foreground,#ccc); font-size:11px; font-family:inherit; outline:none; width:100%; }
.ag-list { display:flex; flex-direction:column; max-height:150px; overflow-y:auto; }
.ag-item { padding:5px 9px; cursor:pointer; transition:background 120ms; }
.ag-item:hover { background:var(--tm); }
.ag-lbl { font-size:10px; font-weight:600; }
.ag-desc { font-size:9px; color:var(--mu); margin-top:1px; }

/* === FLOWCHART BUILDER === */
.fc-sep { height:1px; background:var(--bd); margin:6px 0; }
.fc-hdr { display:flex; align-items:center; justify-content:space-between; padding:3px 0; cursor:pointer; }
.fc-title { font-size:10px; font-weight:600; color:var(--mu); text-transform:uppercase; letter-spacing:.4px; transition:color 150ms; user-select:none; }
.fc-hdr:hover .fc-title { color:var(--tb); }
.fc-chev { font-size:9px; color:var(--mu); transition:transform 150ms; }
.fc-chev.open { transform:rotate(180deg); }
.fc-body { display:none; flex-direction:column; gap:5px; padding-top:4px; }
.fc-body.open { display:flex; }
.fc-tabs { display:flex; gap:3px; }
.fc-tab { flex:1; padding:4px; border-radius:var(--rs); border:1px solid var(--bd); background:var(--sf); color:var(--mu); font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.3px; cursor:pointer; text-align:center; font-family:inherit; transition:all 150ms; }
.fc-tab.on { border-color:var(--t); background:var(--tm); color:var(--tb); }
.fc-badge { font-size:9px; padding:2px 6px; border-radius:var(--rp); background:rgba(16,185,129,.15); color:var(--ok); border:1px solid rgba(16,185,129,.3); font-weight:700; }
/* node list */
.fc-nodes { display:flex; flex-direction:column; gap:3px; }
.fcn { display:flex; align-items:center; gap:3px; padding:3px 5px; border-radius:var(--rs); border:1px solid var(--bd); background:var(--sf); }
.fcn-badge { width:16px; height:16px; border-radius:3px; display:flex; align-items:center; justify-content:center; font-size:9px; flex-shrink:0; color:#fff; font-weight:700; }
.fcn-inp { flex:1; background:transparent; border:none; font-size:10px; color:var(--vscode-foreground,#ccc); font-family:inherit; outline:none; min-width:0; padding:0; }
.fcn-inp:focus { background:var(--s2); border-radius:3px; padding:1px 3px; }
.fcn-btn { width:16px; height:16px; border:none; background:transparent; color:var(--mu); cursor:pointer; font-size:11px; line-height:1; padding:0; flex-shrink:0; display:flex; align-items:center; justify-content:center; border-radius:3px; font-family:inherit; transition:background 120ms,color 120ms; }
.fcn-btn:hover { background:var(--ts); color:var(--tb); }
.fcn-del:hover { background:rgba(239,68,68,.15); color:var(--err); }
.fcn-ph { width:16px; flex-shrink:0; }
/* add buttons */
.fc-add-row { display:flex; gap:3px; }
.fc-addbtn { flex:1; font-size:9px; padding:3px 4px; border-radius:var(--rs); border:1px solid var(--bd); background:var(--sf); color:var(--mu); cursor:pointer; font-family:inherit; transition:all 150ms; font-weight:600; text-align:center; }
.fc-addbtn:hover { border-color:var(--tr); color:var(--tb); background:var(--ts); }
.fc-svg-wrap { border:1px solid var(--bd); border-radius:var(--rs); background:var(--sf); overflow:hidden; }

/* === BUTTONS === */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 5px 10px; border-radius: var(--rs); border: 1px solid var(--bd); background: var(--vscode-button-secondaryBackground,#3a3a3a); color: var(--vscode-button-secondaryForeground,#ccc); font-size: 10px; font-weight: 500; font-family: inherit; cursor: pointer; transition: background 150ms,border-color 150ms; white-space: nowrap; }
.btn:hover { background: var(--vscode-button-hoverBackground,#4a4a4a); border-color: var(--tr); }
.btn:disabled { opacity: .4; cursor: not-allowed; }
.btn-t { background: var(--t); border-color: var(--th); color: #fff; }
.btn-t:hover { background: var(--th); }
.btn-sm { padding: 3px 7px; font-size: 10px; }
.btn-full { width: 100%; }
.upbtn { display: block; width: 100%; padding: 8px 12px; border: none; border-radius: var(--rs); background: linear-gradient(135deg,#0b6a76,#07454f); color: #fff; font-size: 11px; font-weight: 600; cursor: pointer; letter-spacing: .2px; transition: filter 150ms; text-align: center; font-family: inherit; }
.upbtn:hover { filter: brightness(1.08); }

/* === BYOK === */
.brow { display: flex; gap: 6px; }
.bstat { font-size: 10px; padding: 4px 8px; border-radius: 4px; background: var(--s2); color: var(--mu); min-height: 22px; }
.bstat.ok { color: var(--ok); } .bstat.er { color: var(--err); }

/* === RALPH === */
.ralph { display: none; border-bottom: 1px solid var(--bd); background: var(--sf); flex-shrink: 0; }
.ralph-hdr { display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; border-bottom: 1px solid var(--bd); }
.ralph-ttl { font-size: 10px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; color: var(--tb); }
.ralph-rows { display: flex; flex-direction: column; gap: 3px; padding: 6px 12px; max-height: 100px; overflow-y: auto; font-size: 10px; font-family: monospace; }
.rrow { display: flex; gap: 6px; align-items: flex-start; }
.rdot { width: 6px; height: 6px; border-radius: 50%; margin-top: 4px; flex-shrink: 0; }
.rdot.ok { background: var(--ok); } .rdot.w { background: var(--warn); } .rdot.e { background: var(--err); }

/* === MESSAGES === */
.msgs { flex: 1; overflow-y: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; min-height: 0; }
.msg { border-radius: var(--r); border: 1px solid var(--bd); background: var(--sf); flex-shrink: 0; }
.msg.user { border-color: var(--tr); background: var(--ts); }
.msg.assistant { border-color: rgba(56,189,248,.25); }
.msg.system { border-color: rgba(245,158,11,.25); background: rgba(245,158,11,.05); }
/* Compact status line for step progress messages */
.status-line { display: flex; align-items: center; gap: 6px; padding: 3px 4px; font-size: 10px; color: var(--mu); flex-shrink: 0; }
.status-line .sdot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.status-line.sl-run .sdot { background: var(--info); }
.status-line.sl-ok .sdot { background: var(--ok); }
.status-line.sl-err .sdot { background: var(--er); }
.status-line.sl-sys .sdot { background: var(--warn); }
.status-line .stxt { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.mhdr { display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-bottom: 1px solid rgba(128,128,128,.10); }
.mrole { display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 600; letter-spacing: .3px; }
.rdot2 { width: 7px; height: 7px; border-radius: 50%; }
.msg.user .rdot2 { background: var(--t); }
.msg.assistant .rdot2 { background: var(--info); }
.msg.system .rdot2 { background: var(--warn); }
.mtime { font-size: 9px; color: var(--mu); }
.mbadge { font-size: 9px; padding: 1px 6px; border-radius: var(--rp); background: rgba(128,128,128,.12); border: 1px solid rgba(128,128,128,.2); color: var(--mu); }
.mbody { padding: 8px 10px; font-size: 12px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; }
.macts { display: flex; gap: 5px; padding: 4px 10px 7px; }
.mbody code { font-family: monospace; font-size: 11px; background: rgba(128,128,128,.12); padding: 1px 4px; border-radius: 3px; }
/* === ANSWER BOX (collapsible response) === */
.ans-box { border-radius: var(--r); border: 1px solid rgba(56,189,248,.22); background: var(--sf); flex-shrink: 0; overflow: hidden; }
.ans-hdr { display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; cursor: pointer; user-select: none; border-bottom: 1px solid transparent; transition: border-color .15s; }
.ans-hdr:hover { background: rgba(56,189,248,.06); }
.ans-box.open .ans-hdr { border-bottom-color: rgba(56,189,248,.15); }
.ans-meta { display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 600; letter-spacing: .3px; color: var(--fg); }
.ans-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--info); }
.ans-badge { font-size: 9px; padding: 1px 6px; border-radius: var(--rp); background: rgba(56,189,248,.12); border: 1px solid rgba(56,189,248,.25); color: rgba(56,189,248,.9); }
.ans-right { display: flex; align-items: center; gap: 8px; }
.ans-time { font-size: 9px; color: var(--mu); }
.ans-chevron { font-size: 10px; color: var(--mu); transition: transform .2s; line-height: 1; }
.ans-box.open .ans-chevron { transform: rotate(180deg); }
.ans-body { display: none; padding: 10px 12px; font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; border-top: 0; }
.ans-box.open .ans-body { display: block; }
.ans-body code { font-family: monospace; font-size: 11px; background: rgba(128,128,128,.12); padding: 1px 4px; border-radius: 3px; }
.ans-footer { display: none; gap: 5px; padding: 4px 10px 7px; }
.ans-box.open .ans-footer { display: flex; }

/* === EMPTY STATE === */
.empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 28px 16px; text-align: center; flex: 1; min-height: 180px; }
.empty-mark { width: 44px; height: 44px; border-radius: 12px; background: var(--tm); border: 1px solid var(--tr); display: flex; align-items: center; justify-content: center; }
.empty-title { font-size: 13px; font-weight: 700; }
.empty-sub { font-size: 11px; color: var(--mu); line-height: 1.5; max-width: 220px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; max-width: 260px; }
.chip { padding: 5px 10px; border-radius: var(--rp); border: 1px solid var(--tr); background: var(--ts); font-size: 10px; font-weight: 500; cursor: pointer; font-family: inherit; transition: background 150ms,border-color 150ms; }
.chip:hover { background: var(--tm); border-color: var(--t); color: var(--tb); }

/* === ACTION GROUPS === */
.agrp { border: 1px solid var(--bd); border-radius: var(--rs); overflow: hidden; background: var(--s2); }
.agrphdr { padding: 5px 10px; font-size: 10px; font-weight: 700; letter-spacing: .3px; text-transform: uppercase; color: var(--tb); border-bottom: 1px solid var(--bd); background: var(--ts); }
.aitem { display: flex; align-items: center; gap: 8px; padding: 7px 10px; font-size: 11px; cursor: pointer; border-bottom: 1px solid var(--bd); transition: background 120ms; }
.aitem:last-child { border-bottom: none; }
.aitem:hover { background: var(--ts); }
.pri { font-size: 9px; font-weight: 700; padding: 2px 5px; border-radius: 3px; }
.pri.high { background: rgba(239,68,68,.15); color: #f87171; }
.pri.medium { background: rgba(245,158,11,.15); color: #fbbf24; }
.pri.low { background: rgba(16,185,129,.15); color: #34d399; }
.drow { display: flex; align-items: center; gap: 8px; padding: 6px 10px; font-size: 11px; border-bottom: 1px solid var(--bd); }
.dtype { font-size: 9px; font-weight: 700; padding: 2px 5px; border-radius: 3px; }
.dtype.edit { background: rgba(56,189,248,.15); color: #38bdf8; }
.dtype.create { background: rgba(16,185,129,.15); color: #34d399; }
.dtype.delete { background: rgba(239,68,68,.15); color: #f87171; }
.dpath { flex: 1; font-family: monospace; font-size: 10px; }
.cacts { display: flex; gap: 6px; padding: 8px 10px; border-top: 1px solid var(--bd); }

/* === INPUT === */
.iarea { padding: 8px 10px 10px; border-top: 1px solid var(--bd); background: var(--sf); flex-shrink: 0; }
.ibox { border: 1px solid var(--tr); border-radius: var(--r); background: var(--vscode-input-background,#3c3c3c); overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.12); transition: border-color 150ms,box-shadow 150ms; }
.ibox:focus-within { border-color: var(--t); box-shadow: 0 0 0 2px rgba(11,106,118,.15); }
.ita { display: block; width: 100%; padding: 9px 12px; background: transparent; color: var(--vscode-input-foreground,#ccc); border: none; resize: none; font-family: inherit; font-size: 12px; outline: none; max-height: 120px; min-height: 40px; line-height: 1.5; }
.ifooter { display: flex; align-items: center; justify-content: space-between; padding: 5px 8px; border-top: 1px solid rgba(11,106,118,.12); gap: 6px; }
.ileft { display: flex; align-items: center; gap: 5px; flex: 1; overflow: hidden; }
.mpill { display: flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: var(--rp); border: 1px solid var(--tr); background: var(--ts); font-size: 10px; font-weight: 500; max-width: 130px; overflow: hidden; }
.mpill span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mdot { width: 6px; height: 6px; border-radius: 50%; background: var(--t); flex-shrink: 0; }
.ctxbtn { padding: 3px 7px; border-radius: var(--rp); border: 1px solid var(--bd); background: transparent; color: var(--mu); font-size: 10px; font-family: inherit; cursor: pointer; transition: all 150ms; white-space: nowrap; }
.ctxbtn:hover { border-color: var(--tr); color: var(--vscode-foreground,#fff); }
.ctxbtn.on { border-color: var(--t); background: var(--ts); color: var(--tb); font-weight: 600; }
.wfmini { padding: 2px 5px; border-radius: var(--rp); border: 1px solid var(--bd); background: var(--vscode-input-background,#3c3c3c); color: var(--mu); font-size: 10px; font-family: inherit; outline: none; cursor: pointer; max-width: 90px; transition: border-color 150ms; }
.wfmini:focus { border-color: var(--t); }
.charcnt { font-size: 9px; color: var(--mu); margin-left: auto; flex-shrink: 0; }
.charcnt.w { color: var(--warn); }
.sendbtn { background: var(--t); border: 1px solid var(--th); color: #fff; font-size: 11px; font-weight: 600; padding: 7px 16px; border-radius: 8px; cursor: pointer; transition: background 150ms,opacity 150ms; font-family: inherit; }
.sendbtn:hover { background: var(--th); }
.sendbtn:disabled { opacity: .38; cursor: not-allowed; }
</style>
</head>
<body>
<div id="layout">

<!-- ERROR BANNER -->
<div id="eb" style="display:none;position:fixed;top:0;left:0;right:0;z-index:99999;background:#c0392b;color:#fff;font-size:10px;padding:4px 8px;font-family:monospace;"></div>

<!-- DIAG STRIP (hidden in production) -->
<div id="diag" style="display:none">
  <span style="color:#0d8a9a;font-weight:bold;">DIAG</span>
  <span style="color:#aaa;">clicks: <span id="dc">0</span></span>
  <span style="color:#aaa;">md: <span id="dm">0</span></span>
  <span style="color:#aaa;">last: <span id="dl">none</span></span>
  <button onclick="document.getElementById('dc').textContent=+document.getElementById('dc').textContent+1;document.getElementById('dl').textContent='INLINE-OK'" style="margin-left:auto;background:#0b6a76;color:#fff;border:none;padding:2px 6px;border-radius:3px;font-size:9px;cursor:pointer;font-family:monospace;">TEST CLICK</button>
</div>

<!-- HEADER -->
<div class="hdr">
  <div class="hdr-logo">
    <img src="${logoUri}" alt="HybridMind" style="width:22px;height:22px;object-fit:contain;border-radius:4px;" />
    <span class="hdr-name">HybridMind</span>
  </div>
  <div class="hdr-r">
    <span class="tier-pill ${isProPlus ? 'pro-plus' : isPro ? 'pro' : 'free'}">${isProPlus ? 'PRO PLUS' : isPro ? 'PRO' : 'FREE'}</span>
    <button class="ibtn" id="clrBtn" title="Clear conversation">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 13 6"/><path d="M14 6l-1.5 8H3.5L2 6"/><path d="M6.5 6V4.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5V6"/>
      </svg>
    </button>
  </div>
</div>

<!-- STATS -->
<div class="stats">
  <div class="stat"><span class="slbl">Credits</span><span class="sval" id="stC">--</span></div>
  <div class="stat"><span class="slbl">Requests</span><span class="sval" id="stR">0 / ${isPro ? '500' : '50'}</span><div class="sbar"><div class="sfill" id="stRB"></div></div></div>
  <div class="stat"><span class="slbl">Models</span><span class="sval" id="stM">0 / ${maxModels}</span></div>
  <div class="stat"><span class="slbl">Agents</span><span class="sval" id="stA">0 / ${maxAgents}</span></div>
</div>

<!-- TABS -->
<div class="tabs">
  <button class="tab on" data-p="models">Models</button>
  <button class="tab" data-p="agents">Agents</button>
  <button class="tab" data-p="keys">Keys</button>
</div>

<!-- MODELS PANEL -->
<div id="panel-models" class="panel on">
  <div><div class="flbl">Free tier</div>
    <select class="sel" id="fmSel">
      <option value="">Add free model</option>
      <optgroup label="Top Free">
        <option value="llama-3.3-70b">Llama 3.3 70B</option>
        <option value="deepseek-r1">DeepSeek R1</option>
        <option value="qwen3-coder">Qwen3 Coder 480B</option>
        <option value="devstral">Devstral 2</option>
      </optgroup>
      <optgroup label="Fast">
        <option value="gemini-flash">Gemini 2.0 Flash</option>
        <option value="deepseek-v3">DeepSeek V3</option>
        <option value="llama-3.1-8b">Llama 3.1 8B</option>
      </optgroup>
    </select>
  </div>
  <div><div class="flbl">Premium</div>
    <select class="sel" id="pmSel" ${isPro ? '' : 'disabled'}>
      <option value="">Add premium model${isPro ? '' : ' (Pro only)'}</option>
      <optgroup label="Low Cost">
        <option value="llama-4-maverick">Llama 4 Maverick</option>
        <option value="gemini-2.0-flash">Gemini 2.0 Flash Pro</option>
        <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
      </optgroup>
      <optgroup label="Reasoning">
        <option value="o3-mini">OpenAI o3 mini</option>
        <option value="o1">OpenAI o1</option>
      </optgroup>
      <optgroup label="Coding">
        <option value="gpt-codex">GPT Codex Mini</option>
        <option value="claude-sonnet-4.5">Claude Sonnet 4.5</option>
      </optgroup>
      <optgroup label="Flagship">
        <option value="gpt-4.1">GPT 4.1</option>
        <option value="claude-sonnet-4">Claude Sonnet 4</option>
        <option value="claude-opus-4">Claude Opus 4</option>
        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
        <option value="grok-3">Grok 3</option>
      </optgroup>
    </select>
  </div>
  <div id="tagWrap" class="tagwrap"></div>
  ${!isPro ? '<button class="upbtn" id="upBtn">Upgrade to Pro \u2014 unlock premium models</button>' : ''}
</div>



<!-- AGENTS PANEL -->
<div id="panel-agents" class="panel">
  ${maxAgents === 0 ? `
  <div class="freebanner">Agent teams are a Pro feature. Upgrade to use specialist agents.</div>
  <button class="upbtn" id="agUpBtn">Upgrade to unlock Agent Teams</button>
  ` : `
  <div class="agctr"><span class="agctrlbl">Active agents</span><span class="agctrval" id="agCtrVal">0 / ${maxAgents}</span></div>
  <div id="agSlots" class="agslots"></div>
  <button class="btn btn-t btn-full" id="agAddBtn" style="margin-top:4px;">+ Add Agent</button>
  <div id="agPicker" class="ag-picker">
    <input class="ag-search" id="agSearch" placeholder="Filter agents..." autocomplete="off" />
    <div id="agList" class="ag-list"></div>
  </div>
  <div class="fc-sep"></div>
  <div class="fc-hdr" id="fcToggle">
    <span class="fc-title">Flowchart</span>
    <span class="fc-chev" id="fcChev">&#9662;</span>
  </div>
  <div id="fcBody" class="fc-body">
    <div class="fc-tabs">
      <button class="fc-tab on" data-fc="build">Build Steps</button>
      <button class="fc-tab" data-fc="upload">Upload Image</button>
    </div>
    <div id="fcBuilderArea" style="display:flex;flex-direction:column;gap:4px;">
      <div id="fcNodeList" class="fc-nodes"></div>
      <div class="fc-add-row">
        <button class="fc-addbtn" data-type="step">+ Step</button>
        <button class="fc-addbtn" data-type="decision">⬦ Decision</button>
        <button class="fc-addbtn" data-type="end">■ End</button>
      </div>
      <div class="fc-svg-wrap"><svg id="fcSvg" style="width:100%;display:block;"></svg></div>
    </div>
    <div id="fcUploadArea" style="display:none;flex-direction:column;gap:5px;align-items:center;">
      <label class="btn btn-full" style="cursor:pointer;justify-content:center;">Choose Image / SVG<input type="file" id="fcFileInput" accept="image/*,.svg" style="display:none;" /></label>
      <div id="fcFileName" style="font-size:10px;color:var(--mu);word-break:break-all;text-align:center;">No file selected</div>
    </div>
    <div style="display:flex;gap:5px;">
      <button class="btn btn-t btn-sm" id="fcApply" style="flex:1;">Apply</button>
      <button class="btn btn-sm" id="fcClear" style="flex:1;display:none;">Clear</button>
    </div>
    <div id="fcStatus" style="font-size:10px;color:var(--ok);display:none;text-align:center;padding:2px 0;"></div>
  </div>
  <div class="fc-sep"></div>
  <div id="autoBlock" style="display:none;flex-direction:column;gap:8px;">
    <div class="flbl" style="margin-bottom:2px;">Agentic Settings</div>
    <div class="autogrid">
      <div class="autoopt ${this._autonomyLevel === 1 ? 'on' : ''}" data-lv="1"><div class="anum">1</div><div class="aname">Advisory</div></div>
      <div class="autoopt ${this._autonomyLevel === 2 ? 'on' : ''}" data-lv="2"><div class="anum">2</div><div class="aname">Assisted</div></div>
      <div class="autoopt ${this._autonomyLevel === 3 ? 'on' : ''}" data-lv="3"><div class="anum">3</div><div class="aname">Full Auto</div></div>
    </div>
    <div class="togrow" id="roRow">
      <span class="toglbl">Read only mode</span>
      <span id="roSw" class="togsw ${this._readOnly ? 'on' : ''}"><span class="togthumb"></span></span>
    </div>
    <div><div class="flbl" style="margin-bottom:4px;">Permissions</div>
      <div class="pgrid">
        <label class="prow"><input type="checkbox" class="pcb" data-perm="read" ${this._permissions.read ? 'checked' : ''}><span>Read files</span></label>
        <label class="prow"><input type="checkbox" class="pcb" data-perm="edit" ${this._permissions.edit ? 'checked' : ''}><span>Edit files</span></label>
        <label class="prow"><input type="checkbox" class="pcb" data-perm="terminal" ${this._permissions.terminal ? 'checked' : ''}><span>Terminal</span></label>
        <label class="prow"><input type="checkbox" class="pcb" data-perm="create" ${this._permissions.create ? 'checked' : ''}><span>Create files</span></label>
        <label class="prow"><input type="checkbox" class="pcb" data-perm="delete" ${this._permissions.delete ? 'checked' : ''}><span>Delete files</span></label>
        <label class="prow"><input type="checkbox" class="pcb" data-perm="multi-step" ${this._permissions['multi-step'] ? 'checked' : ''}><span>Multi step</span></label>
        <label class="prow"><input type="checkbox" class="pcb" data-perm="restructure" ${this._permissions.restructure ? 'checked' : ''}><span>Restructure</span></label>
        <label class="prow"><input type="checkbox" class="pcb" data-perm="network" ${this._permissions.network ? 'checked' : ''}><span>Network</span></label>
      </div>
    </div>
  </div>
  `}
</div>

<!-- KEYS PANEL -->
<div id="panel-keys" class="panel">
  <div class="flbl">Bring your own API key</div>
  <select class="sel" id="byokProv">
    <option value="">Select provider</option>
    <option value="openai">OpenAI</option>
    <option value="anthropic">Anthropic</option>
    <option value="google">Google</option>
    <option value="deepseek">DeepSeek</option>
    <option value="groq">Groq</option>
    <option value="openrouter">OpenRouter</option>
  </select>
  <input class="inp" type="password" id="byokKey" placeholder="Paste API key">
  <div class="brow">
    <button class="btn btn-t" id="byokSave" style="flex:1;">Save Key</button>
    <button class="btn" id="byokVerify" style="flex:1;">Verify</button>
  </div>
  <div id="byokStat" class="bstat">No key saved.</div>
</div>

<!-- RALPH -->
<div id="ralphPanel" class="ralph">
  <div class="ralph-hdr">
    <span class="ralph-ttl">Ralph Live Stream</span>
    <button id="killRalph" class="btn btn-sm" style="background:var(--err);border-color:var(--err);color:#fff;display:none;">Stop</button>
  </div>
  <div id="ralphRows" class="ralph-rows"></div>
</div>

<!-- MESSAGES -->
<div class="msgs" id="msgs"></div>

<!-- INPUT -->
<div class="iarea">
  <div class="ibox">
    <textarea class="ita" id="msgTA" placeholder="Ask HybridMind anything..." rows="1"></textarea>
    <div class="ifooter">
      <div class="ileft">
        <div class="mpill"><span class="mdot"></span><span id="amlbl">Llama 3.3 70B</span></div>
        <button class="ctxbtn" id="ctxBtn">Context off</button>
        <select class="wfmini" id="wfMini"><option value="single">Single</option><option value="parallel">Parallel</option><option value="chain">Chain</option><option value="agentic">Agentic</option><option value="all-to-all">All to All</option></select>
      </div>
      <span class="charcnt" id="charcnt"></span>
      <button class="sendbtn" id="sendBtn">Send</button>
    </div>
  </div>
</div>

</div><!-- end #layout -->
<script>
(function(){
var vsc=acquireVsCodeApi();
<script>window.HM_CONFIG={alv:${this._autonomyLevel||3},ro:${this._readOnly},isPro:${isPro},maxModels:${maxModels},maxAgents:${maxAgents},perms:{read:${this._permissions.read},edit:${this._permissions.edit},terminal:${this._permissions.terminal},create:${this._permissions.create},del:${this._permissions.delete},multi:${this._permissions['multi-step']},restructure:${this._permissions.restructure},network:${this._permissions.network}}};</script>
<script src="${scriptUri}"></script>
</body>
</html>`;
    console.log('[HybridMind] Generated HTML length:', html.length);
    return html;
  }
}
/**
 * Generate a random nonce for CSP
 */
function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
