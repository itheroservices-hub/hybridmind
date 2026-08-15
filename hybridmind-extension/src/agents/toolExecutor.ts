/**
 * Tool Executor - Executes JSON tool calls from AI agents
 * Handles apply_edit, insert_text, create_file, delete_file, batch, etc.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { ToolCall } from './agentClient';
import { ChangeTracker } from './changeTracker';
import { resolveWorkspacePath } from '../security/workspacePath';
import { getActiveAutonomyLevel, AutonomyLevel } from './autonomyManager';

export class ToolExecutor {
  private outputChannel: vscode.OutputChannel;
  private changeTracker: ChangeTracker | null = null;

  constructor(changeTracker?: ChangeTracker) {
    this.outputChannel = vscode.window.createOutputChannel('HybridMind Agent');
    this.changeTracker = changeTracker || null;
  }

  /**
   * Execute a tool call from the AI agent
   */
  async execute(toolCall: ToolCall): Promise<void> {
    this.log(`Executing tool: ${toolCall.tool}`);

    switch (toolCall.tool) {
      case 'apply_edit':
        await this.applyEdit(toolCall);
        break;

      case 'insert_text':
        await this.insertText(toolCall);
        break;

      case 'create_file':
        await this.createFile(toolCall);
        break;

      case 'delete_file':
        await this.deleteFile(toolCall);
        break;

      case 'batch':
        await this.executeBatch(toolCall);
        break;

      case 'thought':
        this.handleThought(toolCall);
        break;

      case 'request_clarification':
        await this.requestClarification(toolCall);
        break;

      default:
        throw new Error(`Unknown tool type: ${toolCall.tool}`);
    }
  }

  /**
   * In Advisory mode (ask before every action), confirm even a routine,
   * non-destructive file operation before it runs. Assisted and FullAuto
   * don't add this prompt, matching how AgentTools.executeCommand treats
   * autonomy level for terminal commands, only Advisory asks about
   * everything; deletion keeps its own always-on confirm below regardless
   * of level, since that one is destructive rather than routine.
   */
  private async confirmIfAdvisory(description: string): Promise<boolean> {
    if (getActiveAutonomyLevel() !== AutonomyLevel.Advisory) {
      return true;
    }
    const choice = await vscode.window.showWarningMessage(
      `HybridMind wants to: ${description}\n\nAdvisory mode asks before every action.`,
      { modal: true },
      'Approve', 'Deny'
    );
    return choice === 'Approve';
  }

  /**
   * Apply edit - Replace code at a specific location
   */
  private async applyEdit(tool: ToolCall): Promise<void> {
    if (!tool.file || !tool.start || !tool.end || tool.text === undefined) {
      throw new Error('apply_edit requires file, start, end, and text');
    }
    if (!(await this.confirmIfAdvisory(`edit ${tool.file}`))) {
      this.log(`⚠️ Edit cancelled (Advisory mode): ${tool.file}`);
      return;
    }

    const filePath = this.resolveFilePath(tool.file);
    const uri = vscode.Uri.file(filePath);

    try {
      // Track the change before modifying
      if (this.changeTracker) {
        await this.changeTracker.trackFileChange(filePath, 'edit');
      }

      // Open or get the document
      const document = await vscode.workspace.openTextDocument(uri);
      const edit = new vscode.WorkspaceEdit();

      // Create range (VS Code uses 0-based indexing)
      const range = new vscode.Range(
        tool.start.line,
        tool.start.character,
        tool.end.line,
        tool.end.character
      );

      // Apply the edit
      edit.replace(uri, range, tool.text);
      const success = await vscode.workspace.applyEdit(edit);

      if (success) {
        this.log(`✅ Applied edit to ${tool.file}`);
        await document.save();
        
        // Update tracked content after modification
        if (this.changeTracker) {
          await this.changeTracker.updateFileContent(filePath);
        }
      } else {
        throw new Error('Failed to apply edit');
      }
    } catch (error) {
      throw new Error(`Failed to apply edit to ${tool.file}: ${error}`);
    }
  }

  /**
   * Insert text - Insert code at a position
   */
  private async insertText(tool: ToolCall): Promise<void> {
    if (!tool.file || !tool.position || tool.text === undefined) {
      throw new Error('insert_text requires file, position, and text');
    }
    if (!(await this.confirmIfAdvisory(`insert text into ${tool.file}`))) {
      this.log(`⚠️ Insert cancelled (Advisory mode): ${tool.file}`);
      return;
    }

    const filePath = this.resolveFilePath(tool.file);
    const uri = vscode.Uri.file(filePath);

    try {
      // Track the change before modifying
      if (this.changeTracker) {
        await this.changeTracker.trackFileChange(filePath, 'edit');
      }

      const document = await vscode.workspace.openTextDocument(uri);
      const edit = new vscode.WorkspaceEdit();

      // Create position
      const position = new vscode.Position(
        tool.position.line,
        tool.position.character
      );

      // Insert the text
      edit.insert(uri, position, tool.text);
      const success = await vscode.workspace.applyEdit(edit);

      if (success) {
        this.log(`✅ Inserted text into ${tool.file}`);
        await document.save();
        
        // Update tracked content after modification
        if (this.changeTracker) {
          await this.changeTracker.updateFileContent(filePath);
        }
      } else {
        throw new Error('Failed to insert text');
      }
    } catch (error) {
      throw new Error(`Failed to insert text into ${tool.file}: ${error}`);
    }
  }

  /**
   * Create file - Create a new file with content
   */
  private async createFile(tool: ToolCall): Promise<void> {
    if (!tool.path) {
      throw new Error('create_file requires path');
    }
    if (!(await this.confirmIfAdvisory(`create ${tool.path}`))) {
      this.log(`⚠️ File creation cancelled (Advisory mode): ${tool.path}`);
      return;
    }

    const filePath = this.resolveFilePath(tool.path);
    const uri = vscode.Uri.file(filePath);
    const content = tool.content || '';

    try {
      // Track the change before creating
      if (this.changeTracker) {
        await this.changeTracker.trackFileChange(filePath, 'create');
      }

      const edit = new vscode.WorkspaceEdit();
      edit.createFile(uri, { overwrite: false });
      
      // Create file
      await vscode.workspace.applyEdit(edit);

      // Write content if provided
      if (content) {
        const document = await vscode.workspace.openTextDocument(uri);
        const fullEdit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(document.getText().length)
        );
        fullEdit.replace(uri, fullRange, content);
        await vscode.workspace.applyEdit(fullEdit);
        await document.save();
      }

      this.log(`✅ Created file ${tool.path}`);

      // Open the new file
      await vscode.window.showTextDocument(uri);
    } catch (error) {
      throw new Error(`Failed to create file ${tool.path}: ${error}`);
    }
  }

  /**
   * Delete file - Delete a file
   */
  private async deleteFile(tool: ToolCall): Promise<void> {
    if (!tool.path) {
      throw new Error('delete_file requires path');
    }

    const filePath = this.resolveFilePath(tool.path);
    const uri = vscode.Uri.file(filePath);

    // Confirm deletion
    const confirm = await vscode.window.showWarningMessage(
      `Are you sure you want to delete ${tool.path}?`,
      { modal: true },
      'Delete'
    );

    if (confirm !== 'Delete') {
      this.log(`⚠️ File deletion cancelled: ${tool.path}`);
      return;
    }

    try {
      const edit = new vscode.WorkspaceEdit();
      edit.deleteFile(uri);
      await vscode.workspace.applyEdit(edit);
      this.log(`✅ Deleted file ${tool.path}`);
    } catch (error) {
      throw new Error(`Failed to delete file ${tool.path}: ${error}`);
    }
  }

  /**
   * Execute batch - Execute multiple actions atomically
   */
  private async executeBatch(tool: ToolCall): Promise<void> {
    if (!tool.actions || !Array.isArray(tool.actions)) {
      throw new Error('batch requires actions array');
    }

    this.log(`Executing batch of ${tool.actions.length} actions`);

    for (let i = 0; i < tool.actions.length; i++) {
      const action = tool.actions[i];
      try {
        await this.execute(action);
      } catch (error) {
        throw new Error(`Batch action ${i + 1} failed: ${error}`);
      }
    }

    this.log(`✅ Batch completed successfully`);
  }

  /**
   * Handle thought - Log AI reasoning
   */
  private handleThought(tool: ToolCall): void {
    if (tool.content) {
      this.log(`💭 AI Thought: ${tool.content}`);
      this.outputChannel.show(true);
    }
  }

  /**
   * Request clarification - Ask user for information
   */
  private async requestClarification(tool: ToolCall): Promise<void> {
    if (!tool.question) {
      throw new Error('request_clarification requires question');
    }

    const answer = await vscode.window.showInputBox({
      prompt: tool.question,
      placeHolder: 'Enter your answer...'
    });

    if (answer) {
      this.log(`👤 User answered: ${answer}`);
      // TODO: Send answer back to AI for continuation
      vscode.window.showInformationMessage(`Answer recorded: ${answer}`);
    } else {
      this.log(`⚠️ User cancelled clarification request`);
    }
  }

  /**
   * Resolve file path relative to the workspace. Delegates to the shared
   * resolveWorkspacePath (src/security/workspacePath.ts) so every
   * file-touching tool in the extension enforces the same containment
   * check from one place, not a copy per file.
   */
  private resolveFilePath(filePath: string): string {
    return resolveWorkspacePath(filePath);
  }

  /**
   * Log message to output channel
   */
  private log(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }

  /**
   * Show output channel
   */
  showOutput(): void {
    this.outputChannel.show();
  }

  /**
   * Clear output channel
   */
  clearOutput(): void {
    this.outputChannel.clear();
  }
}

// Singleton instance
export const toolExecutor = new ToolExecutor();
