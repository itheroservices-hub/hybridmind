/**
 * Autonomous Agent Executor
 * Multi-step AI agent that can plan, execute tools, and refactor code
 */

import * as vscode from 'vscode';
import { AgentTools, ToolResult } from './agentTools';

export interface AgentStep {
  action: string;
  tool?: string;
  parameters?: any;
  result?: ToolResult;
  aiResponse?: string;
}

export interface AgentResult {
  success: boolean;
  steps: AgentStep[];
  finalResult: string;
  error?: string;
  suggestions?: AgentSuggestion[];
}

export interface AgentSuggestion {
  title: string;
  description: string;
  task: string;
  priority: 'high' | 'medium' | 'low';
  model?: string; // Preferred model for this task
}

export class AutonomousAgent {
  private maxSteps = 10;
  private steps: AgentStep[] = [];
  private autonomyLevel: number = 3; // Default to Full Auto
  private permissions: { [key: string]: boolean } = {
    read: true,
    edit: true,
    terminal: true,
    create: true,
    delete: false,
    'multi-step': true,
    restructure: false,
    network: false
  };

  constructor(
    private runModel: (modelId: string, prompt: string) => Promise<any>,
    options?: { autonomyLevel?: number; permissions?: { [key: string]: boolean } }
  ) {
    if (options?.autonomyLevel) {
      this.autonomyLevel = options.autonomyLevel;
    }
    if (options?.permissions) {
      this.permissions = options.permissions;
    }
  }

