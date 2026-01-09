# HybridMind v1.1 - Chat UI Panel Design

## 1. Panel Architecture

### 1.1 VS Code Integration
```typescript
// Panel registration in extension.ts
const chatPanel = vscode.window.createWebviewPanel(
  'hybridmindChat',
  'HybridMind Chat',
  vscode.ViewColumn.Two,
  {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
  }
);
```

**Panel Placement:**
- Default: Right sidebar (View Container)
- Alternative: Side panel (ViewColumn.Two)
- User can dock/undock to any position
- Persists state across VS Code sessions

### 1.2 Layout Structure
```
┌─────────────────────────────────────┐
│ ⚡ HybridMind Chat        [−] [×]   │ ← Header
├─────────────────────────────────────┤
│ ┌─┬─┬─┬─┐                          │
│ │GPT│Cla│Gem│DS │ ← Model Tabs     │ ← Model Selector
│ └─┴─┴─┴─┘      [⚙️] [🔄] [🗑️]      │
├─────────────────────────────────────┤
│                                     │
│  👤 User:                           │
│  Explain this function...           │
│                                     │
│  🤖 GPT-4.5 Turbo:                  │
│  This function implements...        │ ← Message History
│  [📋 Copy] [📌 Pin] [↻ Retry]      │
│                                     │
│  👤 User:                           │
│  Now refactor it...                 │
│                                     │
│  🤖 Claude 3.5 Sonnet:              │
│  ▌                                  │ ← Streaming indicator
│                                     │
├─────────────────────────────────────┤
│ Context: 2.4k/8k tokens             │ ← Status bar
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ Type your message...            │ │ ← Input area
│ └─────────────────────────────────┘ │
│ [Explain] [Refactor] [Generate]     │ ← Quick actions
│ [Debug] [Chain ✨] [Test] [Summary] │
└─────────────────────────────────────┘
```

## 2. Model Selector Component

### 2.1 Tab Design
```typescript
interface ModelTab {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'deepseek' | 'groq';
  tier: 'free' | 'pro';
  available: boolean;
  selected: boolean;
  contextWindow: number;
}

const modelTabs: ModelTab[] = [
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4.5',
    provider: 'openai',
    tier: 'pro',
    available: false, // Locked for free users
    selected: true,
    contextWindow: 128000
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5',
    provider: 'anthropic',
    tier: 'pro',
    available: false,
    selected: false,
    contextWindow: 200000
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini Pro',
    provider: 'google',
    tier: 'pro',
    available: false,
    selected: false,
    contextWindow: 2000000
  },
  {
    id: 'deepseek-chat',
    name: 'DeepSeek',
    provider: 'deepseek',
    tier: 'free',
    available: true,
    selected: false,
    contextWindow: 8000
  }
];
```

### 2.2 Tab Visual States

**Free Tier (2 models):**
```
┌─────┬─────┬─────────┬─────────┐
│ GPT │ Cla │ Gemini  │DeepSeek │
│  🔒 │  🔒 │   🔒    │    ✓    │
└─────┴─────┴─────────┴─────────┘
    ↑     ↑      ↑          ↑
  Locked Locked Locked  Available
```

**Pro Tier (4 models):**
```
┌─────┬─────┬─────────┬─────────┐
│ GPT │ Cla │ Gemini  │DeepSeek │
│ ● ✓│  ✓  │   ✓     │    ✓    │
└─────┴─────┴─────────┴─────────┘
   ↑
Selected (green dot indicator)
```

### 2.3 Tab Interaction Logic
```typescript
async function handleTabClick(tabId: string) {
  const tab = modelTabs.find(t => t.id === tabId);
  
  if (!tab.available) {
    // Premium model locked
    showUpgradeModal({
      title: `${tab.name} requires HybridMind Pro`,
      features: [
        `Access to ${tab.name}`,
        `${(tab.contextWindow / 1000).toFixed(0)}k token context`,
        'Priority inference speed',
        'Advanced agentic workflows'
      ],
      price: '$19/month',
      cta: 'Upgrade to Pro'
    });
    return;
  }
  
  // Switch active model
  modelTabs.forEach(t => t.selected = false);
  tab.selected = true;
  
  // Update conversation context
  conversationContext.activeModel = tab.id;
  conversationContext.contextLimit = tab.contextWindow;
  
  // Visual feedback
  updateTabUI();
  appendSystemMessage(`Switched to ${tab.name}`);
}
```

