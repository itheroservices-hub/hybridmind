/**
 * JSON Tool Dispatcher - Parses and executes JSON tool calls from AI agents
 * Supports structured JSON format for VS Code operations
 */

import * as vscode from 'vscode';

export interface ToolCall {
  tool: string;
  [key: string]: any;
}

export interface ToolResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}

// Type Guards for runtime validation
class TypeGuards {
  static isPosition(obj: any): obj is { line: number; character: number } {
    return obj !== null &&
           typeof obj === 'object' &&
           typeof obj.line === 'number' &&
           typeof obj.character === 'number' &&
           Number.isInteger(obj.line) &&
           Number.isInteger(obj.character) &&
           obj.line >= 0 &&
           obj.character >= 0;
  }

  static isRange(start: any, end: any): boolean {
    if (!this.isPosition(start) || !this.isPosition(end)) {
      return false;
    }
    if (end.line < start.line) {
      return false;
    }
    if (end.line === start.line && end.character < start.character) {
      return false;
    }
    return true;
  }

  static validatePositionInDocument(position: { line: number; character: number }, document: vscode.TextDocument): string | null {
    if (position.line < 0 || position.line >= document.lineCount) {
      return `Line ${position.line} is out of bounds (document has ${document.lineCount} lines)`;
    }
    const lineText = document.lineAt(position.line).text;
    if (position.character < 0 || position.character > lineText.length) {
      return `Character ${position.character} is out of bounds for line ${position.line} (line has ${lineText.length} characters)`;
    }
    return null;
  }
}

// Schema Validator
class ToolValidator {
  static validateApplyEdit(tool: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (typeof tool.file !== 'string') errors.push('file must be a string');
    if (!TypeGuards.isPosition(tool.start)) {
      errors.push('start must be a valid position object {line: number >= 0, character: number >= 0}');
    }
    if (!TypeGuards.isPosition(tool.end)) {
      errors.push('end must be a valid position object {line: number >= 0, character: number >= 0}');
    }
    if (TypeGuards.isPosition(tool.start) && TypeGuards.isPosition(tool.end)) {
      if (!TypeGuards.isRange(tool.start, tool.end)) {
        errors.push('Invalid range: end position must be after or equal to start position');
      }
    }
    if (typeof tool.text !== 'string') errors.push('text must be a string');
    return { valid: errors.length === 0, errors };
  }

  static validateInsertText(tool: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (typeof tool.file !== 'string') errors.push('file must be a string');
    if (!TypeGuards.isPosition(tool.position)) {
      errors.push('position must be a valid position object {line: number >= 0, character: number >= 0}');
    }
    if (typeof tool.text !== 'string') errors.push('text must be a string');
    return { valid: errors.length === 0, errors };
  }

  static validateCreateFile(tool: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (typeof tool.path !== 'string') errors.push('path must be a string');
    if (tool.content !== undefined && typeof tool.content !== 'string') {
      errors.push('content must be a string or undefined');
    }
    return { valid: errors.length === 0, errors };
  }

  static validateDeleteFile(tool: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (typeof tool.path !== 'string') errors.push('path must be a string');
    return { valid: errors.length === 0, errors };
  }

  static validateBatch(tool: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!Array.isArray(tool.actions)) errors.push('actions must be an array');
    return { valid: errors.length === 0, errors };
  }

  static validateThought(tool: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (typeof tool.content !== 'string') errors.push('content must be a string');
    return { valid: errors.length === 0, errors };
  }

  static validateClarification(tool: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (typeof tool.question !== 'string') errors.push('question must be a string');
    return { valid: errors.length === 0, errors };
  }

  static validate(tool: ToolCall): { valid: boolean; errors: string[] } {
    switch (tool.tool) {
      case 'apply_edit': return this.validateApplyEdit(tool);
      case 'insert_text': return this.validateInsertText(tool);
      case 'create_file': return this.validateCreateFile(tool);
      case 'delete_file': return this.validateDeleteFile(tool);
      case 'batch': return this.validateBatch(tool);
      case 'thought': return this.validateThought(tool);
      case 'request_clarification': return this.validateClarification(tool);
      default: return { valid: false, errors: [`Unknown tool type: ${tool.tool}`] };
    }
  }
}

