# 🚀 Quick Start - Strict JSON Agentic Workflows

This guide shows you how to test the new strict JSON agentic workflow integration.

## ✅ Prerequisites

1. **Backend running** on port 3001
2. **Extension compiled** (already done!)
3. **API keys configured** in `.env`

## 🎯 Quick Test (5 minutes)

### Step 1: Start the Backend

```powershell
cd hybridmind-backend
npm start
```

You should see:
```
✓ Server running on port 3001
✓ AI models loaded
```

### Step 2: Test Backend Endpoint

```powershell
# Quick test with curl
curl -X POST http://localhost:3001/agent/execute ^
  -H "Content-Type: application/json" ^
  -d "{\"prompt\":\"Add a TODO comment at line 5 of app.ts\",\"model\":\"gpt-4-turbo-preview\",\"provider\":\"openai\"}"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "toolCall": {
      "tool": "insert_text",
      "file": "app.ts",
      "position": { "line": 5, "character": 0 },
      "text": "// TODO: Implement\n"
    }
  }
}
```

### Step 3: Launch Extension in Debug Mode

1. Open `hybridmind-extension` folder in VS Code
2. Press **F5** (or Run → Start Debugging)
3. This opens "Extension Development Host" window

### Step 4: Test New Commands

In the Extension Development Host window:

**Option A: Run Full Workflow**
1. Open any code file
2. Press `Ctrl+Shift+P`
3. Type: "HybridMind: ⚡ Run AI Workflow (Strict JSON)"
4. Enter: "Add error handling to this function"
5. Select a model (e.g., "GPT-4 Turbo")
6. Watch it execute!

**Option B: Quick Fix**
1. Select some code
2. Press `Ctrl+Shift+P`
3. Type: "HybridMind: ⚡ Quick Fix (Strict JSON)"
4. It analyzes and fixes the code

**Option C: Add Feature**
1. Open a file
2. Press `Ctrl+Shift+P`
3. Type: "HybridMind: ⚡ Add Feature (Strict JSON)"
4. Enter: "Add logging"

## 📋 What Happens Behind the Scenes

1. **Extension** → Calls `agentClient.executeWorkflow()`
2. **Backend** → Receives request at `/agent/execute`
3. **AI Model** → Generates strict JSON tool call
4. **Validation** → Backend validates the JSON schema
5. **Response** → Returns validated tool call to extension
6. **Execution** → `toolExecutor.execute()` applies the changes
7. **Result** → Code is modified in VS Code!

## 🔍 Debugging

### View Agent Output
Press `Ctrl+Shift+P` → "HybridMind: Show Agent Output"

Shows:
- Tool calls being executed
- Files being modified
- Errors and warnings

### Backend Logs
Check the terminal where backend is running for:
- Incoming requests
- Validation results
- AI model responses

### Extension Logs
In Extension Development Host:
- View → Output → Select "HybridMind Agent"

## 🧪 Test Examples

### Example 1: Fix a Bug

```typescript
// Create this file: test.ts
function calculateTotal(items) {
  let total;
  for (let item of items) {
    total += item.price;
  }
  return total;
}
```

Run: "⚡ Quick Fix (Strict JSON)" on the function

Expected result: AI initializes `total = 0`

### Example 2: Add Feature

```typescript
// Create: api.ts
async function fetchUser(id) {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}
```

Run: "⚡ Add Feature (Strict JSON)"
Enter: "Add error handling and retry logic"

### Example 3: Create New File

Run: "⚡ Run AI Workflow (Strict JSON)"
Enter: "Create a new file utils.ts with a function to format dates"

## ✨ Available Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| Run AI Workflow | None | Full agentic workflow with model selection |
| Quick Fix | None | Fix selected code issues |
| Add Feature | None | Add functionality to current file |
| Show Agent Output | None | View execution log |

## 🛠️ Configuration

### Default Model

Edit `src/commands/agenticCommands.ts`:

```typescript
// Change default model
model: 'deepseek-chat',  // Instead of 'gpt-4-turbo-preview'
provider: 'deepseek'      // Instead of 'openai'
```

### Available Models

- `gpt-4-turbo-preview` (OpenAI) - Most capable
- `gpt-4o` (OpenAI) - Fast and smart
- `llama-3.3-70b-versatile` (Groq) - Free, fast
- `deepseek-chat` (DeepSeek) - Great for code, cheap
- `claude-sonnet-4-20250514` (Anthropic) - Best reasoning
- `gemini-2.0-flash-exp` (Google) - Fast, free

## 🐛 Troubleshooting

### "Cannot connect to backend"
- Check backend is running: `npm start` in hybridmind-backend
- Verify port 3001 is not blocked

### "Workflow failed: Invalid JSON"
- Check backend logs for validation errors
- Try a different model (some are better at JSON)
- Increase retries in `agenticService.js`

### "File not found"
- Extension uses workspace-relative paths
- Make sure a workspace folder is open
- Check file path in agent output

### TypeScript Errors
- Run `npm run compile` in hybridmind-extension
- Check for missing imports
- Verify `axios` is installed

## 🎓 Next Steps

1. **Try different models** - See which works best for your use case
2. **Customize prompts** - Edit the prompt templates in commands
3. **Add new tools** - Extend `toolExecutor.ts` with custom actions
4. **Create workflows** - Chain multiple tool calls together
5. **Add UI** - Create a webview for workflow configuration

## 📚 Related Documentation

- [Backend Implementation](hybridmind-backend/STRICT_JSON_IMPLEMENTATION.md)
- [Extension Development](EXTENSION_DEV_ENVIRONMENT.md)
- [Agent Client API](hybridmind-extension/src/agents/agentClient.ts)
- [Tool Executor](hybridmind-extension/src/agents/toolExecutor.ts)

## 💡 Tips

- **Start simple**: Test with small code snippets first
- **Use cheap models**: DeepSeek and Llama are great for testing
- **Check output**: Always review changes before saving
- **Iterate**: Run multiple times to refine results
- **Save often**: Extension auto-saves, but be safe!

## 🎉 Success Criteria

You've successfully integrated strict JSON workflows when:

✅ Backend responds with valid JSON tool calls  
✅ Extension executes tool calls without errors  
✅ Code modifications appear in VS Code  
✅ Agent output shows execution steps  
✅ No parsing or validation errors  

Happy coding! 🚀