## 3. Message History Component

### 3.1 Message Types
```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  timestamp: Date;
  tokens?: number;
  cost?: number;
  streaming?: boolean;
  error?: string;
  metadata?: {
    codeBlocks?: CodeBlock[];
    pinnedAt?: Date;
    retryCount?: number;
    chainStep?: number;
    chainTotal?: number;
  };
}

interface CodeBlock {
  language: string;
  code: string;
  lineStart?: number;
  lineEnd?: number;
  filePath?: string;
}
```

### 3.2 Message Rendering
```html
<!-- User Message -->
<div class="message user-message">
  <div class="message-header">
    <span class="avatar">👤</span>
    <span class="role">You</span>
    <span class="timestamp">2:34 PM</span>
  </div>
  <div class="message-content">
    Explain this React hook
  </div>
</div>

<!-- Assistant Message (GPT-4.5) -->
<div class="message assistant-message">
  <div class="message-header">
    <span class="avatar">🤖</span>
    <span class="model-badge openai">GPT-4.5 Turbo</span>
    <span class="timestamp">2:34 PM</span>
    <span class="token-count">324 tokens • $0.003</span>
  </div>
  <div class="message-content markdown-body">
    This React hook implements...
    
    <pre><code class="language-typescript">
    const [state, setState] = useState(null);
    </code></pre>
  </div>
  <div class="message-actions">
    <button class="action-btn" title="Copy">📋 Copy</button>
    <button class="action-btn" title="Pin">📌 Pin</button>
    <button class="action-btn" title="Retry">↻ Retry</button>
    <button class="action-btn" title="Apply to File">✏️ Apply</button>
  </div>
</div>

<!-- Streaming Message -->
<div class="message assistant-message streaming">
  <div class="message-header">
    <span class="avatar">🤖</span>
    <span class="model-badge anthropic">Claude 3.5 Sonnet</span>
    <span class="streaming-indicator">▌</span>
  </div>
  <div class="message-content">
    Let me refactor this code for better performance...▌
  </div>
</div>

<!-- Agentic Chain Message -->
<div class="message chain-message">
  <div class="message-header">
    <span class="avatar">⚡</span>
    <span class="chain-badge">Agentic Chain</span>
    <span class="progress">Step 2/3</span>
  </div>
  <div class="chain-trace">
    <div class="chain-step complete">
      <span class="step-icon">✓</span>
      <span class="step-name">1. Refactor Code</span>
      <span class="step-model">GPT-4.5</span>
    </div>
    <div class="chain-step running">
      <span class="step-icon">▶</span>
      <span class="step-name">2. Add Comments</span>
      <span class="step-model">Claude 3.5</span>
    </div>
    <div class="chain-step pending">
      <span class="step-icon">○</span>
      <span class="step-name">3. Generate Tests</span>
      <span class="step-model">DeepSeek</span>
    </div>
  </div>
</div>

<!-- Error Message -->
<div class="message error-message">
  <div class="message-header">
    <span class="avatar">⚠️</span>
    <span class="error-badge">Error</span>
  </div>
  <div class="message-content">
    Rate limit exceeded for GPT-4.5. Please try again in 30s.
  </div>
  <div class="message-actions">
    <button class="action-btn">↻ Retry</button>
    <button class="action-btn">Switch Model</button>
  </div>
</div>
```