  /**
   * Execute an autonomous task
   */
  async execute(goal: string, isDirectExecution: boolean = false): Promise<AgentResult> {
    this.steps = [];

    try {
      // STEP 0: Parse user's intent - are they asking about a specific file?
      const mentionedFile = this.extractFileReference(goal);
      
      // STEP 1: Get active editor context
      const editorResult = await AgentTools.getActiveEditor();
      let currentFile = '';
      let currentContent = '';
      let context = '';
      
      if (editorResult.success && editorResult.data) {
        currentFile = editorResult.data.filePath;
        const selection = editorResult.data.selection;
        
        this.steps.push({
          action: '📂 Get active editor context',
          tool: 'getActiveEditor',
          result: editorResult
        });
        
        // If user mentioned a specific file, prioritize that over active file
        if (mentionedFile && mentionedFile !== currentFile.split(/[/\\]/).pop()) {
          // Normalize filename (handle common variations: model.Proxy.js → modelProxy.js)
          const normalizedFile = this.normalizeFilename(mentionedFile);
          
          // Try both original and normalized names
          const searchPatterns = [
            `**/${mentionedFile}`,
            normalizedFile !== mentionedFile ? `**/${normalizedFile}` : null
          ].filter(p => p !== null);
          
          let foundFile = false;
          
          for (const pattern of searchPatterns) {
            if (!pattern) continue;
            
            const searchResult = await AgentTools.searchFiles(pattern!, 5);
            
            this.steps.push({
              action: `🔍 Search for: ${pattern.replace('**/', '')}`,
              tool: 'searchFiles',
              parameters: { pattern },
              result: searchResult
            });
            
            // Extract files from the nested data structure
            const files = searchResult.success && searchResult.data?.files 
              ? searchResult.data.files 
              : (searchResult.success && searchResult.data && Array.isArray(searchResult.data) 
                ? searchResult.data 
                : []);
            
            if (files.length > 0) {
              // Read the first match
              const targetFile = files[0];
              const readResult = await AgentTools.readFile(targetFile);
              
              this.steps.push({
                action: `📖 Read file: ${targetFile.split(/[/\\]/).pop()}`,
                tool: 'readFile',
                parameters: { path: targetFile },
                result: readResult
              });
              
              if (readResult.success && readResult.data) {
                context = `Target file (user asked about "${mentionedFile}"): ${targetFile}\nFile content:\n${readResult.data.content}\n\n`;
                currentContent = readResult.data.content;
                currentFile = targetFile;
                foundFile = true;
                break;
              }
            }
          }
          
          if (!foundFile) {
            // File not found - don't fall back to active file, explicitly state this
            context = `❌ Could not find file: "${mentionedFile}"\n\nI searched for:\n${searchPatterns.map(p => `  - ${p}`).join('\n')}\n\nPlease check the filename and try again, or ask about the currently active file instead.\n\n`;
            
            // Set a flag so we know to return early
            this.steps.push({
              action: `❌ File not found: ${mentionedFile}`,
              tool: 'searchFiles',
              result: { success: false, error: `File "${mentionedFile}" not found in workspace` }
            });
          }
        } else if (currentFile) {
          // Read active file if no specific file mentioned
          const readResult = await AgentTools.readFile(currentFile);
          
          this.steps.push({
            action: `📖 Read file: ${currentFile.split('\\').pop()}`,
            tool: 'readFile',
            parameters: { path: currentFile },
            result: readResult
          });
          
          if (readResult.success && readResult.data) {
            currentContent = readResult.data.content;
            context = `Current file: ${currentFile}\nFile content:\n${currentContent}\n\n`;
          }
        }
        
        // If there's a selection, include it
        if (selection && !selection.isEmpty) {
          context += `Selected code:\n${selection.text}\n\n`;
        }
      }

      // STEP 1: Execute based on mode
      let analysisPrompt = '';
      
      if (isDirectExecution) {
        // Direct execution mode - user clicked a suggestion, skip analysis and GO!
        analysisPrompt = this.getFullAutonomousPrompt(goal, context, currentFile);
      } else {
        // Analysis mode - behavior depends on autonomy level
        if (this.autonomyLevel === 1) {
          // Advisory Mode: Analyze and suggest only, NO execution
          analysisPrompt = `You are a code advisor. Analyze this code and provide suggestions.

User request: "${goal}"

${context}

Provide a detailed analysis and suggest what could be done. DO NOT execute any actions - just advise.
List 3-5 specific suggestions with clear explanations.`;
        } else if (this.autonomyLevel === 2) {
          // Assisted Mode: Plan and ask before executing
          analysisPrompt = `You are an assisted coding agent. Plan what needs to be done and present it for approval.

User request: "${goal}"

${context}

Create a detailed plan with specific steps. Format your response as:
## Analysis
[Your analysis here]

## Proposed Actions
1. [Specific action with file/command details]
2. [Another action]
...

Do NOT execute yet - just present the plan.`;
        } else {
          // Full Autonomous Mode: Analyze → Plan → Execute → Verify
          analysisPrompt = this.getFullAutonomousPrompt(goal, context, currentFile);
        }
      }

      // STEP 2: Get AI response
      const analysisResponse = await this.runModel('llama-3.3-70b', analysisPrompt);
      
      this.steps.push({
        action: '🧠 Analyze file content',
        aiResponse: analysisResponse.content
      });

      // STEP 2: Determine if additional actions are needed
      const actionPrompt = `Based on this task: "${goal}"
And this analysis: ${analysisResponse.content}

Do we need to take any actions? Reply with ONLY tool calls (one per line) or "DONE" if analysis is sufficient.

Format:
executeCommand - command: npm test
installPackage - packageName: axios
gitCommit - message: "fix bugs"

Or just: DONE`;

      const actionResponse = await this.runModel('llama-3.3-70b', actionPrompt);
      
      if (!actionResponse.content.includes('DONE')) {
        const toolCalls = this.parseToolCalls(actionResponse.content);
        
        for (let i = 0; i < toolCalls.length && i < 5; i++) {
          const toolCall = toolCalls[i];
          
          const result = await this.executeTool(
            toolCall.tool,
            toolCall.parameters,
            currentFile,
            currentContent
          );

          this.steps.push({
            action: `⚙️ ${toolCall.action}`,
            tool: toolCall.tool,
            parameters: toolCall.parameters,
            result
          });
        }
      }

      // Generate proactive suggestions based on what we just did
      const suggestions = await this.suggestNextSteps(goal, this.steps, currentFile, currentContent);

      return {
        success: true,
        steps: this.steps,
        finalResult: 'Analysis complete. The agent provided recommendations.',
        suggestions
      };
    } catch (error: any) {
      return {
        success: false,
        steps: this.steps,
        finalResult: '',
        error: error.message
      };
    }
  }

