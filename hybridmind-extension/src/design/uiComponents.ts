/**
 * Modular UI Components for HybridMind
 * Clean, reusable components following the design system
 */

import { designSystem } from './designSystem';

export class UIComponents {
  /**
   * Model Selector Component
   */
  static modelSelector(models: any[], selectedModels: string[], maxModels: number, isPro: boolean): string {
    return `
<div class="model-selector-container">
  <div class="flex items-center justify-between" style="margin-bottom: 12px;">
    <label class="text-sm font-medium" style="color: #0b6a76;">
      AI Models
    </label>
    <span class="badge ${isPro ? 'badge-tier-pro' : 'badge-tier-free'}">
      ${maxModels} Models Max
    </span>
  </div>
  
  <div class="grid grid-cols-2 gap-2">
    ${models.map((model, index) => this.modelCheckbox(model, selectedModels.includes(model.id), index >= maxModels && !isPro)).join('')}
  </div>
  
  <div class="text-xs" style="margin-top: 8px; opacity: 0.7;">
    ${selectedModels.length} of ${maxModels} selected
  </div>
</div>`;
  }

  /**
   * Model Checkbox Component
   */
  static modelCheckbox(model: any, checked: boolean, disabled: boolean): string {
    const badgeType = model.tier === 'free' ? 'badge-tier-free' : model.tier === 'premium' ? 'badge-tier-pro' : 'badge-tier-pro-plus';
    
    return `
<label class="checkbox-wrapper ${disabled ? 'disabled' : ''}" style="${disabled ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
  <input 
    type="checkbox" 
    class="checkbox" 
    value="${model.id}" 
    ${checked ? 'checked' : ''}
    ${disabled ? 'disabled' : ''}
    onchange="handleModelToggle(this)"
  />
  <div class="flex flex-col" style="flex: 1; gap: 2px;">
    <div class="flex items-center gap-1">
      <span class="text-sm">${model.name}</span>
      <span class="badge ${badgeType}" style="font-size: 8px; padding: 1px 4px;">
        ${model.tier === 'free' ? 'FREE' : model.tier === 'premium' ? 'PRO' : 'PRO+'}
      </span>
    </div>
    <span class="text-xs" style="opacity: 0.7;">${model.provider}</span>
  </div>
</label>`;
  }

  /**
   * Workflow Mode Selector Component
   */
  static workflowSelector(currentMode: string): string {
    const modes = [
      { value: 'single', label: 'Single Model', icon: '🤖', desc: 'One AI processes the task' },
      { value: 'parallel', label: 'Parallel', icon: '⚡', desc: 'Multiple AIs work simultaneously' },
      { value: 'chain', label: 'Chain', icon: '🔗', desc: 'AIs work in sequence' },
      { value: 'agentic', label: 'Agentic', icon: '🎯', desc: 'Autonomous multi-step execution' }
    ];

    return `
<div class="workflow-selector-container">
  <label class="text-sm font-medium" style="color: #0b6a76; margin-bottom: 8px; display: block;">
    Workflow Mode
  </label>
  
  <select class="select" id="workflowSelect" onchange="handleWorkflowChange(this)">
    ${modes.map(mode => `
      <option value="${mode.value}" ${currentMode === mode.value ? 'selected' : ''}>
        ${mode.icon} ${mode.label} - ${mode.desc}
      </option>
    `).join('')}
  </select>
</div>`;
  }

  /**
   * Chain Template Selector Component
   */
  static chainTemplateSelector(currentTemplate: string | null): string {
    const templates = [
      { id: 'coding-standard', name: 'Coding Standard', cost: 'Medium', speed: 'Fast', icon: '🚀' },
      { id: 'coding-premium', name: 'Coding Premium', cost: 'High', speed: 'Slow', icon: '⭐' },
      { id: 'coding-budget', name: 'Coding Budget', cost: 'Low', speed: 'Ultra-fast', icon: '⚡' },
      { id: 'research-deep', name: 'Research Deep', cost: 'High', speed: 'Slow', icon: '🔍' },
      { id: 'review-comprehensive', name: 'Review', cost: 'High', speed: 'Slow', icon: '✅' },
      { id: 'quick-fix', name: 'Quick Fix', cost: 'Very low', speed: 'Instant', icon: '⚡' }
    ];

    return `
<div class="chain-template-container">
  <label class="text-sm font-medium" style="color: #0b6a76; margin-bottom: 8px; display: block;">
    Chain Template
  </label>
  
  <div class="grid grid-cols-2 gap-2">
    ${templates.map(template => `
      <div 
        class="card card-hover ${currentTemplate === template.id ? 'card-primary' : ''}" 
        style="padding: 12px; cursor: pointer; ${currentTemplate === template.id ? 'border-color: #0b6a76; background: rgba(11, 106, 118, 0.05);' : ''}"
        onclick="selectTemplate('${template.id}')"
      >
        <div class="text-lg" style="margin-bottom: 4px;">${template.icon}</div>
        <div class="text-sm font-semibold" style="margin-bottom: 4px;">${template.name}</div>
        <div class="flex justify-between text-xs" style="opacity: 0.7;">
          <span>💰 ${template.cost}</span>
          <span>⚡ ${template.speed}</span>
        </div>
      </div>
    `).join('')}
  </div>
</div>`;
  }

