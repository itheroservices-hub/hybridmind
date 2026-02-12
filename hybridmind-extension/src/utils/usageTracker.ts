/**
 * Usage Tracker - Monitors API usage and shows status
 */

import * as vscode from 'vscode';

export class UsageTracker {
  private statusBarItem: vscode.StatusBarItem;
  private usagePercent: number = 0;
  private costPercent: number = 0;
  private tier: string = 'free';
  private warningShown: boolean = false;

  constructor() {
    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      99 // Right before HybridMind status (100)
    );
    this.statusBarItem.command = 'hybridmind.showUsageDetails';
    this.updateDisplay();
  }

  /**
   * Update usage from response headers
   */
  public updateFromHeaders(headers: any): void {
    // Parse usage from headers
    const usagePercent = parseInt(headers['x-usage-percent'] || '0');
    const costPercent = parseInt(headers['x-cost-percent'] || '0');
    const tier = headers['x-usage-tier'] || 'free';
    const usageWarning = headers['x-usage-warning'] === 'true';
    const costWarning = headers['x-cost-warning'] === 'true';

    this.usagePercent = usagePercent;
    this.costPercent = costPercent;
    this.tier = tier;

    this.updateDisplay();

    // Show warnings
    if ((usageWarning || costWarning) && !this.warningShown) {
      this.showUpgradePrompt();
      this.warningShown = true;
    }
  }

  /**
   * Update status bar display
   */
  private updateDisplay(): void {
    const maxPercent = Math.max(this.usagePercent, this.costPercent);
    
    // Choose icon based on usage
    let icon = '$(pulse)';
    let color = undefined;

    if (maxPercent >= 90) {
      icon = '$(alert)';
      color = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (maxPercent >= 80) {
      icon = '$(warning)';
      color = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else if (maxPercent >= 60) {
      icon = '$(eye)';
    }

    this.statusBarItem.text = `${icon} Usage: ${maxPercent}%`;
    this.statusBarItem.tooltip = this.buildTooltip();
    this.statusBarItem.backgroundColor = color;
    this.statusBarItem.show();
  }

  /**
   * Build detailed tooltip
   */
  private buildTooltip(): string {
    const lines = [
      '**HybridMind Usage**',
      '',
      `Tier: ${this.tier === 'free' ? 'Free 🆓' : 'Pro 💎'}`,
      `Requests: ${this.usagePercent}% of hourly limit`,
      `Cost: ${this.costPercent}% of daily budget`,
      '',
      'Click for details'
    ];

    if (this.tier === 'free' && (this.usagePercent >= 60 || this.costPercent >= 60)) {
      lines.push('', '💡 Upgrade to Pro for 10x higher limits!');
    }

    return lines.join('\n');
  }

  /**
   * Show upgrade prompt when approaching limits
   */
  private async showUpgradePrompt(): Promise<void> {
    const maxPercent = Math.max(this.usagePercent, this.costPercent);
    
    if (this.tier === 'free' && maxPercent >= 80) {
      const message = maxPercent >= 90
        ? `⚠️ You've used ${maxPercent}% of your free tier limits!`
        : `You're at ${maxPercent}% usage. Running low on free tier limits.`;

      const action = await vscode.window.showWarningMessage(
        message,
        '💎 Upgrade to Pro',
        'View Usage',
        'Dismiss'
      );

      if (action === '💎 Upgrade to Pro') {
        vscode.commands.executeCommand('hybridmind.manageLicense');
      } else if (action === 'View Usage') {
        vscode.commands.executeCommand('hybridmind.showUsageDetails');
      }
    }
  }

  /**
   * Reset warning flag (call hourly)
   */
  public resetWarning(): void {
    this.warningShown = false;
  }

  /**
   * Get status bar item for disposal
   */
  public getStatusBarItem(): vscode.StatusBarItem {
    return this.statusBarItem;
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.statusBarItem.dispose();
  }
}
