# Agentic Execution Guide

## Why Your Extension Wasn't Taking Actions

Your extension was **analyzing** code but not **executing** actions because you were missing the bridge between AI responses and VS Code's editing APIs.

GitHub Copilot works because it:
1. **Parses tool calls** from AI responses
2. **Converts them to WorkspaceEdits** 
3. **Applies them atomically** using VS Code APIs
4. **Provides feedback** to the AI for iterative improvements

## What Was Added

### 1. WorkspaceEdit APIs (`agentTools.ts`)
- `applyWorkspaceEdit()` - Make multiple coordinated edits
- `replaceAtLocation()` - Precise line-level edits
- `insertAt()` - Insert text at exact positions
- `deleteRange()` - Remove code sections
- `getDiagnostics()` - Get errors/warnings
- `formatDocument()` - Auto-format code

### 2. Agentic Executor (`agenticExecutor.ts`)
- Parses AI responses for tool calls
- Executes tools automatically
- Handles errors gracefully
- Provides execution summaries

## How to Use

### Example 1: Simple Code Fix

```typescript
import { AgenticExecutor } from './agents/agenticExecutor';

// The AI responds with tool calls
const aiResponse = `
I'll fix the bug on line 23.

\`\`\`tool
{
  "tool": "replace_at_location",
  "parameters": {
    "filePath": "e:\\\\project\\\\src\\\\app.ts",
    "lineNumber": 23,
    "oldText": "const x = null;",
    "newText": "const x = undefined;"
  }
}
\`\`\`
`;

// Execute it!
const result = await AgenticExecutor.executeFromAI(aiResponse);
console.log(result.summary); // ✅ replace at location
```

### Example 2: Multi-File Refactor

```typescript
const aiResponse = `
\`\`\`tool
[
  {
    "tool": "replace_in_file",
    "parameters": {
      "filePath": "src/user.ts",
      "oldText": "export class User {",
      "newText": "export class UserModel {"
    }
  },
  {
    "tool": "replace_in_file",
    "parameters": {
      "filePath": "src/controller.ts",
      "oldText": "import { User }",
      "newText": "import { UserModel }"
    }
  }
]
\`\`\`
`;

const result = await AgenticExecutor.executeFromAI(aiResponse);
// Executes both edits atomically
```

### Example 3: With User Confirmation

```typescript
// Ask user before executing
const result = await AgenticExecutor.executeWithConfirmation(
  aiResponse,
  false // autoApprove = false shows confirmation dialog
);
```

### Example 4: Full Autonomous Agent

```typescript
import { AgenticExecutor } from './agents/agenticExecutor';

