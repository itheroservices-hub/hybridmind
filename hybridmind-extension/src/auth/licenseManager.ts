/**
 * HybridMind v1.1 - License Manager
 * Handles Pro subscription verification and feature gating
 */

import * as vscode from 'vscode';

export type LicenseTier = 'free' | 'pro';

export interface LicenseStatus {
  valid: boolean;
  tier: LicenseTier;
  expiresAt?: Date;
  features: string[];
}

export class LicenseManager {
  private static instance: LicenseManager;
  private licenseKey: string | null = null;
  private tier: LicenseTier = 'free';
  private lastVerified: Date | null = null;
  private verificationCache: LicenseStatus | null = null;
  private readonly CACHE_DURATION = 3600000; // 1 hour

  private constructor() {
    this.loadLicenseFromSettings();
  }

  public static getInstance(): LicenseManager {
    if (!LicenseManager.instance) {
      LicenseManager.instance = new LicenseManager();
    }
    return LicenseManager.instance;
  }

  private loadLicenseFromSettings() {
    const config = vscode.workspace.getConfiguration('hybridmind');
    this.licenseKey = config.get('licenseKey') || null;
  }

  async verifyLicense(key?: string): Promise<LicenseStatus> {
    const licenseToVerify = key || this.licenseKey;

    if (!licenseToVerify) {
      return this.getFreeStatus();
    }

    // Check cache
    if (this.verificationCache && this.isCacheValid()) {
      return this.verificationCache;
    }

    try {
      const response = await fetch('https://api.hybridmind.dev/v1/license/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: licenseToVerify })
      });

      if (!response.ok) {
        console.error('License verification failed:', response.status);
        return this.getFreeStatus();
      }

      const data = await response.json() as { valid: boolean; tier: string; expiresAt?: string };

      if (data.valid && data.tier === 'pro') {
        this.tier = 'pro';
        this.licenseKey = licenseToVerify;
        this.lastVerified = new Date();
        
        const status: LicenseStatus = {
          valid: true,
          tier: 'pro',
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
          features: this.getProFeatures()
        };

        this.verificationCache = status;
        
        // Save to settings if this is a new key
        if (key) {
          await this.saveLicenseToSettings(key);
        }

        return status;
      }

      return this.getFreeStatus();

    } catch (error) {
      console.error('License verification error:', error);
      return this.getFreeStatus();
    }
  }



  async canUseFeature(feature: string): Promise<boolean> {
    const status = await this.verifyLicense();
    return status.features.includes(feature);
  }



  getModelLimit(): number {
    return this.tier === 'pro' ? 4 : 2;
  }

  getContextLimit(): number {
    return this.tier === 'pro' ? 128000 : 8000;
  }

  getRateLimit(): number {
    return this.tier === 'pro' ? 1000 : 100; // requests per hour
  }

  private isCacheValid(): boolean {
    if (!this.lastVerified) return false;
    const now = new Date().getTime();
    const lastCheck = this.lastVerified.getTime();
    return (now - lastCheck) < this.CACHE_DURATION;
  }

  private getFreeStatus(): LicenseStatus {
    return {
      valid: true,
      tier: 'free',
      features: this.getFreeFeatures()
    };
  }

  private getFreeFeatures(): string[] {
    return [
      'basic-models',
      'chat-window',
      'single-step-workflows',
      'code-explanation',
      'code-review',
      'basic-refactoring',
      'standard-speed',
      'context-8k'
    ];
  }

  private getProFeatures(): string[] {
    return [
      'basic-models',
      'premium-models',
      'all-models',
      'chat-window',
      'multi-step-autonomous',
      'agentic-chains',
      'code-explanation',
      'code-review',
      'advanced-refactoring',
      'ultra-fast-inference',
      'large-context',
      'context-128k',
      'priority-support',
      '4-model-chains',
      'advanced-workflows'
    ];
  }

  async checkFeatureAccess(feature: string): Promise<boolean> {
    const status = await this.verifyLicense();
    return status.features.includes(feature);
  }

  isPro(): boolean {
    return this.tier === 'pro';
  }

  getTier(): LicenseTier {
    return this.tier;
  }

  async promptForUpgrade(featureName: string): Promise<void> {
    const action = await vscode.window.showInformationMessage(
      `${featureName} requires HybridMind Pro ($19/month)`,
      'Upgrade Now',
      'Learn More',
      'Maybe Later'
    );

    if (action === 'Upgrade Now') {
      vscode.env.openExternal(vscode.Uri.parse('https://hybridmind.dev/pricing'));
    } else if (action === 'Learn More') {
      vscode.env.openExternal(vscode.Uri.parse('https://hybridmind.dev/features'));
    }
  }

  async activateLicense(): Promise<void> {
    const key = await vscode.window.showInputBox({
      prompt: 'Enter your HybridMind Pro license key',
      placeHolder: 'HYBRID-XXXX-XXXX-XXXX-XXXX',
      validateInput: (value) => {
        if (!value || value.length < 10) {
          return 'Please enter a valid license key';
        }
        return null;
      }
    });

    if (!key) {
      return;
    }

    vscode.window.showInformationMessage('Verifying license...');

    const status = await this.verifyLicense(key);

    if (status.valid && status.tier === 'pro') {
      vscode.window.showInformationMessage(
        '✅ HybridMind Pro activated! All premium features unlocked.'
      );
    } else {
      vscode.window.showErrorMessage(
        'Invalid license key. Please check and try again.'
      );
    }
  }

  private async saveLicenseToSettings(key: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('hybridmind');
    await config.update('licenseKey', key, vscode.ConfigurationTarget.Global);
  }

  async deactivateLicense(): Promise<void> {
    this.licenseKey = null;
    this.tier = 'free';
    this.verificationCache = null;
    
    const config = vscode.workspace.getConfiguration('hybridmind');
    await config.update('licenseKey', '', vscode.ConfigurationTarget.Global);

    vscode.window.showInformationMessage('License deactivated. Now using Free tier.');
  }

  getStatusBarText(): string {
    return this.tier === 'pro' ? '$(star-full) HybridMind Pro' : 'HybridMind Free';
  }
}