  /**
   * Message Component
   */
  static message(message: any): string {
    const isUser = message.role === 'user';
    
    return `
<div class="message-wrapper animate-slide-in">
  <div class="message ${isUser ? 'message-user' : 'message-assistant'}">
    <div class="message-header flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold">${isUser ? '👤 You' : '🤖 ' + (message.model || 'Assistant')}</span>
        ${!isUser && message.model ? `<span class="badge badge-primary text-xs">${message.model}</span>` : ''}
      </div>
      <span class="text-xs" style="opacity: 0.5;">${new Date(message.timestamp).toLocaleTimeString()}</span>
    </div>
    
    <div class="message-content">
      ${this.formatMessageContent(message.content)}
    </div>
    
    ${message.tokens || message.cost ? `
      <div class="message-footer flex items-center gap-3 text-xs" style="margin-top: 8px; opacity: 0.6;">
        ${message.tokens ? `<span>📊 ${message.tokens} tokens</span>` : ''}
        ${message.cost ? `<span>💰 $${message.cost.toFixed(4)}</span>` : ''}
      </div>
    ` : ''}
  </div>
</div>`;
  }

  /**
   * Format message content with code blocks
   */
  static formatMessageContent(content: string): string {
    // Simple code block detection
    return content
      .replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<div class="code-block-wrapper">
          <div class="code-block-header flex items-center justify-between">
            <span class="text-xs">${lang || 'code'}</span>
            <button class="btn-ghost btn-sm" onclick="copyCode(this)" data-code="${this.escapeHtml(code)}">
              📋 Copy
            </button>
          </div>
          <pre class="code-block"><code class="language-${lang || 'text'}">${this.escapeHtml(code)}</code></pre>
        </div>`;
      })
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  }

  /**
   * Empty State Component
   */
  static emptyState(isPro: boolean): string {
    return `
<div class="empty-state flex flex-col items-center justify-center" style="flex: 1; padding: 40px 20px;">
  <div class="text-3xl" style="margin-bottom: 16px;">🤖</div>
  <h2 class="text-lg font-semibold" style="color: #0b6a76; margin-bottom: 8px;">
    Welcome to HybridMind
  </h2>
  <p class="text-sm" style="opacity: 0.7; text-align: center; max-width: 300px;">
    Multi-model AI assistant for VS Code. Select models and start chatting!
  </p>
  
  <div class="suggestions space-y-2" style="margin-top: 24px; width: 100%; max-width: 400px;">
    <div class="card card-hover" style="cursor: pointer; padding: 12px;" onclick="sendSuggestion('Explain the selected code')">
      <div class="text-sm font-medium">💡 Explain selected code</div>
      <div class="text-xs" style="opacity: 0.7; margin-top: 4px;">Get detailed explanation</div>
    </div>
    
    <div class="card card-hover" style="cursor: pointer; padding: 12px;" onclick="sendSuggestion('Add comments to this code')">
      <div class="text-sm font-medium">📝 Add comments</div>
      <div class="text-xs" style="opacity: 0.7; margin-top: 4px;">Document your code</div>
    </div>
    
    <div class="card card-hover" style="cursor: pointer; padding: 12px;" onclick="sendSuggestion('Find bugs in this code')">
      <div class="text-sm font-medium">🐛 Find bugs</div>
      <div class="text-xs" style="opacity: 0.7; margin-top: 4px;">AI code review</div>
    </div>
    
    ${isPro ? `
    <div class="card card-hover" style="cursor: pointer; padding: 12px; border-left: 3px solid #0b6a76;" onclick="sendSuggestion('Refactor this code with best practices')">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium">⚡ Refactor code</span>
        <span class="badge badge-tier-pro">PRO</span>
      </div>
      <div class="text-xs" style="opacity: 0.7; margin-top: 4px;">Multi-model optimization</div>
    </div>
    ` : ''}
  </div>
</div>`;
  }

  /**
   * Loading Indicator Component
   */
  static loadingIndicator(model: string): string {
    return `
<div class="loading-indicator animate-slide-in">
  <div class="card" style="padding: 12px;">
    <div class="flex items-center gap-3">
      <div class="loading-spinner"></div>
      <div class="flex flex-col gap-1">
        <span class="text-sm font-medium">${model} is thinking...</span>
        <span class="text-xs" style="opacity: 0.7;">Processing your request</span>
      </div>
    </div>
  </div>
</div>

<style>
.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(11, 106, 118, 0.2);
  border-top-color: #0b6a76;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>`;
  }

  /**
   * Upgrade Banner Component
   */
  static upgradeBanner(): string {
    return `
<div class="upgrade-banner-modern card" style="
  background: linear-gradient(135deg, #0b6a76 0%, #084a54 100%);
  color: white;
  padding: 16px;
  margin: 12px 16px;
  cursor: pointer;
  border: none;
" onclick="handleUpgrade()">
  <div class="flex items-center gap-3">
    <div class="text-2xl">⭐</div>
    <div class="flex flex-col gap-1">
      <div class="text-lg font-bold">Upgrade to Pro</div>
      <div class="text-sm" style="opacity: 0.9;">
        4 models, premium chains, agentic mode
      </div>
      <div class="text-xs" style="opacity: 0.8; margin-top: 4px;">
        ✨ o1 reasoning • 🚀 Qwen coding • 💎 Claude review
      </div>
    </div>
  </div>
</div>`;
  }

  /**
   * Escape HTML for security
   */
  static escapeHtml(text: string): string {
    const map: {[key: string]: string} = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}