async function autonomousCodeFix(userRequest: string) {
  // 1. Get current file context
  const editorResult = await AgentTools.getActiveEditor();
  const context = `
File: ${editorResult.data.filePath}
Content: ${(await AgentTools.readFile(editorResult.data.filePath)).data.content}
  `;

  // 2. Create agentic prompt
  const prompt = AgenticExecutor.createAgenticPrompt(userRequest, context);

  // 3. Get AI response with tool calls
  const aiResponse = await callYourAI(prompt);

  // 4. Execute automatically
  const result = await AgenticExecutor.executeFromAI(aiResponse);

  // 5. Show results
  vscode.window.showInformationMessage(result.summary);
}
```

## Integrating into Your Commands

Update your existing commands to use agentic execution:

### Before (Suggestion Only):
```typescript
vscode.commands.registerCommand('hybridmind.fixBugs', async () => {
  const analysis = await agent.execute('fix bugs', false);
  // Just shows suggestions, doesn't actually fix
  showSuggestions(analysis.suggestions);
});
```

### After (Actual Execution):
```typescript
vscode.commands.registerCommand('hybridmind.fixBugs', async () => {
  // Get context
  const editor = await AgentTools.getActiveEditor();
  const diagnostics = await AgentTools.getDiagnostics(editor.data.filePath);
  
  const context = `
File: ${editor.data.filePath}
Errors: ${JSON.stringify(diagnostics.data.issues, null, 2)}
Code: ${(await AgentTools.readFile(editor.data.filePath)).data.content}
  `;

  // Create agentic prompt
  const prompt = AgenticExecutor.createAgenticPrompt(
    'Fix all bugs in this file',
    context
  );

  // Get AI response
  const aiResponse = await callYourAI(prompt);

  // EXECUTE IT!
  const result = await AgenticExecutor.executeWithConfirmation(aiResponse);
  
  vscode.window.showInformationMessage(result.summary);
});
```

## AI Prompt Engineering for Tool Calls

Your AI needs to respond in a specific format. Train it like this:

```typescript
const systemPrompt = `You are an autonomous coding agent.

When you need to take actions, respond with tool calls in this format:

\`\`\`tool
{
  "tool": "replace_at_location",
  "parameters": {
    "filePath": "/absolute/path/to/file.ts",
    "lineNumber": 42,
    "oldText": "exact text to replace",
    "newText": "new text"
  },
  "reasoning": "Why this change is needed"
}
\`\`\`

Available tools:
- replace_at_location: Fix code at specific line
- insert_at: Add new code
- delete_range: Remove code
- create_file: Create new files
- execute_command: Run terminal commands
- format_document: Format code
- get_diagnostics: Check for errors

Always include reasoning and be precise.`;
```

## Key Differences from Before

| Before | After |
|--------|-------|
| Returns suggestions only | Actually executes changes |
| Manual copy-paste needed | Direct file modification |
| Single-step analysis | Multi-step autonomous loops |
| No error detection | Gets diagnostics and fixes them |
| Can't format code | Formats automatically |
| Can't create files | Creates files atomically |

## Advanced: Iterative Agent Loop

```typescript
async function autonomousDebugLoop(maxIterations = 5) {
  for (let i = 0; i < maxIterations; i++) {
    // 1. Check for errors
    const diagnostics = await AgentTools.getDiagnostics();
    
    if (diagnostics.data.files.length === 0) {
      vscode.window.showInformationMessage('✅ No errors found!');
      break;
    }

    // 2. Get AI to fix errors
    const context = `Errors found: ${JSON.stringify(diagnostics.data)}`;
    const prompt = AgenticExecutor.createAgenticPrompt('Fix all errors', context);
    const aiResponse = await callYourAI(prompt);

    // 3. Execute fixes
    const result = await AgenticExecutor.executeFromAI(aiResponse);

    // 4. Verify
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for LSP
    
    console.log(`Iteration ${i + 1}: ${result.summary}`);
  }
}
```

## Testing Your Agentic Extension

1. **Simple test**: Fix a typo
   ```typescript
   const response = `{"tool":"replace_at_location","parameters":{"filePath":"test.ts","lineNumber":1,"oldText":"functio","newText":"function"}}`;
   await AgenticExecutor.executeFromAI(response);
   ```

2. **Multi-edit test**: Rename a variable
   ```typescript
   const response = `
   \`\`\`tool
   [
     {"tool":"replace_in_file","parameters":{"filePath":"test.ts","oldText":"oldName","newText":"newName"}},
     {"tool":"format_document","parameters":{"filePath":"test.ts"}}
   ]
   \`\`\`
   `;
   await AgenticExecutor.executeFromAI(response);
   ```

## Next Steps

1. ✅ **Tool execution** - Done! Added WorkspaceEdit APIs
2. ✅ **Agentic parser** - Done! Can parse and execute tool calls
3. 🔄 **Update your agent prompts** to output tool calls
4. 🔄 **Modify your commands** to use AgenticExecutor
5. 🔄 **Test with real AI models** (Claude, GPT-4, DeepSeek)
6. 🚀 **Add iterative loops** for complex tasks

## Why This Matters

Without agentic execution, your extension is just a **chatbot**.
With agentic execution, it becomes a **coding assistant** that actually helps.

Users want:
- "Fix this bug" → Fixed automatically ✅
- "Refactor this function" → Done ✅  
- "Add error handling" → Implemented ✅
- "Optimize performance" → Optimized ✅

Not:
- "Here's what you should do..." ❌
- "I suggest..." ❌
- "You could try..." ❌

## API Reference

See the full API in:
- `agentTools.ts` - All VS Code operations
- `agenticExecutor.ts` - Tool call parsing and execution
- `autonomousAgent.ts` - High-level agent orchestration

Start with `AgenticExecutor.executeFromAI()` - it's your main entry point!