### 3.3 Syntax Highlighting
```typescript
// Use VS Code's built-in syntax highlighter
function renderCodeBlock(code: string, language: string): string {
  return vscode.workspace.openTextDocument({
    content: code,
    language: language
  }).then(doc => {
    // Get themed HTML from VS Code
    return vscode.commands.executeCommand(
      'vscode.renderMarkdown',
      `\`\`\`${language}\n${code}\n\`\`\``
    );
  });
}
```

## 4. Quick Action Buttons

### 4.1 Button Layout
```html
<div class="quick-actions">
  <button class="action-btn primary" data-action="explain">
    <span class="icon">💡</span>
    Explain
  </button>
  <button class="action-btn primary" data-action="refactor">
    <span class="icon">🔧</span>
    Refactor
  </button>
  <button class="action-btn primary" data-action="generate">
    <span class="icon">✨</span>
    Generate
  </button>
  <button class="action-btn primary" data-action="debug">
    <span class="icon">🐛</span>
    Debug
  </button>
  <button class="action-btn premium" data-action="chain">
    <span class="icon">⚡</span>
    Chain
    <span class="pro-badge">PRO</span>
  </button>
  <button class="action-btn primary" data-action="test">
    <span class="icon">🧪</span>
    Test
  </button>
  <button class="action-btn primary" data-action="summarize">
    <span class="icon">📝</span>
    Summary
  </button>
</div>
```

### 4.2 Action Handler Logic
```typescript
async function handleQuickAction(action: string) {
  const editor = vscode.window.activeTextEditor;
  const selection = editor?.selection;
  const selectedText = editor?.document.getText(selection);
  
  // Check if code is selected
  if (!selectedText || selectedText.trim().length === 0) {
    vscode.window.showWarningMessage('Please select code first');
    return;
  }
  
  // Check premium gating
  if (action === 'chain') {
    const hasAccess = await licenseManager.checkFeatureAccess('agentic-chains');
    if (!hasAccess) {
      showUpgradeModal({
        title: 'Agentic Chains require Pro',
        features: [
          'Multi-step autonomous workflows',
          'Cross-model orchestration',
          'Automatic error recovery',
          'Advanced context management'
        ],
        price: '$19/month'
      });
      return;
    }
  }
  
  // Build prompt based on action
  const prompts = {
    explain: `Explain this code in detail:\n\n${selectedText}`,
    refactor: `Refactor this code for better readability and performance:\n\n${selectedText}`,
    generate: `Generate similar code following this pattern:\n\n${selectedText}`,
    debug: `Find and fix bugs in this code:\n\n${selectedText}`,
    test: `Generate unit tests for this code:\n\n${selectedText}`,
    summarize: `Summarize what this code does:\n\n${selectedText}`,
    chain: null // Opens chain selector
  };
  
  if (action === 'chain') {
    showChainSelector(selectedText);
  } else {
    sendMessage(prompts[action], { autoFocus: true });
  }
}
```

### 4.3 Chain Selector Modal
```html
<div class="chain-selector-modal">
  <div class="modal-header">
    <h3>⚡ Select Agentic Chain</h3>
    <button class="close-btn">×</button>
  </div>
  
  <div class="chain-presets">
    <div class="chain-preset" data-chain="refactor-comment-test">
      <div class="chain-icon">🔧📝🧪</div>
      <div class="chain-info">
        <h4>Refactor → Comment → Test</h4>
        <p>Improve code, add docs, generate tests</p>
        <span class="chain-steps">3 steps • GPT + Claude + DeepSeek</span>
      </div>
    </div>
    
    <div class="chain-preset" data-chain="explain-optimize-document">
      <div class="chain-icon">💡⚡📚</div>
      <div class="chain-info">
        <h4>Explain → Optimize → Document</h4>
        <p>Understand, improve performance, create docs</p>
        <span class="chain-steps">3 steps • Claude + GPT + Gemini</span>
      </div>
    </div>
    
    <div class="chain-preset" data-chain="multi-model-review">
      <div class="chain-icon">👁️👁️👁️</div>
      <div class="chain-info">
        <h4>Multi-Model Code Review</h4>
        <p>Get perspectives from 3 different models</p>
        <span class="chain-steps">3 steps • GPT + Claude + Gemini</span>
      </div>
    </div>
    
    <div class="chain-preset custom" data-chain="custom">
      <div class="chain-icon">⚙️</div>
      <div class="chain-info">
        <h4>Custom Chain</h4>
        <p>Build your own workflow</p>
        <span class="chain-steps">Design your own</span>
      </div>
    </div>
  </div>
  
  <div class="modal-footer">
    <button class="btn secondary">Cancel</button>
    <button class="btn primary">Run Chain</button>
  </div>
