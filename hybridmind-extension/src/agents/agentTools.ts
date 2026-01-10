/**
 * Agent Tools - VS Code workspace operations
 * Gives AI agents the ability to read/write/search files
 */

import * as vscode from 'vscode';
import * as path from 'path';

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class AgentTools {
  /**
   * Read a file from the workspace
   */
  static async readFile(filePath: string): Promise<ToolResult> {
    try {
      const uri = vscode.Uri.file(filePath);
      const fileContent = await vscode.workspace.fs.readFile(uri);
      const text = Buffer.from(fileContent).toString('utf8');
      
      return {
        success: true,
        data: {
          path: filePath,
          content: text,
          lines: text.split('\n').length
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to read file: ${error.message}`
      };
    }
  }

  /**
   * Write content to a file
   */
  static async writeFile(filePath: string, content: string): Promise<ToolResult> {
    try {
      const uri = vscode.Uri.file(filePath);
      const buffer = Buffer.from(content, 'utf8');
      await vscode.workspace.fs.writeFile(uri, buffer);
      
      return {
        success: true,
        data: {
          path: filePath,
          bytesWritten: buffer.length
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to write file: ${error.message}`
      };
    }
  }

  /**
   * Replace text in a file (like find/replace)
   */
  static async replaceInFile(
    filePath: string, 
    oldText: string, 
    newText: string
  ): Promise<ToolResult> {
    try {
      // Read the file first
      const readResult = await this.readFile(filePath);
      if (!readResult.success) {
        return readResult;
      }

      const content = readResult.data.content;
      
      // Check if old text exists
      if (!content.includes(oldText)) {
        return {
          success: false,
          error: 'Old text not found in file'
        };
      }

      // Replace and write back
      const newContent = content.replace(oldText, newText);
      const writeResult = await this.writeFile(filePath, newContent);
      
      if (writeResult.success) {
        return {
          success: true,
          data: {
            path: filePath,
            replacements: 1,
            oldLength: oldText.length,
            newLength: newText.length
          }
        };
      }
      
      return writeResult;
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to replace in file: ${error.message}`
      };
    }
  }

  /**
   * Search for files matching a pattern
   */
  static async searchFiles(pattern: string, maxResults: number = 50): Promise<ToolResult> {
    try {
      const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', maxResults);
      
      return {
        success: true,
        data: {
          pattern,
          files: files.map(f => f.fsPath),
          count: files.length
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to search files: ${error.message}`
      };
    }
  }

  /**
   * List files in a directory
   */
  static async listDirectory(dirPath: string): Promise<ToolResult> {
    try {
      const uri = vscode.Uri.file(dirPath);
      const entries = await vscode.workspace.fs.readDirectory(uri);
      
      const files = entries
        .filter(([_, type]) => type === vscode.FileType.File)
        .map(([name]) => name);
      
      const dirs = entries
        .filter(([_, type]) => type === vscode.FileType.Directory)
        .map(([name]) => name);
      
      return {
        success: true,
        data: {
          path: dirPath,
          files,
          directories: dirs,
          total: entries.length
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to list directory: ${error.message}`
      };
    }
  }

  /**
   * Get current active editor's file and selection
   */
  static async getActiveEditor(): Promise<ToolResult> {
    try {
      const editor = vscode.window.activeTextEditor;
      
      if (!editor) {
        return {
          success: false,
          error: 'No active editor'
        };
      }

      const document = editor.document;
      const selection = editor.selection;
      const selectedText = document.getText(selection);
      
      return {
        success: true,
        data: {
          filePath: document.uri.fsPath,
          language: document.languageId,
          lineCount: document.lineCount,
          selection: {
            start: { line: selection.start.line, character: selection.start.character },
            end: { line: selection.end.line, character: selection.end.character },
            text: selectedText,
            isEmpty: selection.isEmpty
          }
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get active editor: ${error.message}`
      };
    }
  }

  /**
   * Apply an edit to the active editor
   */
  static async applyEdit(
    startLine: number,
    startChar: number,
    endLine: number,
    endChar: number,
    newText: string
  ): Promise<ToolResult> {
    try {
      const editor = vscode.window.activeTextEditor;
      
      if (!editor) {
        return {
          success: false,
          error: 'No active editor'
        };
      }

      const success = await editor.edit(editBuilder => {
        const start = new vscode.Position(startLine, startChar);
        const end = new vscode.Position(endLine, endChar);
        const range = new vscode.Range(start, end);
        editBuilder.replace(range, newText);
      });

      if (success) {
        return {
          success: true,
          data: {
            filePath: editor.document.uri.fsPath,
            linesModified: endLine - startLine + 1
          }
        };
      } else {
        return {
          success: false,
          error: 'Edit was rejected by VS Code'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to apply edit: ${error.message}`
      };
    }
  }

  /**
   * Get workspace folder paths
   */
  static async getWorkspaceFolders(): Promise<ToolResult> {
    try {
      const folders = vscode.workspace.workspaceFolders;
      
      if (!folders || folders.length === 0) {
        return {
          success: false,
          error: 'No workspace folders open'
        };
      }

      return {
        success: true,
        data: {
          folders: folders.map(f => ({
            name: f.name,
            path: f.uri.fsPath
          }))
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to get workspace folders: ${error.message}`
      };
    }
  }

  /**
   * Execute a terminal command
   */
  static async executeCommand(command: string, cwd?: string): Promise<ToolResult> {
    try {
      return new Promise((resolve) => {
        const terminal = vscode.window.createTerminal({
          name: 'HybridMind Agent',
          cwd: cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
        });

        terminal.show();
        terminal.sendText(command);

        // Give it a moment to execute
        setTimeout(() => {
          resolve({
            success: true,
            data: {
              command,
              cwd,
              terminal: 'Command executed in terminal'
            }
          });
        }, 1000);
      });
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to execute command: ${error.message}`
      };
    }
  }

  /**
   * Run npm/yarn command
   */
  static async runPackageManager(command: string, packageManager: 'npm' | 'yarn' = 'npm'): Promise<ToolResult> {
    const fullCommand = `${packageManager} ${command}`;
    return await this.executeCommand(fullCommand);
  }

  /**
   * Install npm package
   */
  static async installPackage(packageName: string, dev: boolean = false): Promise<ToolResult> {
    const command = dev ? `install ${packageName} --save-dev` : `install ${packageName}`;
    return await this.runPackageManager(command);
  }

  /**
   * Run tests
   */
  static async runTests(testCommand?: string): Promise<ToolResult> {
    const command = testCommand || 'test';
    return await this.runPackageManager(command);
  }

  /**
   * Search text in files (grep-like)
   */
  static async searchInFiles(searchText: string, filePattern: string = '**/*'): Promise<ToolResult> {
    try {
      const files = await vscode.workspace.findFiles(filePattern, '**/node_modules/**', 100);
      const results: Array<{ file: string; matches: number; lines: Array<{ line: number; text: string }> }> = [];

      for (const file of files) {
        try {
          const content = await vscode.workspace.fs.readFile(file);
          const text = Buffer.from(content).toString('utf8');
          const lines = text.split('\n');
          const matchedLines: Array<{ line: number; text: string }> = [];

          lines.forEach((line, index) => {
            if (line.toLowerCase().includes(searchText.toLowerCase())) {
              matchedLines.push({ line: index + 1, text: line.trim() });
            }
          });

          if (matchedLines.length > 0) {
            results.push({
              file: file.fsPath,
              matches: matchedLines.length,
              lines: matchedLines.slice(0, 5) // Limit to 5 matches per file
            });
          }
        } catch (e) {
          // Skip files that can't be read
        }
      }

      return {
        success: true,
        data: {
          searchText,
          totalMatches: results.reduce((sum, r) => sum + r.matches, 0),
          filesMatched: results.length,
          results: results.slice(0, 10) // Limit to 10 files
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to search in files: ${error.message}`
      };
    }
  }

  /**
   * Get git status
   */
  static async getGitStatus(): Promise<ToolResult> {
    return await this.executeCommand('git status');
  }

  /**
   * Git commit
   */
  static async gitCommit(message: string): Promise<ToolResult> {
    await this.executeCommand('git add .');
    return await this.executeCommand(`git commit -m "${message}"`);
  }

  /**
   * Create a new file with content
   */
  static async createFile(filePath: string, content: string): Promise<ToolResult> {
    try {
      const uri = vscode.Uri.file(filePath);
      const buffer = Buffer.from(content, 'utf8');
      await vscode.workspace.fs.writeFile(uri, buffer);
      
      // Open the file
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document);
      
      return {
        success: true,
        data: {
          path: filePath,
          created: true
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to create file: ${error.message}`
      };
    }
  }
}
