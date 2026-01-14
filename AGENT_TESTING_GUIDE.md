# Testing the Autonomous Agent in VS Code Extension

## ✅ Prerequisites
- [x] Backend server is running (http://localhost:3000)
- [x] Extension is compiled (`npm run compile`)
- [x] OpenRouter API key is configured in `.env`
- [x] Default tier set to 'pro' for development

## 🚀 How to Test in Extension Development

### Step 1: Launch Extension Development Host

1. Open the `hybridmind-extension` folder in VS Code
2. Press **F5** or go to Run → Start Debugging
3. This will open a new VS Code window with the extension loaded

### Step 2: Test Autonomous Agent Features

#### Option A: Using the Chat Sidebar

1. In the Extension Development Host window, click the **HybridMind icon** in the Activity Bar (left side)
2. This opens the Chat sidebar
3. Type a request like:
   ```
   Add input validation to this function:
   function registerUser(username, email) { 
     return saveUser({username, email}); 
   }
   ```
4. The agent will create a plan and execute steps autonomously

#### Option B: Using Commands (Right-click on code)

1. Create a test file (e.g., `test.js`) with some code:
   ```javascript
   function calculateTotal(items) {
     let total = 0;
     for (let i = 0; i < items.length; i++) {
       total += items[i].price;
     }
     return total;
   }
   ```

2. Select the code, right-click, and choose:
   - **HybridMind: Fix Bugs** - Automatically fixes errors
   - **HybridMind: Optimize Code** - Refactors for better performance
   - **HybridMind: Generate Tests** - Creates test cases
   - **HybridMind: Review Code** - Analyzes and suggests improvements

#### Option C: Direct API Testing (From Extension)

Open the integrated terminal in the Extension Development Host and test the backend API:

```powershell
# Test plan initialization
curl http://localhost:3000/agent/plan -X POST -H "Content-Type: application/json" -d '{\"goal\":\"Add error handling\",\"code\":\"function test() { return data; }\",\"options\":{}}'

# Check status
curl http://localhost:3000/agent/status

# Execute next step
curl http://localhost:3000/agent/next -X POST -H "Content-Type: application/json" -d '{\"code\":\"function test() { return data; }\"}'
```

### Step 3: Monitor Agent Execution

Watch the Debug Console in VS Code for logs:
- Plan initialization
- Step execution
- Model selections
- Results and confirmations

### Step 4: Test Advanced Features

#### Multi-Step Autonomous Workflow

Create a more complex test file:

```javascript
// test-validation.js
function processOrder(order) {
  const total = order.items.reduce((sum, item) => sum + item.price, 0);
  if (order.customer) {
    chargeCustomer(order.customer, total);
  }
  return total;
}
```

Request: "Add comprehensive input validation, error handling, and type checking to this function"

The agent will:
1. **Analyze** - Identify what needs validation
2. **Plan** - Create multi-step execution plan
3. **Execute** - Implement validations step by step
4. **Verify** - Check the final code

## 🧪 Test Scenarios

### Scenario 1: Bug Fixing
```javascript
// File with intentional bugs
function divide(a, b) {
  return a / b;  // No division by zero check
}

const result = divide(10, 0);
console.log(result.toFixed(2));  // Will crash if b=0
```

**Test**: Right-click → HybridMind: Fix Bugs

**Expected**: Agent adds validation and error handling

### Scenario 2: Code Optimization
```javascript
// Inefficient code
function findUser(users, id) {
  for (let i = 0; i < users.length; i++) {
    if (users[i].id === id) {
      return users[i];
    }
  }
  return null;
}
```

**Test**: Select code → HybridMind: Optimize Code

**Expected**: Agent suggests `.find()` or other optimizations

### Scenario 3: Test Generation
```javascript
function calculateDiscount(price, percentage) {
  return price * (1 - percentage / 100);
}
```

**Test**: Right-click → HybridMind: Generate Tests

**Expected**: Agent creates test cases with edge cases

## 📊 Monitoring Agent Activity

### Backend Logs
The backend server window will show:
```
[INFO] Initializing autonomous plan: Add input validation
[INFO] Phase 1: Planning
[INFO] Plan created: 3 steps, strategy: validate-implement-verify
[INFO] ▶️  Executing next step [1/3]: analyze-requirements
[INFO] [OpenRouter] Calling meta-llama/llama-3.3-70b-instruct
[INFO] ✅ COMPLETED: analyze-requirements
```

### Extension Logs
The Debug Console will show:
```
HybridMind extension activating...
Server started on port 3000
Calling agent API: /agent/plan
Agent plan initialized: 3 steps
Executing step 1/3...
Step completed successfully
```

## 🔧 Troubleshooting

### Issue: "Feature not available"
**Solution**: Tier validator defaulting to 'free'. Already fixed - tier defaults to 'pro' in development.

### Issue: "Server not running"
**Solution**: 
```powershell
cd e:\IThero\HybridMind
node server.js
```

### Issue: "No models available"
**Solution**: Check `.env` file has `OPENROUTER_API_KEY` set.

### Issue: Extension not loading
**Solution**: 
1. Stop debugging (Shift+F5)
2. Recompile: `npm run compile`
3. Press F5 again

## 🎯 Success Criteria

✅ Extension loads without errors  
✅ HybridMind icon appears in Activity Bar  
✅ Chat sidebar opens and responds  
✅ Commands appear in Command Palette  
✅ Right-click menu shows HybridMind options  
✅ Agent creates plans successfully  
✅ Steps execute and show progress  
✅ Code changes are applied correctly  
✅ Undo functionality works  

## 📝 Notes

- The autonomous agent uses **OpenRouter models exclusively**
- Default planner: `meta-llama/llama-3.3-70b-instruct`
- Default executor: Varies by task (Claude, Gemini, DeepSeek)
- All features are in **Pro tier** by default during development
- Changes are applied directly to files (can be undone with Ctrl+Z)

## 🚀 Next Steps

Once testing is successful:
1. Package the extension: `npm run package`
2. Install the `.vsix` file in VS Code
3. Test in real-world scenarios
4. Gather feedback for improvements