</div>
```

## 5. Context Window Management

### 5.1 Token Counter Component
```html
<div class="context-status">
  <div class="context-bar">
    <div class="context-fill" style="width: 30%"></div>
  </div>
  <div class="context-text">
    <span class="tokens-used">2,432</span> / 
    <span class="tokens-limit">8,000</span> tokens
    <span class="context-badge free">Free Tier</span>
  </div>
</div>
```

### 5.2 Context Warning States
```typescript
interface ContextState {
  used: number;
  limit: number;
  percentage: number;
  state: 'safe' | 'warning' | 'critical';
}

function getContextState(used: number, limit: number): ContextState {
  const percentage = (used / limit) * 100;
  
  let state: 'safe' | 'warning' | 'critical';
  if (percentage < 70) state = 'safe';
  else if (percentage < 90) state = 'warning';
  else state = 'critical';
  
  return { used, limit, percentage, state };
}

function renderContextWarning(state: ContextState) {
  if (state.state === 'warning') {
    return `
      <div class="context-warning">
        ⚠️ Approaching context limit (${state.percentage.toFixed(0)}%)
        <button onclick="summarizeConversation()">Summarize</button>
      </div>
    `;
  }
  
  if (state.state === 'critical') {
    return `
      <div class="context-critical">
        🚨 Context limit reached! Oldest messages will be removed.
        <button onclick="upgradeContext()">Upgrade to 128k PRO</button>
      </div>
    `;
  }
  
  return '';
}
```

### 5.3 Auto-Summarization Logic
```typescript
async function handleContextOverflow() {
  const isPro = licenseManager.isPro();
  
  if (isPro) {
    // Pro users: 128k context, unlikely to overflow
    // Just show warning
    showNotification('warning', 'Conversation is very long. Consider starting a new chat.');
    return;
  }
  
  // Free users: Auto-summarize oldest messages
  const oldMessages = conversation.messages.slice(0, -10); // Keep last 10
  const recentMessages = conversation.messages.slice(-10);
  
  const summaryPrompt = `
    Summarize this conversation history in 200 tokens or less:
    ${oldMessages.map(m => `${m.role}: ${m.content}`).join('\n')}
  `;
  
  const summary = await getModelResponse('gpt-3.5-turbo', summaryPrompt);
  
  // Replace old messages with summary
  conversation.messages = [
    {
      id: generateId(),
      role: 'system',
      content: `Previous conversation summary: ${summary}`,
      timestamp: new Date()
    },
    ...recentMessages
  ];
  
  updateTokenCount();
  showNotification('info', 'Conversation summarized to stay within limits');
}
```

## 6. Premium Upgrade Modal

### 6.1 Modal Design
```html
<div class="upgrade-modal" id="upgradeModal">
  <div class="modal-overlay"></div>
  <div class="modal-container">
    <div class="modal-header">
      <h2>🚀 Upgrade to HybridMind Pro</h2>
      <button class="close-btn">×</button>
    </div>
    
    <div class="modal-content">
      <div class="feature-locked">
        <div class="lock-icon">🔒</div>
        <h3>This feature requires Pro</h3>
      </div>
      
      <div class="features-grid">
        <div class="feature-item">
          <span class="feature-icon">✅</span>
          <span class="feature-text">GPT-4.5, Claude 3.5, Gemini Pro</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">✅</span>
          <span class="feature-text">128k token context windows</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">✅</span>
          <span class="feature-text">Agentic multi-step workflows</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">✅</span>
          <span class="feature-text">Fast inference optimization</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">✅</span>
          <span class="feature-text">Priority 24/7 support</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">✅</span>
          <span class="feature-text">Early access to new features</span>
        </div>
      </div>
      
      <div class="pricing-section">
        <div class="price-tag">
          <span class="price-amount">$19</span>
          <span class="price-period">/month</span>
        </div>
        <div class="price-subtext">
          Cancel anytime • 7-day free trial
        </div>
      </div>
    </div>
    
    <div class="modal-footer">
      <button class="btn secondary" onclick="closeModal()">
        Maybe Later
      </button>
      <button class="btn primary gradient" onclick="startUpgrade()">
        Start Free Trial
      </button>
    </div>
    
    <div class="modal-trust">
      <span>🔒 Secure payment via Stripe</span>
      <span>•</span>
      <span>💳 No commitment required</span>
    </div>
  </div>
