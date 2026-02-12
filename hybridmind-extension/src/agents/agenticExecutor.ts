/**
 * Agentic Executor - Converts AI responses into actual VS Code actions
 * This is the key piece that GitHub Copilot uses to actually DO things
 */

import * as vscode from 'vscode';
import { AgentTools, ToolResult } from './agentTools';

export interface ToolCall {
  tool: string;
  parameters: any;
  reasoning?: string;
}

export interface ExecutionResult {
  success: boolean;
  results: ToolResult[];
  summary: string;
}

export class AgenticExecutor {
  /**
   * Parse AI response for tool calls
   * Supports multiple formats:
   * 1. JSON tool calls
   * 2. Structured text format
   * 3. Code block format
   */
  static parseToolCalls(aiResponse: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];

    // Try to find JSON tool calls
    const jsonMatches = aiResponse.matchAll(/\{[\s\S]*?"tool":\s*"([^"]+)"[\s\S]*?\}/g);
    for (const match of jsonMatches) {
      try {
        const parsed = JSON.parse(match[0]);
        toolCalls.push(parsed);
      } catch (e) {
        // Not valid JSON, continue
      }
    }

    // Also support simple format: TOOL_NAME: param1=value1, param2=value2
    const simpleMatches = aiResponse.matchAll(/^([A-Z_]+):\s*(.+)$/gm);
    for (const match of simpleMatches) {
      const toolName = match[1].toLowerCase();
      const paramsStr = match[2];
      const params: any = {};
      
      // Parse key=value pairs
      const paramMatches = paramsStr.matchAll(/(\w+):\s*([^,]+)/g);
      for (const paramMatch of paramMatches) {
        params[paramMatch[1]] = paramMatch[2].trim();
      }
      
      toolCalls.push({
        tool: toolName,
        parameters: params
      });
    }

