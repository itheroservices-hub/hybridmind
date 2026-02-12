# HybridMind Extension - Development Environment Setup

Complete guide for developing the HybridMind VS Code extension with agentic capabilities and strict JSON tool calls.

## 📋 Prerequisites

- **Node.js**: v18+ (recommended v20+)
- **VS Code**: v1.85.0 or higher
- **npm**: v9+ 
- **Git**: For version control
- **TypeScript**: v5.0+ (installed via npm)

## 🛠️ Development Setup

### 1. Install Extension Dependencies

```bash
cd hybridmind-extension
npm install
```

This installs:
- `@types/vscode` - VS Code extension API types
- `typescript` - TypeScript compiler
- `eslint` - Code linting
- `vsce` - VS Code extension packaging tool

### 2. Install Backend Dependencies

```bash
cd ../hybridmind-backend
npm install
```

This installs all backend services including the new `agenticService.js`.

### 3. Configure Environment Variables

Create/update `.env` in the project root:

```bash
# Backend Server
PORT=3001
NODE_ENV=development

# AI Provider API Keys
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
DEEPSEEK_API_KEY=...
OPENROUTER_API_KEY=sk-or-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...

# Optional
APP_URL=https://hybridmind.app
```

### 4. Build the Extension

```bash
cd hybridmind-extension
npm run compile
```

This compiles TypeScript to JavaScript in the `out/` directory.

## 🚀 Running in Development Mode

### Method 1: VS Code Debug Mode (Recommended)

1. Open the `hybridmind-extension` folder in VS Code
2. Press **F5** or go to Run → Start Debugging
3. This opens a new "Extension Development Host" window
4. The extension runs with full debugging capabilities

### Method 2: Watch Mode + Manual Testing

```bash
# Terminal 1: Watch TypeScript compilation
cd hybridmind-extension
npm run watch

# Terminal 2: Start backend server
cd hybridmind-backend
npm start

# Then press F5 in VS Code to test
```

## 🏗️ Project Structure

```
hybridmind-extension/
├── src/
│   ├── extension.ts              # Main entry point
│   ├── embeddedServer.ts          # Backend server launcher
│   ├── commands/                  # VS Code commands
│   │   ├── chatCommands.ts
│   │   ├── codeCommands.ts
│   │   └── agenticCommands.ts     # NEW: Agentic workflow commands
│   ├── views/                     # Webview panels
│   │   └── chatView.ts
│   ├── agents/                    # Agentic workflow logic
│   │   ├── agentClient.ts         # Backend API client
│   │   └── toolExecutor.ts        # NEW: Executes JSON tool calls
│   └── auth/
│       └── licenseManager.ts
├── out/                           # Compiled JavaScript (git-ignored)
├── package.json                   # Extension manifest
├── tsconfig.json                  # TypeScript config
└── .vscodeignore                  # Files to exclude from package

hybridmind-backend/
├── config/
│   ├── agenticPrompts.js          # NEW: Strict JSON system prompt
│   └── models.js
├── services/
│   ├── agenticService.js          # NEW: Multi-provider AI service
│   └── modelProxy.js
├── utils/
│   └── toolCallValidator.js       # NEW: JSON validation
└── routes/
    └── agent.js                   # NEW: /agent/execute endpoint
```

## 🔧 Key Development Tasks

### 1. Test Extension in Debug Mode

```bash
# In VS Code
1. Open hybridmind-extension folder
2. Press F5
3. In the Extension Development Host:
   - Open Command Palette (Ctrl+Shift+P)
   - Run "HybridMind: Open Chat Window"
```

### 2. Test Backend Independently

```bash
cd hybridmind-backend
npm start

# Run automated tests
node test-agentic-strict-json.js

# Or manual curl tests
test-manual-curl.bat
```

### 3. Watch for Changes

```bash
# Terminal 1: Backend with auto-restart
cd hybridmind-backend
npx nodemon server.js

# Terminal 2: Extension TypeScript watch
cd hybridmind-extension
npm run watch

# Press Ctrl+R in Extension Development Host to reload
```

## 🎯 Integrating Strict JSON Tool Calls

### Step 1: Create Agent Client

Create `src/agents/agentClient.ts`:

```typescript
import axios from 'axios';

export interface ToolCall {
  tool: string;
  [key: string]: any;
}

export async function executeAgenticWorkflow(
  prompt: string,
  context?: string,
  model: string = 'gpt-4-turbo-preview',
  provider: string = 'openai'
): Promise<ToolCall> {
  const response = await axios.post('http://localhost:3001/agent/execute', {
    prompt,
    context,
    model,
    provider
  });

  if (!response.data.success) {
    throw new Error(response.data.error);
  }

  return response.data.data.toolCall;
}
```

### Step 2: Create Tool Executor