</div>
```

### 6.2 Modal Trigger Logic
```typescript
interface UpgradeModalConfig {
  title: string;
  features: string[];
  price: string;
  cta: string;
  source?: string; // Analytics tracking
}

function showUpgradeModal(config: UpgradeModalConfig) {
  const modal = document.getElementById('upgradeModal');
  
  // Update modal content
  modal.querySelector('h3').textContent = config.title;
  
  // Track which feature triggered upgrade prompt
  analytics.track('upgrade_prompt_shown', {
    source: config.source,
    tier: licenseManager.getTier()
  });
  
  // Show modal with animation
  modal.classList.add('visible');
  
  // Focus on primary CTA
  modal.querySelector('.btn.primary').focus();
}

function startUpgrade() {
  // Track conversion funnel
  analytics.track('upgrade_clicked', {
    source: currentUpgradeSource
  });
  
  // Open Stripe checkout
  vscode.env.openExternal(
    vscode.Uri.parse('https://hybridmind.dev/checkout?plan=pro&trial=true')
  );
}
```

## 7. Streaming & Loading States

### 7.1 Streaming Implementation
```typescript
async function streamModelResponse(model: string, prompt: string) {
  const messageId = generateId();
  
  // Add placeholder message
  addMessage({
    id: messageId,
    role: 'assistant',
    content: '',
    model: model,
    streaming: true,
    timestamp: new Date()
  });
  
  const response = await fetch(`http://127.0.0.1:${serverPort}/run/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt })
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  
  while (true) {
    const { done, value } = await reader.read();
    
    if (done) break;
    
    const chunk = decoder.decode(value);
    fullContent += chunk;
    
    // Update message content in real-time
    updateMessage(messageId, {
      content: fullContent,
      streaming: true
    });
    
    // Auto-scroll to bottom
    scrollToBottom();
  }
  
  // Mark streaming complete
  updateMessage(messageId, {
    streaming: false
  });
  
  // Calculate tokens
  const tokens = estimateTokens(prompt, fullContent);
  const cost = estimateCost(model, tokens);
  
  updateMessage(messageId, {
    tokens,
    cost
  });
}
```

### 7.2 Loading Indicators
```html
<!-- Typing Indicator -->
<div class="typing-indicator">
  <span class="dot"></span>
  <span class="dot"></span>
  <span class="dot"></span>
</div>

<!-- Chain Progress -->
<div class="chain-progress">
  <div class="progress-bar">
    <div class="progress-fill" style="width: 66%"></div>
  </div>
  <div class="progress-text">
    Running step 2 of 3...
  </div>
</div>

<!-- Model Thinking -->
<div class="thinking-indicator">
  <span class="spinner">🤔</span>
  <span class="text">Claude is thinking...</span>
</div>
```

## 8. Keyboard Shortcuts

### 8.1 Shortcut Mappings
```typescript
const shortcuts = {
  'Ctrl+Enter': () => sendMessage(),
  'Ctrl+L': () => clearChat(),
  'Ctrl+K': () => focusInput(),
  'Ctrl+M': () => toggleModelSelector(),
  'Ctrl+Shift+C': () => copyLastResponse(),
  'Ctrl+Shift+E': () => handleQuickAction('explain'),
  'Ctrl+Shift+R': () => handleQuickAction('refactor'),
  'Ctrl+Shift+T': () => handleQuickAction('test'),
  'Esc': () => closeModal()
};

function registerShortcuts() {
  document.addEventListener('keydown', (e) => {
    const key = [
      e.ctrlKey ? 'Ctrl' : '',
      e.shiftKey ? 'Shift' : '',
      e.altKey ? 'Alt' : '',
      e.key
    ].filter(Boolean).join('+');
    
    const handler = shortcuts[key];
    if (handler) {
      e.preventDefault();
      handler();
    }
  });
}
```

### 8.2 Accessibility Features
```html
<!-- ARIA labels -->
<div role="log" aria-live="polite" aria-label="Chat messages">
  <!-- Messages rendered here -->
</div>

<input 
  type="text" 
  role="textbox" 
  aria-label="Message input"
  aria-multiline="true"
  aria-required="true"
/>

<button 
  role="button" 
  aria-label="Send message"
  aria-keyshortcuts="Ctrl+Enter"
>
  Send
</button>

<!-- Keyboard navigation hints -->
<div class="keyboard-hints" aria-label="Keyboard shortcuts">
  <span><kbd>Ctrl+Enter</kbd> Send</span>
  <span><kbd>Ctrl+L</kbd> Clear</span>
  <span><kbd>Esc</kbd> Close</span>
</div>
```

## 9. State Management

### 9.1 Conversation State
```typescript
interface ConversationState {
  id: string;
  title: string;
  messages: ChatMessage[];
  activeModel: string;
  contextUsed: number;
  contextLimit: number;
  tier: 'free' | 'pro';
  createdAt: Date;
  updatedAt: Date;
  pinned: boolean;
}

class ConversationManager {
  private conversations: Map<string, ConversationState> = new Map();
  private activeConversationId: string | null = null;
  
  createConversation(): ConversationState {
    const conv: ConversationState = {
      id: generateId(),
      title: 'New Chat',
      messages: [],
      activeModel: 'deepseek-chat',
      contextUsed: 0,
      contextLimit: licenseManager.isPro() ? 128000 : 8000,
      tier: licenseManager.getTier(),
      createdAt: new Date(),
      updatedAt: new Date(),
      pinned: false
    };
    
    this.conversations.set(conv.id, conv);
    this.activeConversationId = conv.id;
    
    return conv;
  }
  
  addMessage(message: ChatMessage) {
    const conv = this.getActive();
    conv.messages.push(message);
    conv.updatedAt = new Date();
    
    // Auto-generate title from first message
    if (conv.messages.length === 1 && message.role === 'user') {
      conv.title = message.content.slice(0, 50) + '...';
    }
    
    // Update token count
    conv.contextUsed = this.calculateTokens(conv.messages);
    
    this.saveState();
  }
  
  private calculateTokens(messages: ChatMessage[]): number {
    return messages.reduce((sum, msg) => {
      return sum + (msg.tokens || estimateTokens(msg.content));
    }, 0);
  }
  
  private saveState() {
    // Persist to VS Code global state
    const state = Array.from(this.conversations.entries());
    vscode.context.globalState.update('hybridmind.conversations', state);
  }
  
  loadState() {
    const saved = vscode.context.globalState.get('hybridmind.conversations');
    if (saved) {
      this.conversations = new Map(saved);
    }
  }
}
```

### 9.2 Message Persistence
```typescript
// Save conversation to disk
async function exportConversation(conversationId: string) {
  const conv = conversationManager.get(conversationId);
  
  const markdown = `# ${conv.title}\n\n` +
    conv.messages.map(msg => {
      const role = msg.role === 'user' ? '**You**' : `**${msg.model}**`;
      return `${role}:\n${msg.content}\n\n`;
    }).join('---\n\n');
  
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(`${conv.title}.md`),
    filters: { 'Markdown': ['md'] }
  });
  
  if (uri) {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(markdown, 'utf8'));
  }
}
```

## 10. Error Handling & Edge Cases

### 10.1 Network Errors
```typescript
async function handleNetworkError(error: Error, context: string) {
  let userMessage = '';
  let recovery: (() => void) | null = null;
  
  if (error.message.includes('ECONNREFUSED')) {
    userMessage = 'Cannot connect to AI service. Check your internet connection.';
    recovery = () => retryLastMessage();
  } else if (error.message.includes('timeout')) {
    userMessage = 'Request timed out. The model may be overloaded.';
    recovery = () => switchToFasterModel();
  } else if (error.message.includes('429')) {
    userMessage = 'Rate limit exceeded. Please wait a moment.';
    recovery = () => scheduleRetry(30000); // 30s
  } else if (error.message.includes('401')) {
    userMessage = 'API key invalid or missing. Check your settings.';
    recovery = () => openSettings();
  } else {
    userMessage = `Error: ${error.message}`;
  }
  
  addMessage({
    id: generateId(),
    role: 'system',
    content: userMessage,
    error: error.message,
    timestamp: new Date()
  });
  
  if (recovery) {
    showRecoveryButton(recovery);
  }
}
```

### 10.2 Edge Cases

**Empty Input:**
```typescript
function validateInput(input: string): boolean {
  const trimmed = input.trim();
  
  if (trimmed.length === 0) {
    showToast('error', 'Please enter a message');
    return false;
  }
  
  if (trimmed.length > 50000) {
    showToast('error', 'Message too long. Max 50,000 characters.');
    return false;
  }
  
  return true;
}
```

**Concurrent Requests:**
```typescript
let isProcessing = false;

