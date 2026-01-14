/**
 * Agentic Commands - Commands that execute AI-driven code modifications
 * Uses strict JSON tool calls from the backend
 */

import * as vscode from 'vscode';
import { AgentTools } from '../agents/agentTools';
import { AgenticExecutor } from '../agents/agenticExecutor';
import { agentClient } from '../agents/agentClient';
import { toolExecutor } from '../agents/toolExecutor';

/**
 * Helper: Call your AI backend
 */
async function callAI(serverPort: number, modelId: string, prompt: string): Promise<string> {
  try {
    const response = await fetch(`http://localhost:${serverPort}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'system', content: 'You are an autonomous coding agent that can modify code directly.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || data.content || '';
  } catch (error: any) {
    throw new Error(`AI call failed: ${error.message}`);
  }
}

/**
 * Command: Fix Bugs Autonomously
 * This actually fixes bugs, not just suggests fixes
 */
export async function registerFixBugsCommand(
  context: vscode.ExtensionContext, 
  serverPort: number
) {
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.fixBugs', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active file');
        return;
      }

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Fixing bugs autonomously...',
        cancellable: false
      }, async (progress) => {
        try {
          // 1. Get diagnostics (errors/warnings)
          progress.report({ message: 'Analyzing errors...' });
          const filePath = editor.document.uri.fsPath;
          const diagnostics = await AgentTools.getDiagnostics(filePath);

          if (!diagnostics.success || !diagnostics.data?.issues?.length) {
            vscode.window.showInformationMessage('No errors found!');
            return;
          }

          // 2. Read file content
          const fileResult = await AgentTools.readFile(filePath);
          if (!fileResult.success) {
            throw new Error('Could not read file');
          }

          const content = fileResult.data.content;
          const issues = diagnostics.data.issues;

          // 3. Create agentic prompt
          const context = `
File: ${filePath}
Language: ${editor.document.languageId}

Errors/Warnings:
${issues.map((issue: any) => 
  `Line ${issue.line}: [${issue.severity}] ${issue.message}`
).join('\n')}

File Content:
${content}
          `;

          const prompt = AgenticExecutor.createAgenticPrompt(
            'Fix all errors and warnings in this file',
            context
          );

          // 4. Get AI response with tool calls
          progress.report({ message: 'Getting AI solution...' });
          const aiResponse = await callAI(serverPort, 'deepseek-chat', prompt);

          // 5. EXECUTE THE FIXES!
          progress.report({ message: 'Applying fixes...' });
          const result = await AgenticExecutor.executeWithConfirmation(aiResponse);

          // 6. Show results
          if (result.success) {
            vscode.window.showInformationMessage(`✅ Bugs fixed!\n${result.summary}`);
          } else {
            vscode.window.showWarningMessage(`⚠️ Some fixes failed:\n${result.summary}`);
          }
        } catch (error: any) {
          vscode.window.showErrorMessage(`Failed to fix bugs: ${error.message}`);
        }
      });
    })
  );
}

/**
 * Command: Optimize Code Autonomously
 */
export async function registerOptimizeCodeCommand(
  context: vscode.ExtensionContext,
  serverPort: number
) {
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.optimizeCode', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active file');
        return;
      }

      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);
      
      if (!selectedText) {
        vscode.window.showWarningMessage('Please select code to optimize');
        return;
      }

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Optimizing code...',
        cancellable: false
      }, async (progress) => {
        try {
          const filePath = editor.document.uri.fsPath;
          
          // Create context with file info and selection
          const context = `
File: ${filePath}
Language: ${editor.document.languageId}
Start Line: ${selection.start.line + 1}
End Line: ${selection.end.line + 1}

Selected Code:
${selectedText}
          `;

          const prompt = AgenticExecutor.createAgenticPrompt(
            'Optimize this code for performance and readability. Keep the same functionality.',
            context
          );

          progress.report({ message: 'Analyzing code...' });
          const aiResponse = await callAI(serverPort, 'deepseek-chat', prompt);

          progress.report({ message: 'Applying optimizations...' });
          const result = await AgenticExecutor.executeWithConfirmation(aiResponse);

          if (result.success) {
            vscode.window.showInformationMessage(`✅ Code optimized!\n${result.summary}`);
            
            // Format the document after optimization
            await AgentTools.formatDocument(filePath);
          } else {
            vscode.window.showWarningMessage(`⚠️ Optimization incomplete:\n${result.summary}`);
          }
        } catch (error: any) {
          vscode.window.showErrorMessage(`Optimization failed: ${error.message}`);
        }
      });
    })
  );
}

/**
 * Command: Generate Tests (and actually create the test file!)
 */
export async function registerGenerateTestsCommand(
  context: vscode.ExtensionContext,
  serverPort: number
) {
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.generateTests', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active file');
        return;
      }

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Generating tests...',
        cancellable: false
      }, async (progress) => {
        try {
          const filePath = editor.document.uri.fsPath;
          const fileResult = await AgentTools.readFile(filePath);
          
          if (!fileResult.success) {
            throw new Error('Could not read file');
          }

          const content = fileResult.data.content;
          
          // Determine test file path
          const testFilePath = filePath.replace(/\.(ts|js)$/, '.test.$1');
          
          const context = `
Source File: ${filePath}
Language: ${editor.document.languageId}
Test File Path: ${testFilePath}

Source Code:
${content}
          `;

          const prompt = `You are a test generation expert.

TASK: Generate comprehensive unit tests for this code

${context}

Create the test file with:
- All necessary imports
- Test cases for each function/method
- Edge cases and error scenarios
- Mock data where needed

Respond with a tool call to create_file:

\`\`\`tool
{
  "tool": "create_file",
  "parameters": {
    "filePath": "${testFilePath}",
    "content": "// Your complete test file here"
  }
}
\`\`\``;

          progress.report({ message: 'Generating test code...' });
          const aiResponse = await callAI(serverPort, 'claude-sonnet-4.5', prompt);

          progress.report({ message: 'Creating test file...' });
          const result = await AgenticExecutor.executeFromAI(aiResponse);

          if (result.success) {
            vscode.window.showInformationMessage(`✅ Test file created: ${testFilePath}`);
          } else {
            vscode.window.showWarningMessage(`⚠️ Test generation incomplete:\n${result.summary}`);
          }
        } catch (error: any) {
          vscode.window.showErrorMessage(`Test generation failed: ${error.message}`);
        }
      });
    })
  );
}

