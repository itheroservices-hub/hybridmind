/**
 * Change Tracker - Tracks file modifications during autonomous execution
 * Provides diff preview and accept/reject functionality
 */

import * as vscode from 'vscode';
import * as fs from 'fs';

export interface FileChange {
  filePath: string;
  uri: vscode.Uri;
  originalContent: string;
  newContent: string;
  changeType: 'edit' | 'create' | 'delete';
  timestamp: Date;
}

export class ChangeTracker {
  private changes: Map<string, FileChange> = new Map();
  private backupFolder: vscode.Uri | null = null;

  /**
   * Initialize tracker and create backup folder
   */
  async initialize(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    // Create .hybridmind/backups folder
    this.backupFolder = vscode.Uri.joinPath(
      workspaceFolders[0].uri,
      '.hybridmind',
      'backups',
      new Date().getTime().toString()
    );

    try {
      await vscode.workspace.fs.createDirectory(this.backupFolder);
    } catch (error) {
      console.error('Failed to create backup folder:', error);
    }
  }

  /**
   * Track a file before modification
   */
  async trackFileChange(
    filePath: string,
    changeType: 'edit' | 'create' | 'delete'
  ): Promise<void> {
    const uri = vscode.Uri.file(filePath);
    let originalContent = '';

    // For edits and deletes, save original content
    if (changeType === 'edit' || changeType === 'delete') {
      try {
        const content = await vscode.workspace.fs.readFile(uri);
        originalContent = Buffer.from(content).toString('utf8');

        // Backup the original file
        if (this.backupFolder) {
          const fileName = filePath.split(/[/\\]/).pop() || 'unnamed';
          const backupUri = vscode.Uri.joinPath(this.backupFolder, fileName);
          await vscode.workspace.fs.writeFile(backupUri, content);
        }
      } catch (error) {
        // File doesn't exist yet (create operation)
        originalContent = '';
      }
    }

    this.changes.set(filePath, {
      filePath,
      uri,
      originalContent,
      newContent: '', // Will be updated after change
      changeType,
      timestamp: new Date()
    });
  }

  /**
   * Update tracked file with new content after modification
   */
  async updateFileContent(filePath: string): Promise<void> {
    const change = this.changes.get(filePath);
    if (!change) {
      return;
    }

    try {
      const content = await vscode.workspace.fs.readFile(change.uri);
      change.newContent = Buffer.from(content).toString('utf8');
    } catch (error) {
      change.newContent = '';
    }
  }

  /**
   * Get all tracked changes
   */
  getChanges(): FileChange[] {
    return Array.from(this.changes.values());
  }

  /**
   * Get summary of changes
   */
  getSummary(): string {
    const changes = this.getChanges();
    if (changes.length === 0) {
      return 'No file changes were made.';
    }

    const edits = changes.filter(c => c.changeType === 'edit').length;
    const creates = changes.filter(c => c.changeType === 'create').length;
    const deletes = changes.filter(c => c.changeType === 'delete').length;

    let summary = `Modified ${changes.length} file(s):\n`;
    if (edits > 0) summary += `  • ${edits} edited\n`;
    if (creates > 0) summary += `  • ${creates} created\n`;
    if (deletes > 0) summary += `  • ${deletes} deleted\n`;

    return summary;
  }

  /**
   * Show diff for a specific file
   */
  async showDiff(filePath: string): Promise<void> {
    const change = this.changes.get(filePath);
    if (!change) {
      vscode.window.showErrorMessage(`No tracked changes for ${filePath}`);
      return;
    }

    // Create temporary file for original content
    const originalUri = vscode.Uri.parse(
      `untitled:${filePath.split(/[/\\]/).pop()}.original`
    );

    // Open diff editor
    await vscode.commands.executeCommand(
      'vscode.diff',
      originalUri,
      change.uri,
      `${change.filePath.split(/[/\\]/).pop()} (Original ↔ Modified)`
    );

    // Set content of original document
    const originalDoc = await vscode.workspace.openTextDocument(originalUri);
    const edit = new vscode.WorkspaceEdit();
    edit.insert(originalUri, new vscode.Position(0, 0), change.originalContent);
    await vscode.workspace.applyEdit(edit);
  }

  /**
   * Accept all changes (clear tracking)
   */
  acceptAll(): void {
    vscode.window.showInformationMessage(
      `✅ Accepted ${this.changes.size} file change(s)`
    );
    this.changes.clear();
  }

  /**
   * Reject all changes (revert files)
   */
  async rejectAll(): Promise<void> {
    const changes = this.getChanges();
    
    for (const change of changes) {
      try {
        if (change.changeType === 'create') {
          // Delete the created file
          await vscode.workspace.fs.delete(change.uri);
        } else if (change.changeType === 'edit') {
          // Restore original content
          const content = Buffer.from(change.originalContent, 'utf8');
          await vscode.workspace.fs.writeFile(change.uri, content);
        } else if (change.changeType === 'delete') {
          // Restore deleted file
          const content = Buffer.from(change.originalContent, 'utf8');
          await vscode.workspace.fs.writeFile(change.uri, content);
        }
      } catch (error) {
        console.error(`Failed to revert ${change.filePath}:`, error);
      }
    }

    vscode.window.showInformationMessage(
      `↩️ Reverted ${changes.length} file change(s)`
    );
    this.changes.clear();
  }

  /**
   * Clear all tracked changes without reverting
   */
  clear(): void {
    this.changes.clear();
  }
}