async function sendMessage(content: string) {
  if (isProcessing) {
    showToast('warning', 'Please wait for current request to complete');
    return;
  }
  
  isProcessing = true;
  try {
    await processMessage(content);
  } finally {
    isProcessing = false;
  }
}
```

**Session Expiry:**
```typescript
async function checkSessionValidity() {
  const lastActivity = conversationManager.getActive().updatedAt;
  const hoursSinceActivity = (Date.now() - lastActivity.getTime()) / 3600000;
  
  if (hoursSinceActivity > 24) {
    const resume = await vscode.window.showInformationMessage(
      'Your session has expired. Start a new conversation?',
      'New Chat',
      'Resume Anyway'
    );
    
    if (resume === 'New Chat') {
      conversationManager.createConversation();
    }
  }
}
```

## 11. Analytics & Telemetry

### 11.1 Event Tracking
```typescript
interface AnalyticsEvent {
  event: string;
  properties: Record<string, any>;
  timestamp: Date;
  userId?: string;
  tier: 'free' | 'pro';
}

const analyticsEvents = {
  // User actions
  'chat_message_sent': { model: string, tokens: number },
  'model_switched': { from: string, to: string },
  'action_clicked': { action: string, hasSelection: boolean },
  'chain_executed': { chainType: string, steps: number },
  
  // Conversion events
  'upgrade_prompt_shown': { source: string },
  'upgrade_clicked': { source: string },
  'trial_started': {},
  'subscription_activated': {},
  
  // Engagement
  'conversation_started': {},
  'conversation_exported': {},
  'message_pinned': {},
  'code_applied': {},
  
  // Errors
  'error_occurred': { type: string, message: string },
  'rate_limit_hit': { model: string },
  'context_overflow': { tokens: number }
};