/**
 * Command: Autonomous Refactor
 * User describes what they want, AI does it
 */
export async function registerRefactorCommand(
  context: vscode.ExtensionContext,
  serverPort: number
) {
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.refactorWithAI', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active file');
        return;
      }

      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);
      
      if (!selectedText) {
        vscode.window.showWarningMessage('Please select code to refactor');
        return;
      }

      // Ask what kind of refactoring
      const refactorGoal = await vscode.window.showInputBox({
        prompt: 'What refactoring should I perform?',
        placeHolder: 'e.g., "Extract to separate functions", "Add error handling", "Convert to async/await"'
      });

      if (!refactorGoal) return;

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Refactoring: ${refactorGoal}`,
        cancellable: false
      }, async (progress) => {
        try {
          const filePath = editor.document.uri.fsPath;
          
          const context = `
File: ${filePath}
Language: ${editor.document.languageId}
Selection Start: Line ${selection.start.line + 1}
Selection End: Line ${selection.end.line + 1}

Selected Code:
${selectedText}
          `;

          const prompt = AgenticExecutor.createAgenticPrompt(
            `Refactor this code: ${refactorGoal}`,
            context
          );

          progress.report({ message: 'Planning refactoring...' });
          const aiResponse = await callAI(serverPort, 'claude-sonnet-4.5', prompt);

          progress.report({ message: 'Applying refactoring...' });
          const result = await AgenticExecutor.executeWithConfirmation(aiResponse);

          if (result.success) {
            vscode.window.showInformationMessage(`✅ Refactoring complete!\n${result.summary}`);
            await AgentTools.formatDocument(filePath);
          } else {
            vscode.window.showWarningMessage(`⚠️ Refactoring incomplete:\n${result.summary}`);
          }
        } catch (error: any) {
          vscode.window.showErrorMessage(`Refactoring failed: ${error.message}`);
        }
      });
    })
  );
}

/**
 * Command: Autonomous Debug Loop
 * Iteratively fixes errors until none remain
 */
export async function registerDebugLoopCommand(
  context: vscode.ExtensionContext,
  serverPort: number
) {
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.autonomousDebug', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active file');
        return;
      }

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Autonomous debugging...',
        cancellable: true
      }, async (progress, token) => {
        const filePath = editor.document.uri.fsPath;
        const maxIterations = 5;
        let iteration = 0;

        while (iteration < maxIterations && !token.isCancellationRequested) {
          iteration++;
          progress.report({ message: `Iteration ${iteration}/${maxIterations}...` });

          // Check for errors
          const diagnostics = await AgentTools.getDiagnostics(filePath);
          
          if (!diagnostics.data?.issues?.length) {
            vscode.window.showInformationMessage(`✅ All errors fixed in ${iteration} iterations!`);
            return;
          }

          // Read current file state
          const fileResult = await AgentTools.readFile(filePath);
          if (!fileResult.success) break;

          const context = `
