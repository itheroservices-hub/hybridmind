/**
 * HybridMind v1.1 - License Manager
 * Handles Pro subscription verification and feature gating
 */

import * as vscode from 'vscode';

export type LicenseTier = 'free' | 'pro' | 'pro-plus' | 'enterprise';

export interface LicenseStatus {
  valid: boolean;
  tier: LicenseTier;
  expiresAt?: Date;
  features: string[];
}

// Secret storage keys. Namespaced so they don't collide with anything else
// an extension might stash in the same SecretStorage.
const SECRET_USER_API_KEY = 'hybridmind.secrets.userApiKey';
const SECRET_USER_API_PROVIDER = 'hybridmind.secrets.userApiProvider';

export class LicenseManager {
  private static instance: LicenseManager;
  private licenseKey: string | null = null;
  private tier: LicenseTier = 'free';
  private lastVerified: Date | null = null;
  private verificationCache: LicenseStatus | null = null;
  private readonly CACHE_DURATION = 3600000; // 1 hour

  // optional user-supplied API key (BYOK) and provider name.
  // Source of truth is vscode.SecretStorage, not plaintext settings — see
  // initialize()/setUserApiKey(). These fields are just an in-memory cache
  // so getApiHeaders() can stay synchronous.
  private userApiKey: string | null = null;
  private userApiProvider: string | null = null;
  private context: vscode.ExtensionContext | null = null;
  private initialized = false;

  private constructor() {
    this.loadLicenseFromSettings();
  }

  /**
   * Pass the extension context the first time this is called (normally in
   * activate()). Later calls elsewhere in the extension can omit it since
   * the singleton is already constructed.
   */
  public static getInstance(context?: vscode.ExtensionContext): LicenseManager {
    if (!LicenseManager.instance) {
      LicenseManager.instance = new LicenseManager();
    }
    if (context && !LicenseManager.instance.context) {
      LicenseManager.instance.context = context;
    }
    return LicenseManager.instance;
  }

  /**
   * Loads the BYOK key from SecretStorage. Must be called once (and awaited)
   * during activation, after getInstance(context), before anything reads
   * getApiHeaders()/userApiKey. Safe to call more than once.
   */
  async initialize(): Promise<void> {
    if (this.initialized || !this.context) {
      return;
    }
    this.initialized = true;
    const storedKey = await this.context.secrets.get(SECRET_USER_API_KEY);
    const storedProvider = await this.context.secrets.get(SECRET_USER_API_PROVIDER);
    if (storedKey) {
      this.userApiKey = storedKey;
      this.userApiProvider = storedProvider || this.userApiProvider;
    }
  }

  private loadLicenseFromSettings() {
    const config = vscode.workspace.getConfiguration('hybridmind');
    this.licenseKey = config.get('licenseKey') || null;

    // Optimistically set tier from the key so isPro() is correct synchronously.
    // The async verifyLicense() call will confirm or downgrade if the key is invalid.
    if (this.licenseKey) {
      const k = this.licenseKey.toLowerCase();
      if (k.includes('enterprise')) { this.tier = 'enterprise'; }
      else if (k.includes('proplus') || k.includes('pro-plus') || k.includes('pro_plus')) { this.tier = 'pro-plus'; }
      else { this.tier = 'pro'; }
    }
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
      const response = await fetch('http://localhost:3000/license/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: licenseToVerify })
      });

      if (!response.ok) {
        console.error('License verification failed:', response.status);
        return this.getFreeStatus();
      }

      const data = await response.json() as { valid: boolean; tier: string; expiresAt?: string };