    // Support explicit tool call blocks
    const blockPattern = /```tool\s+([\s\S]*?)```/g;
    const blockMatches = aiResponse.matchAll(blockPattern);
    for (const match of blockMatches) {
      try {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed)) {
          toolCalls.push(...parsed);
        } else {
          toolCalls.push(parsed);
        }
      } catch (e) {
        // Not valid JSON
      }
    }

    return toolCalls;
  }

  /**
   * Execute a single tool call
   */
  static async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const { tool, parameters } = toolCall;

    switch (tool.toLowerCase()) {
      case 'read_file':
      case 'readfile':
        return await AgentTools.readFile(parameters.filePath || parameters.path);

      case 'write_file':
      case 'writefile':
        return await AgentTools.writeFile(
          parameters.filePath || parameters.path,
          parameters.content
        );

      case 'replace_in_file':
      case 'replaceinfile':
        return await AgentTools.replaceInFile(
          parameters.filePath || parameters.path,
          parameters.oldText || parameters.old,
          parameters.newText || parameters.new
        );

      case 'replace_at_location':
      case 'replaceatlocation':
        return await AgentTools.replaceAtLocation(
          parameters.filePath || parameters.path,
          parseInt(parameters.lineNumber || parameters.line) - 1, // Convert to 0-based
          parameters.oldText || parameters.old,
          parameters.newText || parameters.new
        );

      case 'insert_at':
      case 'insertat':
        return await AgentTools.insertAt(
          parameters.filePath || parameters.path,
          parseInt(parameters.lineNumber || parameters.line) - 1,
          parseInt(parameters.character || parameters.col || '0'),
          parameters.text
        );

      case 'delete_range':
      case 'deleterange':
        return await AgentTools.deleteRange(
          parameters.filePath || parameters.path,
          parseInt(parameters.startLine) - 1,
          parseInt(parameters.startChar || '0'),
          parseInt(parameters.endLine) - 1,
          parseInt(parameters.endChar || '999')
        );

      case 'apply_workspace_edit':
      case 'applyworkspaceedit':
        return await AgentTools.applyWorkspaceEdit(parameters.edits || []);

      case 'create_file':
      case 'createfile':
        return await AgentTools.createFile(
          parameters.filePath || parameters.path,
          parameters.content || ''
        );

      case 'search_files':
      case 'searchfiles':
        return await AgentTools.searchFiles(
          parameters.pattern,
          parameters.maxResults || 50
        );

      case 'search_in_files':
      case 'searchinfiles':
        return await AgentTools.searchInFiles(
          parameters.searchText || parameters.text,
          parameters.filePattern || parameters.pattern
        );

      case 'list_directory':
      case 'listdirectory':
        return await AgentTools.listDirectory(parameters.dirPath || parameters.path);

      case 'execute_command':
      case 'executecommand':
      case 'run_command':
        return await AgentTools.executeCommand(
          parameters.command,
          parameters.cwd
        );

      case 'install_package':
      case 'installpackage':
        return await AgentTools.installPackage(
          parameters.packageName || parameters.package,
          parameters.dev === 'true' || parameters.dev === true
        );

      case 'format_document':
      case 'formatdocument':
        return await AgentTools.formatDocument(parameters.filePath || parameters.path);

      case 'get_diagnostics':
      case 'getdiagnostics':
        return await AgentTools.getDiagnostics(parameters.filePath || parameters.path);

      case 'apply_edit':
      case 'applyedit':
        return await AgentTools.applyEdit(
          parseInt(parameters.startLine) - 1,
          parseInt(parameters.startChar || '0'),
          parseInt(parameters.endLine) - 1,
          parseInt(parameters.endChar || '999'),
          parameters.newText || parameters.text
        );

      default:
        return {
          success: false,
          error: `Unknown tool: ${tool}`
        };
    }
  }

  /**
   * Execute multiple tool calls in sequence
   */
  static async executeAll(toolCalls: ToolCall[]): Promise<ExecutionResult> {
    const results: ToolResult[] = [];
    let allSuccess = true;

    for (const toolCall of toolCalls) {
      const result = await this.executeTool(toolCall);
      results.push(result);
      
      if (!result.success) {
        allSuccess = false;
        // Continue execution even on failure (configurable)
      }
    }

    const summary = this.generateSummary(toolCalls, results);

    return {
      success: allSuccess,
      results,
      summary
    };
  }

  /**
   * Generate a human-readable summary of what was done
   */
  private static generateSummary(toolCalls: ToolCall[], results: ToolResult[]): string {
    const lines: string[] = [];
    
    toolCalls.forEach((call, idx) => {
      const result = results[idx];
      const status = result.success ? '✅' : '❌';
      const toolName = call.tool.replace(/_/g, ' ');
      
      if (result.success) {
        lines.push(`${status} ${toolName}`);
      } else {
        lines.push(`${status} ${toolName}: ${result.error}`);
      }
    });

    return lines.join('\n');
  }

  /**
   * Smart execute: Parse AI response and execute tool calls
   * This is the main method to use for agentic behavior
   */
  static async executeFromAI(aiResponse: string): Promise<ExecutionResult> {
    const toolCalls = this.parseToolCalls(aiResponse);
    
    if (toolCalls.length === 0) {
      return {
        success: true,
        results: [],
        summary: 'No tool calls found in AI response'
      };
    }

    return await this.executeAll(toolCalls);
  }

  /**
   * Execute with confirmation - shows what will be done before doing it
   */
  static async executeWithConfirmation(
    aiResponse: string,
    autoApprove: boolean = false
  ): Promise<ExecutionResult> {
    const toolCalls = this.parseToolCalls(aiResponse);
    
    if (toolCalls.length === 0) {
      return {
        success: true,
        results: [],
        summary: 'No tool calls found'
      };
    }

    if (!autoApprove) {
      const actions = toolCalls.map((call, idx) => 
        `${idx + 1}. ${call.tool}: ${JSON.stringify(call.parameters)}`
      ).join('\n');

      const choice = await vscode.window.showInformationMessage(
        `Execute ${toolCalls.length} actions?\n\n${actions}`,
        { modal: true },
        'Execute',
        'Cancel'
      );

      if (choice !== 'Execute') {
        return {
          success: false,
          results: [],
          summary: 'User cancelled execution'
        };
      }
    }

    return await this.executeAll(toolCalls);
  }

  /**
   * Create a prompt that instructs the AI to generate tool calls
   */
  static createAgenticPrompt(task: string, context: string): string {
    return `You are an autonomous coding agent with the ability to modify code directly.

TASK: ${task}

CONTEXT:
${context}

You have access to these tools:
- replace_at_location: Replace text at a specific line
- insert_at: Insert text at a position
- delete_range: Delete a range of lines
- apply_workspace_edit: Make multiple edits atomically
- create_file: Create a new file
- format_document: Format a file
- execute_command: Run terminal commands
- install_package: Install npm packages
- get_diagnostics: Check for errors

RESPOND IN THIS FORMAT:

## Analysis
[Your reasoning about what needs to be done]

## Actions
\`\`\`tool
[
  {
    "tool": "replace_at_location",
    "parameters": {
      "filePath": "/path/to/file.ts",
      "lineNumber": 45,
      "oldText": "old code here",
      "newText": "new code here"
    },
    "reasoning": "Why this change is needed"
  }
]
\`\`\`

Be specific and precise. Use actual file paths and line numbers from the context.`;
  }
}