Iteration: ${iteration}/${maxIterations}
File: ${filePath}

Current Errors:
${diagnostics.data.issues.map((issue: any) => 
  `Line ${issue.line}: ${issue.message}`
).join('\n')}

Current Code:
${fileResult.data.content}
          `;

          const prompt = AgenticExecutor.createAgenticPrompt(
            'Fix the next error. Make minimal, precise changes.',
            context
          );

          // Get fix from AI
          const aiResponse = await callAI(serverPort, 'deepseek-chat', prompt);

          // Apply fix
          const result = await AgenticExecutor.executeFromAI(aiResponse);

          if (!result.success) {
            vscode.window.showWarningMessage(`Iteration ${iteration} failed: ${result.summary}`);
            break;
          }

          // Wait for language server to update
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (iteration >= maxIterations) {
          vscode.window.showWarningMessage('Max iterations reached. Some errors may remain.');
        }
      });
    })
  );
}

/**
 * Register all agentic commands
 */
export function registerAgenticCommands(
  context: vscode.ExtensionContext,
  serverPort: number
) {
  // Legacy commands (existing implementation)
  registerFixBugsCommand(context, serverPort);
  registerOptimizeCodeCommand(context, serverPort);
  registerGenerateTestsCommand(context, serverPort);
  registerRefactorCommand(context, serverPort);
  registerDebugLoopCommand(context, serverPort);

  // NEW: Strict JSON workflow commands
  registerStrictJsonWorkflowCommand(context);
  registerQuickFixCommand(context);
  registerAddFeatureCommand(context);
  registerShowAgentOutputCommand(context);
}

/**
 * NEW: Main strict JSON agentic workflow
 */
function registerStrictJsonWorkflowCommand(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.runStrictJsonWorkflow', async () => {
      const prompt = await vscode.window.showInputBox({
        prompt: 'What would you like the AI agent to do?',
        placeHolder: 'e.g., Fix the bug in app.ts, Add error handling, Create a new component',
        ignoreFocusOut: true
      });

      if (!prompt) return;

      const editor = vscode.window.activeTextEditor;
      const context = editor ? getEditorContext(editor) : '';

      const model = await selectModel();
      const provider = getProviderForModel(model);

      await executeStrictJsonWorkflow({ prompt, context, model, provider });
    })
  );
}

/**
 * NEW: Quick fix with strict JSON
 */
function registerQuickFixCommand(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.strictJsonQuickFix', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);

      if (!selectedText) {
        vscode.window.showWarningMessage('Please select code to fix');
        return;
      }

      const fileName = editor.document.fileName.split(/[/\\]/).pop() || 'file';
      const prompt = `Fix any issues in the selected code from ${fileName}. Focus on bugs, type errors, and best practices.`;

      await executeStrictJsonWorkflow({
        prompt,
        context: getEditorContext(editor),
        model: 'gpt-4-turbo-preview',
        provider: 'openai'
      });
    })
  );
}

/**
 * NEW: Add feature with strict JSON
 */
function registerAddFeatureCommand(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.strictJsonAddFeature', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const feature = await vscode.window.showInputBox({
        prompt: 'What feature would you like to add?',
        placeHolder: 'e.g., Add input validation, Add logging, Add error handling',
        ignoreFocusOut: true
      });

      if (!feature) return;

      const fileName = editor.document.fileName.split(/[/\\]/).pop() || 'file';
      const prompt = `Add the following feature to ${fileName}: ${feature}. Make sure to integrate it properly with existing code.`;

      await executeStrictJsonWorkflow({
        prompt,
        context: getEditorContext(editor),
        model: 'gpt-4-turbo-preview',
        provider: 'openai'
      });
    })
  );
}

/**
 * NEW: Show agent output
 */
function registerShowAgentOutputCommand(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.showAgentOutput', () => {
      toolExecutor.showOutput();
    })
  );
}

/**
 * Execute strict JSON workflow with progress UI
 */
async function executeStrictJsonWorkflow(options: {
  prompt: string;
  context?: string;
  model?: string;
  provider?: string;
}): Promise<void> {
  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'HybridMind Agent',
        cancellable: false
      },
      async (progress) => {
        progress.report({ message: 'Connecting to backend...' });

        const connected = await agentClient.testConnection();
        if (!connected) {
          throw new Error('Cannot connect to HybridMind backend. Please ensure the server is running.');
        }

        progress.report({ message: 'Generating tool calls...' });

        const toolCall = await agentClient.executeWorkflow(options);

        progress.report({ message: 'Executing actions...' });

        await toolExecutor.execute(toolCall);

        vscode.window.showInformationMessage('✅ Workflow completed successfully!');
        toolExecutor.showOutput();
      }
    );
  } catch (error: any) {
    vscode.window.showErrorMessage(`Workflow failed: ${error.message}`);
    console.error('Strict JSON workflow error:', error);
  }
}

/**
 * Get editor context for AI
 */
function getEditorContext(editor: vscode.TextEditor): string {
  const document = editor.document;
  const fileName = document.fileName.split(/[/\\]/).pop() || 'file';
  const selection = editor.selection;
  const selectedText = document.getText(selection);

  let context = `File: ${fileName}\n\n`;

  if (selectedText) {
    context += `Selected code:\n${selectedText}\n\n`;
  }

  context += `Full file content:\n${document.getText()}`;

  return context;
}

/**
 * Select model from quick pick
 */
async function selectModel(): Promise<string> {
  const models = [
    { label: '$(star) GPT-4 Turbo', description: 'Most capable, best for complex tasks', value: 'gpt-4-turbo-preview' },
    { label: '$(star) GPT-4o', description: 'Fast and capable', value: 'gpt-4o' },
    { label: '$(zap) Llama 3.3 70B', description: 'Free, fast via Groq', value: 'llama-3.3-70b-versatile' },
    { label: '$(zap) DeepSeek V3', description: 'Excellent for coding, very cheap', value: 'deepseek-chat' },
    { label: '$(star) Claude Sonnet 4.5', description: 'Excellent reasoning', value: 'claude-sonnet-4-20250514' },
    { label: '$(zap) Gemini 2.0 Flash', description: 'Fast and free', value: 'gemini-2.0-flash-exp' }
  ];

  const selected = await vscode.window.showQuickPick(models, {
    placeHolder: 'Select AI model for this workflow',
    ignoreFocusOut: true
  });

  return selected?.value || 'gpt-4-turbo-preview';
}

/**
 * Get provider for a given model
 */
function getProviderForModel(model: string): string {
  if (model.includes('gpt')) return 'openai';
  if (model.includes('llama') || model.includes('mixtral')) return 'groq';
  if (model.includes('deepseek')) return 'deepseek';
  if (model.includes('claude')) return 'anthropic';
  if (model.includes('gemini')) return 'gemini';
  return 'openai';
}

