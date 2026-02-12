import * as vscode from 'vscode';
import axios from 'axios';

export enum AutonomyLevel {
  Advisory = 'L1', // Ask before every action
  Assisted = 'L2', // Ask before destructive actions
  FullAuto = 'L3'  // Full autonomy
}

export interface ToolPermissions {
  allowFileEdits: boolean;
  allowFileCreation: boolean;
  allowFileDeletion: boolean;
  allowTerminalCommands: boolean;
  allowPackageInstalls: boolean;
}

export interface GuardrailConfig {
  backendUrl?: string;
  useBackendGuardrails?: boolean;
  tier?: string;
  userId?: string;
}

/**
 * Manages autonomy levels and permissions for agent actions
 */
export class AutonomyManager {
  private _level: AutonomyLevel = AutonomyLevel.FullAuto;
  private _permissions: ToolPermissions = {
    allowFileEdits: true,
    allowFileCreation: true,
    allowFileDeletion: false,
    allowTerminalCommands: true,
    allowPackageInstalls: false
  };
  private _guardrailConfig: GuardrailConfig = {
    backendUrl: 'http://localhost:5000',
    useBackendGuardrails: true,
    tier: 'free',
    userId: 'vscode-user'
  };

  constructor(level?: AutonomyLevel, permissions?: Partial<ToolPermissions>, guardrailConfig?: GuardrailConfig) {
    this._level = level || AutonomyLevel.FullAuto;
    if (permissions) {
      this._permissions = { ...this._permissions, ...permissions };
    }
    if (guardrailConfig) {
      this._guardrailConfig = { ...this._guardrailConfig, ...guardrailConfig };
    }
  }

  /**
   * Configure guardrail settings
   */
  public configureGuardrails(config: Partial<GuardrailConfig>): void {
    this._guardrailConfig = { ...this._guardrailConfig, ...config };
  }

  /**
   * Set autonomy level
   */
  public setLevel(level: AutonomyLevel): void {
    this._level = level;
  }

  /**
   * Set permissions
   */
  public setPermissions(permissions: Partial<ToolPermissions>): void {
    this._permissions = { ...this._permissions, ...permissions };
  }

  /**
   * Request approval for action (main entry point)
   */
  public async requestApproval(action: {
    type: string;
    description: string;
    files?: string[];
    command?: string;
  }): Promise<boolean> {
    // If using backend guardrails, delegate to backend
    if (this._guardrailConfig.useBackendGuardrails) {
      return this._requestBackendApproval(action);
    }

    // Local guardrail logic (existing behavior)
    return this._requestLocalPermission(action);
  }

  /**
   * Request approval from backend guardrail system
   */
  private async _requestBackendApproval(action: {
    type: string;
    description: string;
    files?: string[];
    command?: string;
  }): Promise<boolean> {
    try {
      const actionTypeMap = {
        edit: 'edit_file',
        create: 'create_file',
        delete: 'delete_file',
        terminal: 'terminal_execute',
        install: 'package_add'
      };

      const actionType = actionTypeMap[action.type as keyof typeof actionTypeMap] || action.type;

      // Request approval from backend
      const response = await axios.post(
        `${this._guardrailConfig.backendUrl}/api/guardrails/request-approval`,
        {
          actionType,
          tier: this._guardrailConfig.tier,
          userId: this._guardrailConfig.userId,
          details: {
            description: action.description,
            filePath: action.files?.[0],
            command: action.command
          }
        },
        { timeout: 5000 }
      );

      const result = response.data.result;

      // If auto-approved, return immediately
      if (result.autoApproved && result.approved) {
        vscode.window.showInformationMessage(
          `✅ Action auto-approved: ${action.description}`
        );
        return true;
      }

      // If requires user approval
      if (!result.approved && result.approvalId) {
        // Show approval prompt to user
        return this._showBackendApprovalPrompt(result.approvalId, action);
      }

      // If denied
      if (!result.approved) {
        vscode.window.showWarningMessage(
          `❌ Action denied: ${result.deniedReason || 'Guardrail restriction'}`
        );
        return false;
      }

      return result.approved;
    } catch (error) {
      // Fallback to local permission if backend fails
      vscode.window.showWarningMessage(
        'Backend guardrails unavailable, using local permissions'
      );
      return this._requestLocalPermission(action);
    }
  }

  /**
   * Show approval prompt and wait for backend response
   */
  private async _showBackendApprovalPrompt(
    approvalId: string,
    action: any
  ): Promise<boolean> {
    const message = `🤖 Agent requests approval:\n${action.description}`;

    const choice = await vscode.window.showWarningMessage(
      message,
      { modal: true },
      'Approve',
      'Deny'
    );

    if (choice === 'Approve') {
      // Send approval to backend
      try {
        await axios.post(
          `${this._guardrailConfig.backendUrl}/api/guardrails/approve/${approvalId}`,
          { approvedBy: 'vscode-user' }
        );
        vscode.window.showInformationMessage('✅ Action approved');
        return true;
      } catch (error) {
        vscode.window.showErrorMessage('Failed to approve action');
        return false;
      }
    } else {
      // Send denial to backend
      try {
        await axios.post(
          `${this._guardrailConfig.backendUrl}/api/guardrails/deny/${approvalId}`,
          { reason: 'User denied in VS Code' }
        );
      } catch (error) {
        // Ignore denial errors
      }
      vscode.window.showWarningMessage('❌ Action denied');
      return false;
    }
  }