function track(event: string, properties: Record<string, any> = {}) {
  const payload: AnalyticsEvent = {
    event,
    properties,
    timestamp: new Date(),
    tier: licenseManager.getTier()
  };
  
  // Send to analytics service (respecting privacy settings)
  if (vscode.workspace.getConfiguration('hybridmind').get('telemetry')) {
    sendToAnalytics(payload);
  }
}
```

## 12. UI/UX Polish Details

### 12.1 Animations
```css
/* Message fade-in */
@keyframes messageSlideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message {
  animation: messageSlideIn 0.2s ease-out;
}

/* Streaming cursor blink */
@keyframes cursorBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.streaming-indicator {
  animation: cursorBlink 1s infinite;
}

/* Modal slide-up */
@keyframes modalSlideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.upgrade-modal.visible .modal-container {
  animation: modalSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### 12.2 Theme Integration
```typescript
// Sync with VS Code theme
function applyVSCodeTheme() {
  const theme = vscode.window.activeColorTheme;
  
  const colors = {
    background: theme.kind === vscode.ColorThemeKind.Dark 
      ? '#1e1e1e' 
      : '#ffffff',
    foreground: theme.kind === vscode.ColorThemeKind.Dark 
      ? '#cccccc' 
      : '#333333',
    accent: theme.kind === vscode.ColorThemeKind.Dark 
      ? '#007acc' 
      : '#0066cc'
  };
  
  document.documentElement.style.setProperty('--vscode-bg', colors.background);
  document.documentElement.style.setProperty('--vscode-fg', colors.foreground);
  document.documentElement.style.setProperty('--vscode-accent', colors.accent);
}

vscode.window.onDidChangeActiveColorTheme(applyVSCodeTheme);
```

### 12.3 Responsive Layout
```css
/* Adapt to panel width */
.chat-panel {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100vh;
}

/* Compact mode for narrow panels */
@media (max-width: 400px) {
  .model-tabs {
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
  }
  
  .quick-actions {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .message-actions {
    flex-direction: column;
  }
}
```

## 13. Implementation Checklist

### Phase 1: Core UI (Week 3)
- [ ] Create ChatPanel webview component
- [ ] Implement message rendering with markdown
- [ ] Add model tab selector with free/pro gating
- [ ] Build input area with send button
- [ ] Add basic styling matching VS Code theme

### Phase 2: Interactions (Week 3-4)
- [ ] Implement streaming message updates
- [ ] Add quick action buttons with handlers
- [ ] Build context counter and warning system
- [ ] Create upgrade modal component
- [ ] Add keyboard shortcuts

### Phase 3: Advanced Features (Week 4)
- [ ] Integrate ChainEngine for agentic workflows
- [ ] Build chain selector modal with presets
- [ ] Add chain progress visualization
- [ ] Implement conversation persistence
- [ ] Add export/import functionality

### Phase 4: Polish (Week 4)
- [ ] Add animations and transitions
- [ ] Implement error handling with recovery
- [ ] Add accessibility features (ARIA, kbd nav)
- [ ] Optimize performance (virtual scrolling)
- [ ] Add analytics tracking

## 14. Missing Considerations

### 14.1 Multi-Tab Conversations
Support multiple conversation tabs like browser tabs:
```typescript
interface ConversationTab {
  id: string;
  title: string;
  active: boolean;
  unsavedChanges: boolean;
}

// Tab bar at top
<div class="conversation-tabs">
  <div class="tab active">Chat 1</div>
  <div class="tab">Code Review</div>
  <div class="tab">+ New</div>
</div>
```

### 14.2 Voice Input
Add speech-to-text for hands-free coding:
```typescript
const recognition = new webkitSpeechRecognition();
recognition.continuous = true;
recognition.interimResults = true;

function startVoiceInput() {
  recognition.start();
  recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript;
    updateInputField(transcript);
  };
}
```

### 14.3 Code Diff Preview
Show before/after diffs for refactoring suggestions:
```html
<div class="diff-view">
  <div class="diff-before">
    <pre><code>// Old code</code></pre>
  </div>
  <div class="diff-after">
    <pre><code>// New code</code></pre>
  </div>
</div>
```

### 14.4 Collaborative Features
Share conversations with team members:
```typescript
async function shareConversation(id: string) {
  const shareLink = await generateShareLink(id);
  vscode.env.clipboard.writeText(shareLink);
  showToast('success', 'Share link copied!');
}
```

### 14.5 Offline Mode
Cache recent conversations for offline access:
```typescript
const cache = new ConversationCache();
cache.store(conversationId, messages);

// When offline
if (!navigator.onLine) {
  const cached = cache.get(conversationId);
  showOfflineMode(cached);
}
```