  /**
   * Suggest logical next steps based on completed work
   * Uses a reasoning-focused model to anticipate user needs
   */
  async suggestNextSteps(
    originalGoal: string,
    completedSteps: AgentStep[],
    currentFile: string,
    fileContent: string
  ): Promise<AgentSuggestion[]> {
    try {
      // Use Gemini for fast, smart reasoning about next steps
      const suggestionPrompt = `You just helped a user with: "${originalGoal}"

Current file: ${currentFile}
File type: ${this.getFileType(currentFile)}

Steps completed:
${completedSteps.map((s, i) => `${i + 1}. ${s.action}`).join('\n')}

Based on this context, suggest 2-3 logical next actions the user might want to take.
For each suggestion, consider:
- Natural workflow progression (what typically comes next?)
- Common developer patterns (test after code change, commit after test, etc.)
- File-specific needs (.env → check security, add missing vars; code → add tests, docs)

Respond ONLY with a JSON array (no markdown, no backticks):
[
  {
    "title": "Short action title (4-6 words)",
    "description": "One sentence explaining why this helps",
    "task": "Precise instruction the agent will execute",
    "priority": "high|medium|low",
    "model": "best model for this task (qwen-max for code, gemini-2.0-flash-exp for reasoning, deepseek-chat for refactoring)"
  }
]

Example for .env file analysis:
[
  {"title": "Validate API Keys", "description": "Test if all API keys are valid and working", "task": "Write a test script to validate each API key by making a test request", "priority": "high", "model": "qwen-max"},
  {"title": "Add Security Best Practices", "description": "Ensure .env is in .gitignore and add .env.example", "task": "Check if .env is in .gitignore, create .env.example with placeholder values", "priority": "medium", "model": "deepseek-chat"}
]`;

      const response = await this.runModel('gemini-2.0-flash-exp', suggestionPrompt);
      
      // Parse the response - handle both direct JSON and markdown-wrapped JSON
      let suggestions: AgentSuggestion[] = [];
      
      if (response.success && response.data?.content) {
        let content = response.data.content.trim();
        
        // Remove markdown code blocks if present
        content = content.replace(/^```json?\n?/i, '').replace(/\n?```$/, '');
        
        try {
          const parsed = JSON.parse(content);
          suggestions = Array.isArray(parsed) ? parsed : [];
          
          // Limit to top 3 suggestions
          suggestions = suggestions.slice(0, 3);
        } catch (parseError) {
          console.error('Failed to parse suggestions:', content);
          // Fallback suggestions based on file type
          suggestions = this.getFallbackSuggestions(currentFile, originalGoal);
        }
      } else {
        suggestions = this.getFallbackSuggestions(currentFile, originalGoal);
      }

      return suggestions;
    } catch (error) {
      console.error('Error generating suggestions:', error);
      return this.getFallbackSuggestions(currentFile, originalGoal);
    }
  }