Create `src/agents/toolExecutor.ts`:

```typescript
import * as vscode from 'vscode';
import { ToolCall } from './agentClient';

export async function executeToolCall(toolCall: ToolCall): Promise<void> {
  switch (toolCall.tool) {
    case 'apply_edit':
      await applyEdit(toolCall);
      break;
    case 'insert_text':
      await insertText(toolCall);
      break;
    case 'create_file':
      await createFile(toolCall);
      break;
    case 'batch':
      for (const action of toolCall.actions) {
        await executeToolCall(action);
      }
      break;
    case 'thought':
      console.log('AI thought:', toolCall.content);
      break;
    case 'request_clarification':
      const answer = await vscode.window.showInputBox({
        prompt: toolCall.question
      });
      // Handle user's answer...
      break;
  }
}

async function applyEdit(tool: any): Promise<void> {
  const uri = vscode.Uri.file(tool.file);
  const doc = await vscode.workspace.openTextDocument(uri);
  const edit = new vscode.WorkspaceEdit();
  
  const range = new vscode.Range(
    tool.start.line,
    tool.start.character,
    tool.end.line,
    tool.end.character
  );
  
  edit.replace(uri, range, tool.text);
  await vscode.workspace.applyEdit(edit);
}

// Implement insertText, createFile, etc...
```

### Step 3: Create Agentic Command

Create `src/commands/agenticCommands.ts`:

```typescript
import * as vscode from 'vscode';
import { executeAgenticWorkflow } from '../agents/agentClient';
import { executeToolCall } from '../agents/toolExecutor';

export function registerAgenticCommands(context: vscode.ExtensionContext) {
  
  // Command: Execute agentic workflow
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.runAgenticWorkflow', async () => {
      const prompt = await vscode.window.showInputBox({
        prompt: 'What would you like the AI to do?',
        placeHolder: 'e.g., Fix the bug in app.ts'
      });

      if (!prompt) return;

      const editor = vscode.window.activeTextEditor;
      const context = editor?.document.getText() || '';

      try {
        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'Running agentic workflow...',
          cancellable: false
        }, async () => {
          const toolCall = await executeAgenticWorkflow(prompt, context);
          await executeToolCall(toolCall);
          vscode.window.showInformationMessage('Workflow completed!');
        });
      } catch (error) {
        vscode.window.showErrorMessage(`Workflow failed: ${error.message}`);
      }
    })
  );
}
```

### Step 4: Register in extension.ts

Update `src/extension.ts`:

```typescript
import { registerAgenticCommands } from './commands/agenticCommands';

export function activate(context: vscode.ExtensionContext) {
  // Existing registrations...
  
  // NEW: Register agentic commands
  registerAgenticCommands(context);
}
```

## 🧪 Testing Workflow

1. **Start Backend**: `cd hybridmind-backend && npm start`
2. **Compile Extension**: `cd hybridmind-extension && npm run compile`
3. **Press F5**: Opens Extension Development Host
4. **Test Command**: 
   - `Ctrl+Shift+P` → "HybridMind: Run Agentic Workflow"
   - Enter: "Add a TODO comment at line 5"
   - Verify the edit is applied

## 📦 Packaging for Distribution

```bash
cd hybridmind-extension

# Install vsce if not already installed
npm install -g @vscode/vsce

# Package extension
vsce package

# This creates: hybridmind-1.4.1.vsix
```

## 🔍 Debugging Tips

### Debug Extension
- Set breakpoints in TypeScript files
- Press F5 to start debugging
- Use Debug Console to inspect variables

### Debug Backend
- Use `console.log()` in backend files
- Check terminal output where backend is running
- Use Postman/curl to test endpoints directly

### Common Issues

**Extension doesn't load:**
- Check `out/` directory exists after compiling
- Verify no TypeScript errors: `npm run compile`

**Backend not responding:**
- Check port 3001 is free
- Verify `.env` file exists with API keys
- Check `npm start` output for errors

**Tool calls fail:**
- Check backend logs for validation errors
- Verify API keys are correct
- Test endpoint with curl first

## 📚 Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Extension Samples](https://github.com/microsoft/vscode-extension-samples)
- [Backend Documentation](./STRICT_JSON_IMPLEMENTATION.md)

## 🤝 Development Workflow

1. Make changes to TypeScript files
2. Run `npm run compile` or use watch mode
3. Press `Ctrl+R` in Extension Development Host to reload
4. Test your changes
5. Commit and push when ready

## 📝 Next Steps

- [ ] Implement full tool executor for all tool types
- [ ] Add error recovery and retry logic in extension
- [ ] Create UI for viewing agentic workflow progress
- [ ] Add configuration for default model/provider
- [ ] Implement token usage tracking
- [ ] Add unit tests for extension code
