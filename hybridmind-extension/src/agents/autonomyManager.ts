import * as vscode from 'vscode';

export enum AutonomyLevel {
  L1 = 'L1', // Ask before every action
  L2 = 'L2', // Ask before destructive actions
  L3 = 'L3'  // Full autonomy
}

export interface ToolPermissions {
  allowFileEdits: boolean;
  allowFileCreation: boolean;
  allowFileDeletion: boolean;
  allowTerminalCommands: boolean;
  allowPackageInstalls: boolean;
}

/**
 * Manages autonomy levels and permissions for agent actions
 */
export class AutonomyManager {
  private _level: AutonomyLevel = AutonomyLevel.L1;
  private _permissions: ToolPermissions = {
    allowFileEdits: false,
    allowFileCreation: false,
    allowFileDeletion: false,
    allowTerminalCommands: false,
    allowPackageInstalls: false
  };

  constructor(level?: AutonomyLevel, permissions?: Partial<ToolPermissions>) {
    if (level) {
      this._level = level;
    }
    if (permissions) {
      this._permissions = { ...this._permissions, ...permissions };
    }
  }

  /**
   * Set autonomy level
   */
  public setLevel(level: AutonomyLevel): void {
    this._level = level;
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
    // L3: Full autonomy - execute without asking (unless permission disabled)
    if (this._level === AutonomyLevel.L3) {
      return this._checkPermission(action.type);
    }

    // L2: Ask only for destructive actions
    if (this._level === AutonomyLevel.L2) {
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
      this._level = AutonomyLevel.L3;
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
      case AutonomyLevel.L1:
        return 'Conservative - Ask before every action';
      case AutonomyLevel.L2:
        return 'Balanced - Ask before destructive actions';
      case AutonomyLevel.L3:
        return 'Full Autonomy - Execute without asking';
      default:
        return 'Unknown';
    }
  }
}