  /**
   * Local permission check (original behavior)
   */
  private async _requestLocalPermission(action: {
    type: string;
    description: string;
    files?: string[];
    command?: string;
  }): Promise<boolean> {
    // Implementation continues...
    const permissionType = action.type;
    
    if (!this._checkPermission(permissionType)) {
      return false;
    }

    // For high-risk actions, always ask user
    if (this._level === AutonomyLevel.Advisory || 
        (action.command && this._isDestructiveCommand(action.command))) {
      return this._askUser(action);
    }

    return true;
  }

  /**
   * Get pending approvals from backend
   */
  public async getPendingApprovals(): Promise<any[]> {
    if (!this._guardrailConfig.useBackendGuardrails) {
      return [];
    }

    try {
      const response = await axios.get(
        `${this._guardrailConfig.backendUrl}/api/guardrails/pending`,
        {
          params: { userId: this._guardrailConfig.userId },
          timeout: 5000
        }
      );

      return response.data.pending || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get guardrail statistics
   */
  public async getGuardrailStats(): Promise<any> {
    if (!this._guardrailConfig.useBackendGuardrails) {
      return null;
    }

    try {
      const response = await axios.get(
        `${this._guardrailConfig.backendUrl}/api/guardrails/statistics`,
        { timeout: 5000 }
      );

      return response.data.statistics;
    } catch (error) {
      return null;
    }
  }

  /**
   * Update permissions
   */
  public updatePermissions(permissions: Partial<ToolPermissions>): void {
    this._permissions = { ...this._permissions, ...permissions };
  }

  /**
   * Check if action requires permission based on autonomy level
   */
  public async requestPermission(action: {
    type: 'edit' | 'create' | 'delete' | 'terminal' | 'install';
    description: string;
    files?: string[];
    command?: string;
  }): Promise<boolean> {
    // FullAuto: Full autonomy - execute without asking (unless permission disabled)
    if (this._level === AutonomyLevel.FullAuto) {
      return this._checkPermission(action.type);
    }

    // Assisted: Ask only for destructive actions
    if (this._level === AutonomyLevel.Assisted) {
      const isDestructive = action.type === 'delete' || 
                            action.type === 'install' ||
                            (action.type === 'terminal' && this._isDestructiveCommand(action.command || ''));
      
      if (!isDestructive) {
        return this._checkPermission(action.type);
      }
      // Fall through to ask user
    }

    // L1 or L2 destructive action: Ask user
    return await this._askUser(action);
  }

  /**
   * Check if action is allowed by permissions
   */
  private _checkPermission(type: string): boolean {
    switch (type) {
      case 'edit':
        return this._permissions.allowFileEdits;
      case 'create':
        return this._permissions.allowFileCreation;
      case 'delete':
        return this._permissions.allowFileDeletion;
      case 'terminal':
        return this._permissions.allowTerminalCommands;
      case 'install':
        return this._permissions.allowPackageInstalls;
      default:
        return false;
    }
  }

  /**
   * Ask user for permission via modal dialog
   */
  private async _askUser(action: {
    type: string;
    description: string;
    files?: string[];
    command?: string;
  }): Promise<boolean> {
    let message = `🤖 Agent wants to ${action.description}\n\n`;
    
    if (action.files && action.files.length > 0) {
      message += `Files: ${action.files.join(', ')}\n`;
    }
    
    if (action.command) {
      message += `Command: ${action.command}\n`;
    }

    const choice = await vscode.window.showWarningMessage(
      message,
      { modal: true },
      'Allow',
      'Deny',
      'Allow All (L3)'
    );

    if (choice === 'Allow All (L3)') {
      this._level = AutonomyLevel.FullAuto;
      return true;
    }

    return choice === 'Allow';
  }

  /**
   * Detect if a command is destructive
   */
  private _isDestructiveCommand(command: string): boolean {
    const destructiveKeywords = [
      'rm ', 'del ', 'delete', 'remove',
      'drop', 'truncate',
      'format', 'wipe',
      'npm uninstall', 'yarn remove',
      '--force', '-f'
    ];

    const lower = command.toLowerCase();
    return destructiveKeywords.some(keyword => lower.includes(keyword));
  }

  /**
   * Get current autonomy level
   */
  public getLevel(): AutonomyLevel {
    return this._level;
  }

  /**
   * Get current permissions
   */
  public getPermissions(): ToolPermissions {
    return { ...this._permissions };
  }

  /**
   * Get autonomy level description
   */
  public getLevelDescription(): string {
    switch (this._level) {
      case AutonomyLevel.Advisory:
        return 'Conservative - Ask before every action';
      case AutonomyLevel.Assisted:
        return 'Balanced - Ask before destructive actions';
      case AutonomyLevel.FullAuto:
        return 'Full Autonomy - Execute without asking';
      default:
        return 'Unknown';
    }
  }
}