      if (data.valid && ['pro', 'pro-plus', 'enterprise'].includes(data.tier)) {
        this.tier = data.tier as LicenseTier;
        this.licenseKey = licenseToVerify;
        this.lastVerified = new Date();
        
        const status: LicenseStatus = {
          valid: true,
          tier: this.tier,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
          features: this.getFeaturesForTier(this.tier)
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
    switch (this.tier) {
      case 'enterprise': return 10;
      case 'pro-plus': return 6;
      case 'pro': return 4;
      default: return 2;
    }
  }

  getContextLimit(): number {
    switch (this.tier) {
      case 'enterprise': return 2000000;  // 2M
      case 'pro-plus': return 1000000;    // 1M
      case 'pro': return 128000;          // 128K
      default: return 8000;               // 8K
    }
  }

  getRateLimit(): number {
    switch (this.tier) {
      case 'enterprise': return 5000;   // 5K per hour
      case 'pro-plus': return 1000;     // 1K per hour
      case 'pro': return 200;           // 200 per hour
      default: return 20;               // 20 per hour
    }
  }

  /**
   * Maximum number of agent slots allowed for the current tier. Used by
   * the sidebar UI and when validating configuration changes.
   */
  maxAgentSlots(): number {
    switch (this.tier) {
      case 'enterprise': return 10;
      case 'pro-plus': return 8;
      case 'pro': return 4;
      default: return 0; // free tier has no agent slots
    }
  }

  /**
   * Whether the user may create agent teams / workflows in the UI.
   * Only Pro Plus and Enterprise allow multiple agent teams.
   */
  allowsTeamCreation(): boolean {
    return this.tier === 'pro-plus' || this.tier === 'enterprise';
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

  private getProPlusFeatures(): string[] {
    return [
      ...this.getProFeatures(),
      '6-model-chains',
      'context-1m',
      'priority-routing',
      'team-collaboration',
      'api-access',
      'extended-history',
      'batch-processing'
    ];
  }

  private getEnterpriseFeatures(): string[] {
    return [
      ...this.getProPlusFeatures(),
      '10-model-chains',
      'context-2m',
      'sla-guarantee',
      'white-label',
      'custom-integration',
      'dedicated-account-manager',
      'unlimited-tokens'
    ];
  }

  private getFeaturesForTier(tier: LicenseTier): string[] {
    switch (tier) {
      case 'enterprise': return this.getEnterpriseFeatures();
      case 'pro-plus': return this.getProPlusFeatures();
      case 'pro': return this.getProFeatures();
      default: return this.getFreeFeatures();
    }
  }

  async checkFeatureAccess(feature: string): Promise<boolean> {
    const status = await this.verifyLicense();
    return status.features.includes(feature);
  }

  isPro(): boolean {
    return this.tier !== 'free';
  }

  isProPlus(): boolean {
    return this.tier === 'pro-plus' || this.tier === 'enterprise';
  }

  isEnterprise(): boolean {
    return this.tier === 'enterprise';
  }

  getTier(): LicenseTier {
    return this.tier;
  }

  /**
   * Get license key for API requests
   */
  getLicenseKey(): string | null {
    return this.licenseKey;
  }

  /**
   * Get headers for API requests (includes license if available)
   */
  getApiHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.licenseKey) {
      headers['X-License-Key'] = this.licenseKey;
    }

    if (this.userApiKey) {
      // BYOK: the user's own provider key. Deliberately NOT sent as
      // `Authorization` — that header is reserved for license/session auth
      // (see X-License-Key above) to avoid a future collision if a remote
      // backend is ever reintroduced.
      headers['X-User-Provider-Key'] = this.userApiKey;
      headers['X-User-Api-Provider'] = this.userApiProvider || '';
    }

    return headers;
  }

  /**
   * True if a BYOK key is currently set, without exposing the key itself.
   * Callers that only need to know "is BYOK configured" (e.g. an MCP server
   * definition deciding whether to attach a presence flag) should use this
   * rather than reading the openrouterApiKey setting directly — that
   * setting is cleared by the SecretStorage migration for anyone who has
   * ever used BYOK, so checking it directly goes stale.
   */
  hasUserApiKey(): boolean {
    return !!this.userApiKey;
  }

  /**
   * Store a user-provided API key (BYOK) in vscode.SecretStorage — never
   * in plaintext settings. Used by the "HybridMind: Set API Key (BYOK)"
   * command and the sidebar's inline BYOK panel.
   */
  async setUserApiKey(provider: string, key: string): Promise<void> {
    this.userApiProvider = provider;
    this.userApiKey = key;
    if (!this.context) {
      console.error('LicenseManager.setUserApiKey called before context was set; key was not persisted to SecretStorage.');
      return;
    }
    await this.context.secrets.store(SECRET_USER_API_KEY, key);
    await this.context.secrets.store(SECRET_USER_API_PROVIDER, provider);
  }

  /**
   * Clear the stored BYOK key (used by the migration path when it needs to
   * roll back, and available for a future "forget key" command).
   */
  async clearUserApiKey(): Promise<void> {
    this.userApiKey = null;
    this.userApiProvider = null;
    if (this.context) {
      await this.context.secrets.delete(SECRET_USER_API_KEY);
      await this.context.secrets.delete(SECRET_USER_API_PROVIDER);
    }
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
    switch (this.tier) {
      case 'enterprise': return '$(organization) HybridMind Enterprise';
      case 'pro-plus': return '$(rocket) HybridMind Pro Plus';
      case 'pro': return '$(star-full) HybridMind Pro';
      default: return 'HybridMind Free';
    }
  }
}
