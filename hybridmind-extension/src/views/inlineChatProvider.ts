/**
 * HybridMind v1.1 - Inline Chat Provider
 * Cursor-style inline chat with Ctrl+K
 */

import * as vscode from 'vscode';
import { LicenseManager } from '../auth/licenseManager';

export class InlineChatProvider {
  private _serverPort: number;
  private _licenseManager: LicenseManager;
  private _currentDecoration: vscode.TextEditorDecorationType | undefined;

  constructor(serverPort: number) {
    this._serverPort = serverPort;
    this._licenseManager = LicenseManager.getInstance();
  }

  public async showInlineChat() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor');
      return;
    }

    // Get selected text or current line
    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);
    const isSelection = !selection.isEmpty;

    // Show input box for user prompt
    const prompt = await vscode.window.showInputBox({
      placeHolder: isSelection ? 
        'What would you like to do with the selected code?' : 
        'What would you like to generate?',
      prompt: 'HybridMind Inline Chat',
      ignoreFocusOut: true
    });

    if (!prompt) {
      return;
    }

    // Show quick pick for action type
    const action = await vscode.window.showQuickPick([
      { label: '$(edit) Edit', value: 'edit', description: 'Modify the selected code' },
      { label: '$(add) Generate', value: 'generate', description: 'Generate new code' },
      { label: '$(comment) Explain', value: 'explain', description: 'Explain the code' },
      { label: '$(bug) Fix', value: 'fix', description: 'Fix bugs or issues' },
      { label: '$(beaker) Test', value: 'test', description: 'Generate tests' },
      { label: '$(rocket) Optimize', value: 'optimize', description: 'Optimize performance' }
    ], {
      placeHolder: 'What would you like to do?'
    });

    if (!action) {
      return;
    }

    // Show progress
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'HybridMind is thinking...',
      cancellable: false
    }, async (progress) => {
      try {
        // Build the full prompt
        const fullPrompt = this._buildPrompt(prompt, action.value, selectedText, editor.document);

        // Call API
        const response = await fetch(`http://localhost:${this._serverPort}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: fullPrompt }],
            model: 'gpt-4', // Can be made configurable
            tier: this._licenseManager.isPro() ? 'pro' : 'free'
          })
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json() as any;
        const result = data.response || data.message;

        // Handle the response based on action type
        await this._handleResponse(result, action.value, editor, selection);

      } catch (error: any) {
        vscode.window.showErrorMessage(`HybridMind Error: ${error.message}`);
      }
    });
  }

  private _buildPrompt(userPrompt: string, action: string, selectedText: string, document: vscode.TextDocument): string {
    const languageId = document.languageId;
    const fileName = document.fileName;

    let systemPrompt = '';
    
    switch (action) {
      case 'edit':
        systemPrompt = `You are a code editor assistant. Modify the following ${languageId} code according to the user's request. Return ONLY the modified code, no explanations.`;
        break;
      case 'generate':
        systemPrompt = `You are a code generation assistant. Generate ${languageId} code according to the user's request. Return ONLY the code, no explanations.`;
        break;
      case 'explain':
        systemPrompt = `You are a code explainer. Explain the following ${languageId} code in clear, concise terms.`;
        break;
      case 'fix':
        systemPrompt = `You are a debugging assistant. Fix any bugs or issues in the following ${languageId} code. Return ONLY the fixed code, no explanations.`;
        break;
      case 'test':
        systemPrompt = `You are a test generation assistant. Generate comprehensive unit tests for the following ${languageId} code. Return ONLY the test code.`;
        break;
      case 'optimize':
        systemPrompt = `You are a code optimization assistant. Optimize the following ${languageId} code for better performance and maintainability. Return ONLY the optimized code, no explanations.`;
        break;
    }

    if (selectedText) {
      return `${systemPrompt}\n\nFile: ${fileName}\n\nCode:\n\`\`\`${languageId}\n${selectedText}\n\`\`\`\n\nRequest: ${userPrompt}`;
    } else {
      return `${systemPrompt}\n\nFile: ${fileName}\nLanguage: ${languageId}\n\nRequest: ${userPrompt}`;
    }
  }

  private async _handleResponse(result: string, action: string, editor: vscode.TextEditor, selection: vscode.Selection) {
    // Extract code from markdown code blocks if present
    const codeMatch = result.match(/```[\w]*\n([\s\S]*?)\n```/);
    const code = codeMatch ? codeMatch[1] : result;

    if (action === 'explain') {
      // Show explanation in a new document
      const doc = await vscode.workspace.openTextDocument({
        content: result,
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside });
    } else if (action === 'generate' && selection.isEmpty) {
      // Insert at cursor
      await editor.edit((editBuilder) => {
        editBuilder.insert(selection.active, code);
      });
    } else if (action === 'test') {
      // Create new test file or insert below
      const testResult = await vscode.window.showQuickPick([
        { label: '$(file-add) New Test File', value: 'new' },
        { label: '$(insert) Insert Below', value: 'insert' }
      ]);

      if (testResult?.value === 'new') {
        const doc = await vscode.workspace.openTextDocument({
          content: code,
          language: editor.document.languageId
        });
        await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside });
      } else {
        await editor.edit((editBuilder) => {
          editBuilder.insert(selection.end, '\n\n' + code);
        });
      }
    } else {
      // Show diff and ask to apply
      const action = await this._showDiff(editor, selection, code);
      
      if (action === 'accept') {
        await editor.edit((editBuilder) => {
          if (selection.isEmpty) {
            editBuilder.insert(selection.active, code);
          } else {
            editBuilder.replace(selection, code);
          }
        });
      }
    }
  }

  private async _showDiff(editor: vscode.TextEditor, selection: vscode.Selection, newCode: string): Promise<'accept' | 'reject'> {
    // Create a temporary document with the new code
    const originalCode = editor.document.getText(selection);
    
    // Show quick pick with preview
    const choice = await vscode.window.showQuickPick([
      { label: '$(check) Accept Changes', value: 'accept', description: 'Apply the AI-generated code' },
      { label: '$(x) Reject Changes', value: 'reject', description: 'Keep the original code' },
      { label: '$(eye) Show Diff', value: 'diff', description: 'View side-by-side comparison' }
    ], {
      placeHolder: 'Review the AI-generated code'
    });

    if (!choice) {
      return 'reject';
    }

    if (choice.value === 'diff') {
      // Create temporary documents for diff view
      const originalDoc = await vscode.workspace.openTextDocument({
        content: originalCode,
        language: editor.document.languageId
      });

      const newDoc = await vscode.workspace.openTextDocument({
        content: newCode,
        language: editor.document.languageId
      });

      await vscode.commands.executeCommand('vscode.diff', 
        originalDoc.uri, 
        newDoc.uri, 
        'Original ↔ AI Generated'
      );

      // Ask again after showing diff
      const finalChoice = await vscode.window.showQuickPick([
        { label: '$(check) Accept Changes', value: 'accept' },
        { label: '$(x) Reject Changes', value: 'reject' }
      ]);

      return finalChoice?.value as 'accept' | 'reject' || 'reject';
    }

    return choice.value as 'accept' | 'reject';
  }

  public async quickFix(action: 'explain' | 'review' | 'optimize' | 'fix' | 'tests') {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor');
      return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText) {
      vscode.window.showWarningMessage('Please select some code first');
      return;
    }

    const prompts = {
      explain: 'Explain this code in detail',
      review: 'Review this code for best practices, potential bugs, and improvements',
      optimize: 'Optimize this code for better performance and readability',
      fix: 'Find and fix any bugs or issues in this code',
      tests: 'Generate comprehensive unit tests for this code'
    };

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `HybridMind is ${action}ing your code...`,
      cancellable: false
    }, async (progress) => {
      try {
        const languageId = editor.document.languageId;
        const fullPrompt = `${prompts[action]}\n\nLanguage: ${languageId}\n\nCode:\n\`\`\`${languageId}\n${selectedText}\n\`\`\``;

        const response = await fetch(`http://localhost:${this._serverPort}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: fullPrompt }],
            model: 'gpt-4',
            tier: this._licenseManager.isPro() ? 'pro' : 'free'
          })
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data: any = await response.json();
        const result = data.response || data.message;

        // Show result in a new document
        const doc = await vscode.workspace.openTextDocument({
          content: result,
          language: action === 'explain' || action === 'review' ? 'markdown' : editor.document.languageId
        });
        await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: false });

      } catch (error: any) {
        vscode.window.showErrorMessage(`HybridMind Error: ${error.message}`);
      }
    });
  }

  public dispose() {
    if (this._currentDecoration) {
      this._currentDecoration.dispose();
    }
  }
}