export class JsonToolDispatcher {
  /**
   * Resolve a file path relative to workspace root
   */
  private static resolveFilePath(filePath: string): vscode.Uri | null {
    try {
      // If it's already an absolute path
      if (/^[a-zA-Z]:[\\\\/]/.test(filePath) || filePath.startsWith('/')) {
        return vscode.Uri.file(filePath);
      }

      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        console.error('[JsonToolDispatcher] No workspace folder open');
        return null;
      }

      const workspaceRoot = workspaceFolders[0].uri;
      const normalizedPath = filePath.replace(/\\/g, '/');
      return vscode.Uri.joinPath(workspaceRoot, normalizedPath);
    } catch (error) {
      console.error('[JsonToolDispatcher] Failed to resolve path:', filePath, error);
      return null;
    }
  }

  /**
   * Extract JSON objects from text with balanced brace matching
   */
  private static extractJsonObjects(text: string): string[] {
    const results: string[] = [];
    let depth = 0;
    let startIdx = -1;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const prevChar = i > 0 ? text[i - 1] : '';

      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"' && prevChar !== '\\') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') {
          if (depth === 0) {
            startIdx = i;
          }
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0 && startIdx >= 0) {
            const jsonStr = text.substring(startIdx, i + 1);
            if (jsonStr.includes('"tool"')) {
              results.push(jsonStr);
            }
            startIdx = -1;
          }
        }
      }
    }

    return results;
  }

  /**
   * Parse AI response for JSON tool calls
   */
  static parseJsonTools(aiResponse: string): ToolCall[] {
    const tools: ToolCall[] = [];

    // Strategy 1: Extract from JSON code blocks
    const jsonBlockPattern = /```json\s*\n?([\s\S]*?)```/g;
    let match;
    
    while ((match = jsonBlockPattern.exec(aiResponse)) !== null) {
      try {
        const jsonContent = match[1].trim();
        const parsed = JSON.parse(jsonContent);
        
        if (Array.isArray(parsed)) {
          tools.push(...parsed.filter((t: any) => t && typeof t === 'object' && t.tool));
        } else if (parsed && typeof parsed === 'object' && parsed.tool) {
          tools.push(parsed);
        }
      } catch (e) {
        console.warn('[JsonToolDispatcher] Failed to parse JSON code block:', e);
      }
    }

    // Strategy 2: Extract from mixed content using balanced brace matching
    if (tools.length === 0) {
      const jsonObjects = this.extractJsonObjects(aiResponse);
      for (const jsonStr of jsonObjects) {
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed && typeof parsed === 'object' && parsed.tool) {
            tools.push(parsed);
          }
        } catch (e) {
          // Not valid JSON, skip
        }
      }
    }

    // Strategy 3: Try parsing entire response as JSON
    if (tools.length === 0) {
      const trimmed = aiResponse.trim();
      
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
          (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          const parsed = JSON.parse(trimmed);
          
          if (Array.isArray(parsed)) {
            tools.push(...parsed.filter((t: any) => t && typeof t === 'object' && t.tool));
          } else if (parsed && typeof parsed === 'object' && parsed.tool) {
            tools.push(parsed);
          }
        } catch (e) {
          console.warn('[JsonToolDispatcher] Response looks like JSON but failed to parse:', e);
        }
      }
    }

    return tools;
  }

  /**
   * Execute a single tool call
   */
  static async executeTool(tool: ToolCall): Promise<ToolResult> {
    try {
      // Validate tool schema first
      const validation = ToolValidator.validate(tool);
      if (!validation.valid) {
        return {
          success: false,
          error: `Schema validation failed: ${validation.errors.join(', ')}`
        };
      }

      switch (tool.tool) {
        case 'apply_edit':
          return await this.applyEdit(tool);
        
        case 'insert_text':
          return await this.insertText(tool);
        
        case 'create_file':
          return await this.createFile(tool);
        
        case 'delete_file':
          return await this.deleteFile(tool);
        
        case 'batch':
          return await this.executeBatch(tool);
        
        case 'thought':
          return this.handleThought(tool);
        
        case 'request_clarification':
          return await this.requestClarification(tool);
        
        default:
          return {
            success: false,
            error: `Unknown tool: ${tool.tool}`
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Tool execution failed: ${error.message}`
      };
    }
  }

  /**
   * Apply an edit to a file
   */
  private static async applyEdit(tool: any): Promise<ToolResult> {
    const { file, start, end, text } = tool;

    const uri = this.resolveFilePath(file);
    if (!uri) {
      return {
        success: false,
        error: `Failed to resolve file path: ${file}. Ensure workspace is open and path is valid.`
      };
    }

    // Check if file exists
    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      return {
        success: false,
        error: `File does not exist: ${uri.fsPath}`
      };
    }

    // Open and validate document
    let document: vscode.TextDocument;
    try {
      document = await vscode.workspace.openTextDocument(uri);
    } catch (error: any) {
      return {
        success: false,
        error: `Cannot open file: ${error.message}`
      };
    }

    // Validate range is within document bounds
    if (start.line < 0 || start.line >= document.lineCount) {
      return {
        success: false,
        error: `Start line ${start.line} is out of bounds (document has ${document.lineCount} lines)`
      };
    }
    
    if (end.line < 0 || end.line >= document.lineCount) {
      return {
        success: false,
        error: `End line ${end.line} is out of bounds (document has ${document.lineCount} lines)`
      };
    }

    const startPos = new vscode.Position(start.line, start.character);
    const endPos = new vscode.Position(end.line, end.character);
    const range = new vscode.Range(startPos, endPos);

    if (!range.isEmpty && range.start.isAfter(range.end)) {
      return {
        success: false,
        error: 'Invalid range: start position is after end position'
      };
    }

    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, range, text);

    const success = await vscode.workspace.applyEdit(edit);

    if (!success) {
      const failureReasons = [];
      
      try {
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.permissions !== undefined && (stat.permissions & vscode.FilePermission.Readonly)) {
          failureReasons.push('file is read-only');
        }
      } catch {}

      const openDoc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
      if (openDoc && openDoc.isDirty) {
        failureReasons.push('file has unsaved changes');
      }

      const errorMsg = failureReasons.length > 0
        ? `Edit rejected: ${failureReasons.join(', ')}`
        : 'Edit rejected by VS Code (unknown reason)';

      return {
        success: false,
        error: errorMsg,
        data: { file: uri.fsPath, attemptedRange: { start, end } }
      };
    }

    return {
      success: true,
      message: `Applied edit to ${file}`,
      data: { file: uri.fsPath, linesModified: end.line - start.line + 1 }
    };
  }

  /**
   * Insert text at a position
   */
  private static async insertText(tool: any): Promise<ToolResult> {
    const { file, position, text } = tool;

    const uri = this.resolveFilePath(file);
    if (!uri) {
      return {
        success: false,
        error: `Failed to resolve file path: ${file}`
      };
    }

    // Check file exists and get document
    let document: vscode.TextDocument;
    try {
      await vscode.workspace.fs.stat(uri);
      document = await vscode.workspace.openTextDocument(uri);
    } catch (error: any) {
      return {
        success: false,
        error: `Cannot access file: ${error.message}`
      };
    }

    // Validate position
    if (position.line < 0 || position.line > document.lineCount) {
      return {
        success: false,
        error: `Position line ${position.line} is out of bounds (document has ${document.lineCount} lines, valid range: 0-${document.lineCount})`
      };
    }

    const pos = new vscode.Position(position.line, position.character);
    const edit = new vscode.WorkspaceEdit();
    edit.insert(uri, pos, text);

    const success = await vscode.workspace.applyEdit(edit);

    if (!success) {
      return {
        success: false,
        error: 'Insert rejected by VS Code (file may be read-only or locked)',
        data: { file: uri.fsPath, attemptedPosition: position }
      };
    }

    return {
      success: true,
      message: `Inserted text into ${file}`,
      data: { file: uri.fsPath, position }
    };
  }

  /**
   * Create a new file
   */
  private static async createFile(tool: any): Promise<ToolResult> {
    const { path, content } = tool;

    const uri = this.resolveFilePath(path);
    if (!uri) {
      return {
        success: false,
        error: `Failed to resolve file path: ${path}`
      };
    }
    const edit = new vscode.WorkspaceEdit();
    edit.createFile(uri, { overwrite: false });
    
    if (content) {
      edit.insert(uri, new vscode.Position(0, 0), content);
    }

    const success = await vscode.workspace.applyEdit(edit);

    if (success && content) {
      // Open the created file
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document);
    }

    return {
      success,
      message: success ? `Created file ${path}` : 'File creation failed',
      data: { path, size: content?.length || 0 }
    };
  }

  /**
   * Delete a file
   */
  private static async deleteFile(tool: any): Promise<ToolResult> {
    const { path } = tool;

    const uri = this.resolveFilePath(path);
    if (!uri) {
      return {
        success: false,
        error: `Failed to resolve file path: ${path}`
      };
    }

    // Ask for confirmation
    const confirm = await vscode.window.showWarningMessage(
      `Delete ${uri.fsPath}?`,
      { modal: true },
      'Delete'
    );

    if (confirm !== 'Delete') {
      return {
        success: false,
        message: 'User cancelled deletion'
      };
    }
    const edit = new vscode.WorkspaceEdit();
    edit.deleteFile(uri);

    const success = await vscode.workspace.applyEdit(edit);

    return {
      success,
      message: success ? `Deleted file ${path}` : 'File deletion failed',
      data: { path }
    };
  }

  /**
   * Execute a batch of actions
   */
  private static async executeBatch(tool: any): Promise<ToolResult> {
    const { actions } = tool;

    if (!Array.isArray(actions)) {
      return {
        success: false,
        error: 'Batch actions must be an array'
      };
    }

    const results: ToolResult[] = [];
    let allSuccess = true;

    for (const action of actions) {
      const result = await this.executeTool(action);
      results.push(result);
      if (!result.success) {
        allSuccess = false;
      }
    }

    return {
      success: allSuccess,
      message: `Executed ${actions.length} actions: ${results.filter(r => r.success).length} succeeded`,
      data: { results, total: actions.length, succeeded: results.filter(r => r.success).length }
    };
  }

  /**
   * Handle a thought (analysis only, no action)
   */
  private static handleThought(tool: any): ToolResult {
    const { content } = tool;
    
    console.log(`[Agent Thought]: ${content}`);
    
    return {
      success: true,
      message: 'Thought recorded',
      data: { thought: content }
    };
  }

  /**
   * Request clarification from user
   */
  private static async requestClarification(tool: any): Promise<ToolResult> {
    const { question } = tool;

    if (!question) {
      return {
        success: false,
        error: 'Missing required parameter: question'
      };
    }

    const answer = await vscode.window.showInputBox({
      prompt: question,
      placeHolder: 'Your response...'
    });

    return {
      success: true,
      message: answer ? 'User responded' : 'User cancelled',
      data: { question, answer }
    };
  }

  /**
   * Execute all tools from AI response
   */
  static async executeFromAI(aiResponse: string): Promise<{
    success: boolean;
    results: ToolResult[];
    summary: string;
    thoughts: string[];
  }> {
    const tools = this.parseJsonTools(aiResponse);
    
    if (tools.length === 0) {
      return {
        success: false,
        results: [],
        summary: 'No valid JSON tool calls found in AI response',
        thoughts: []
      };
    }

    const results: ToolResult[] = [];
    const thoughts: string[] = [];
    let allSuccess = true;

    for (const tool of tools) {
      // Extract thoughts separately
      if (tool.tool === 'thought') {
        thoughts.push(tool.content);
      }

      const result = await this.executeTool(tool);
      results.push(result);
      
      if (!result.success) {
        allSuccess = false;
      }
    }

    const summary = this.generateSummary(tools, results);

    return {
      success: allSuccess,
      results,
      summary,
      thoughts
    };
  }

  /**
   * Generate execution summary
   */
  private static generateSummary(tools: ToolCall[], results: ToolResult[]): string {
    const lines: string[] = [];
    
    tools.forEach((tool, idx) => {
      const result = results[idx];
      const status = result.success ? '✅' : '❌';
      const toolName = tool.tool.replace(/_/g, ' ');
      
      if (result.success) {
        lines.push(`${status} ${toolName}: ${result.message || 'Success'}`);
      } else {
        lines.push(`${status} ${toolName}: ${result.error || 'Failed'}`);
      }
    });

    return lines.join('\n');
  }

  /**
   * Execute with user confirmation
   */
  static async executeWithConfirmation(
    aiResponse: string,
    autoApprove: boolean = false
  ): Promise<{
    success: boolean;
    results: ToolResult[];
    summary: string;
    thoughts: string[];
  }> {
    const tools = this.parseJsonTools(aiResponse);
    
    if (tools.length === 0) {
      return {
        success: false,
        results: [],
        summary: 'No valid JSON tool calls found',
        thoughts: []
      };
    }

    if (!autoApprove) {
      // Filter out thoughts for confirmation display
      const actionTools = tools.filter(t => t.tool !== 'thought');
      
      if (actionTools.length > 0) {
        const actions = actionTools.map((tool, idx) => 
          `${idx + 1}. ${tool.tool}: ${JSON.stringify(tool).substring(0, 100)}...`
        ).join('\n');

        const choice = await vscode.window.showInformationMessage(
          `Execute ${actionTools.length} actions?\n\n${actions}`,
          { modal: true },
          'Execute',
          'Cancel'
        );

        if (choice !== 'Execute') {
          return {
            success: false,
            results: [],
            summary: 'User cancelled execution',
            thoughts: []
          };
        }
      }
    }

    return await this.executeFromAI(aiResponse);
  }
}