  /**
   * Get file type from extension
   */
  private getFileType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const typeMap: { [key: string]: string } = {
      'ts': 'TypeScript',
      'js': 'JavaScript',
      'py': 'Python',
      'json': 'JSON config',
      'env': 'Environment config',
      'md': 'Markdown',
      'tsx': 'React TypeScript',
      'jsx': 'React JavaScript'
    };
    return typeMap[ext || ''] || ext || 'Unknown';
  }

  /**
   * Fallback suggestions when AI generation fails
   */
  private getFallbackSuggestions(filePath: string, goal: string): AgentSuggestion[] {
    const fileName = filePath.split(/[/\\]/).pop() || '';
    
    // .env files
    if (fileName === '.env' || fileName.endsWith('.env')) {
      return [
        {
          title: 'Create .env.example Template',
          description: 'Add a safe example file for version control',
          task: 'Create .env.example with placeholder values for all keys in .env',
          priority: 'high',
          model: 'qwen-max'
        },
        {
          title: 'Verify .gitignore Protection',
          description: 'Ensure .env is not tracked in git',
          task: 'Check if .env is listed in .gitignore, add if missing',
          priority: 'high',
          model: 'deepseek-chat'
        }
      ];
    }
    
    // TypeScript/JavaScript files
    if (fileName.endsWith('.ts') || fileName.endsWith('.js') || fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) {
      return [
        {
          title: 'Add Unit Tests',
          description: 'Improve code reliability with tests',
          task: `Create unit tests for functions in ${fileName}`,
          priority: 'medium',
          model: 'qwen-max'
        },
        {
          title: 'Add JSDoc Documentation',
          description: 'Improve code readability and IDE support',
          task: `Add JSDoc comments to all public functions in ${fileName}`,
          priority: 'low',
          model: 'deepseek-chat'
        }
      ];
    }
    
    // Python files
    if (fileName.endsWith('.py')) {
      return [
        {
          title: 'Add Type Hints',
          description: 'Improve code clarity and catch type errors',
          task: `Add type hints to all functions in ${fileName}`,
          priority: 'medium',
          model: 'qwen-max'
        },
        {
          title: 'Create pytest Tests',
          description: 'Add test coverage for Python code',
          task: `Create pytest test file for ${fileName}`,
          priority: 'medium',
          model: 'deepseek-chat'
        }
      ];
    }
    
    // Generic fallback
    return [
      {
        title: 'Review and Optimize Code',
        description: 'Check for improvements and best practices',
        task: `Review ${fileName} for optimization opportunities and best practices`,
        priority: 'low',
        model: 'gemini-2.0-flash-exp'
      }
    ];
  }

  /**
   * Get full autonomous coding system prompt
   */
  private getFullAutonomousPrompt(goal: string, context: string, currentFile: string): string {
    const permList = Object.entries(this.permissions)
      .filter(([_, enabled]) => enabled)
      .map(([perm, _]) => perm)
      .join(', ');
      
    return `AGENT SYSTEM PROMPT — FULL AUTONOMOUS CODING MODE

You are an autonomous multi-model software engineering agent with full authority to modify files, create new files, refactor entire codebases, run terminal commands, and execute multi-step plans without waiting for user micromanagement.

CORE DIRECTIVES
1. Take meaningful actions, not small edits.
2. Never produce placeholders, pseudo-code, or "example" structures.
3. Always produce real, production-ready code.
4. When modifying files, provide COMPLETE file content, not partial edits.
5. When running commands, use actual terminal commands (npm, git, etc).
6. Break tasks into clear, actionable steps and execute them sequentially.
7. Use tools immediately - don't describe what you'll do, DO IT.

PERMISSIONS GRANTED: ${permList}

AVAILABLE TOOLS:
${this.permissions.read ? '- readFile(path): Read any file in workspace' : ''}
${this.permissions.edit ? '- writeFile(path, content): Overwrite file with new content' : ''}
${this.permissions.create ? '- createFile(path, content): Create new file' : ''}
${this.permissions.edit ? '- replaceInFile(path, oldText, newText): Replace specific text' : ''}
${this.permissions.terminal ? '- executeCommand(command, cwd?): Run shell commands' : ''}
${this.permissions.terminal ? '- installPackage(packageName, dev?): Install npm packages' : ''}
${this.permissions.terminal ? '- runTests(testCommand?): Execute tests' : ''}
${this.permissions.terminal ? '- gitCommit(message): Commit to git' : ''}
- searchFiles(pattern, maxResults?): Find files by glob pattern
- searchInFiles(searchText, pattern?): Search text across files
- listDirectory(path): List directory contents

USER REQUEST: "${goal}"

CONTEXT:
${context}

WORKFLOW:
1. ANALYZE: Understand what needs to be done
2. PLAN: Break into 3-7 specific steps  
3. EXECUTE: Use tools immediately for each step
4. VERIFY: Confirm changes worked

TOOL CALL FORMAT:
\`\`\`tool
toolName(param1, param2, param3)
\`\`\`

EXAMPLE EXECUTION:
User: "Add error handling to my API"
Response:
\`\`\`tool
readFile(${currentFile})
\`\`\`
\`\`\`tool
replaceInFile(${currentFile}, "app.post('/api',", "app.post('/api', async (req, res) => {\\n  try {")
\`\`\`
\`\`\`tool
executeCommand(npm test)
\`\`\`

CRITICAL RULES:
- NO PLACEHOLDERS OR EXAMPLES - Real code only
- NO "You should..." suggestions - Execute actions
- NO partial file edits - Complete implementations
- Execute tools in EVERY response
- Don't ask permission - you have autonomy level ${this.autonomyLevel}

BEGIN EXECUTION NOW:`;
  }

  /**
   * Extract file reference from user's question
   * Examples: "review my app.js", "what about server.ts?", "check modelProxy.js"
   */
  private extractFileReference(question: string): string | null {
    // Common patterns: "my X", "the X", "about X", "check X", "review X", "X file"
    const patterns = [
      /(?:my|the|about|check|review|analyze|fix|update|read)\s+([a-zA-Z0-9._-]+\.[a-zA-Z0-9]+)/i,
      /([a-zA-Z0-9._-]+\.[a-zA-Z0-9]+)\s+(?:file|code)/i,
      /([a-zA-Z0-9._-]+\.(?:js|ts|jsx|tsx|py|java|cpp|c|go|rs|php|rb|swift|kt|env|json|md|css|html|xml|yaml|yml))\b/i
    ];
    
    for (const pattern of patterns) {
      const match = question.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  }

  /**
   * Normalize filename to handle common variations
   * Examples: model.Proxy.js → modelProxy.js, my-file.ts → myFile.ts
   */
  private normalizeFilename(filename: string): string {
    // Extract extension
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1) return filename;
    
    const ext = filename.substring(lastDot);
    const name = filename.substring(0, lastDot);
    
    // Remove dots and hyphens, convert to camelCase
    const normalized = name
      .split(/[.\-_]/)
      .map((part, i) => {
        if (i === 0) return part.toLowerCase();
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join('');
    
    return normalized + ext;
  }

  /**
   * Parse tool calls from AI response
   */
  private parseToolCalls(response: string): Array<{action: string, tool: string, parameters: any}> {
    const calls: Array<{action: string, tool: string, parameters: any}> = [];
    const lines = response.split('\n');

    for (const line of lines) {
      // Match numbered lines like "1. readFile - path: /some/path" or "1. **readFile - path**: /some/path"
      // Remove markdown formatting first
      const cleanLine = line.replace(/\*\*/g, '');
      const match = cleanLine.match(/^\d+\.\s*(\w+)\s*[-:]\s*(.+)/);
      
      if (match) {
        const tool = match[1];
        const paramsStr = match[2];
        const parameters: any = {};

        // Parse parameters more robustly
        if (paramsStr.includes('path')) {
          // Match: path: something or path**: something
          const pathMatch = paramsStr.match(/path\*?\*?:\s*([^\s,]+)/);
          if (pathMatch) {
            parameters.path = pathMatch[1].replace(/\\/g, '/'); // Normalize path separators
          }
        }
        if (paramsStr.includes('command')) {
          const cmdMatch = paramsStr.match(/command\*?\*?:\s*(.+?)(?:,|$)/);
          if (cmdMatch) {
            parameters.command = cmdMatch[1].trim();
          }
        }
        if (paramsStr.includes('packageName')) {
          const pkgMatch = paramsStr.match(/packageName\*?\*?:\s*([^\s,]+)/);
          if (pkgMatch) {
            parameters.packageName = pkgMatch[1];
          }
        }
        if (paramsStr.includes('searchText') || paramsStr.includes('pattern')) {
          const searchMatch = paramsStr.match(/(?:searchText|pattern)\*?\*?:\s*(.+?)(?:,|$)/);
          if (searchMatch) {
            parameters.searchText = searchMatch[1].trim().replace(/["\[\]]/g, '');
            parameters.pattern = parameters.searchText;
          }
        }
        if (paramsStr.includes('message')) {
          const msgMatch = paramsStr.match(/message\*?\*?:\s*"?([^"]+)"?/);
          if (msgMatch) {
            parameters.message = msgMatch[1];
          }
        }

        calls.push({
          action: `Execute ${tool}`,
          tool,
          parameters
        });
      }
    }

    return calls;
  }

  /**
   * Execute a specific tool
   */
  private async executeTool(
    toolName: string, 
    parameters: any,
    currentFilePath: string,
    currentFileContent: string
  ): Promise<ToolResult> {
    try {
      switch (toolName) {
        case 'getActiveEditor':
          return await AgentTools.getActiveEditor();
        
        case 'readFile':
          return await AgentTools.readFile(parameters.path || currentFilePath);
        
        case 'writeFile':
          return await AgentTools.writeFile(
            parameters.path || currentFilePath, 
            parameters.content
          );
        
        case 'createFile':
          return await AgentTools.createFile(parameters.path, parameters.content);
        
        case 'replaceInFile':
          return await AgentTools.replaceInFile(
            parameters.path || currentFilePath,
            parameters.oldText,
            parameters.newText
          );
        
        case 'searchFiles':
          return await AgentTools.searchFiles(parameters.pattern, parameters.maxResults);
        
        case 'searchInFiles':
          return await AgentTools.searchInFiles(parameters.searchText, parameters.pattern);
        
        case 'listDirectory':
          return await AgentTools.listDirectory(parameters.path);
        
        case 'applyEdit':
          return await AgentTools.applyEdit(
            parameters.startLine,
            parameters.startChar,
            parameters.endLine,
            parameters.endChar,
            parameters.newText
          );
        
        case 'executeCommand':
          return await AgentTools.executeCommand(parameters.command, parameters.cwd);
        
        case 'installPackage':
          return await AgentTools.installPackage(parameters.packageName, parameters.dev);
        
        case 'runTests':
          return await AgentTools.runTests(parameters.testCommand);
        
        case 'gitCommit':
          return await AgentTools.gitCommit(parameters.message);
        
        case 'getGitStatus':
          return await AgentTools.getGitStatus();
        
        default:
          return {
            success: false,
            error: `Unknown tool: ${toolName}`
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}
