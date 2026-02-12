# Autonomous Agent — Quick Reference

## 🚀 Quick Start (3 Steps)

```bash
# 1. Plan
curl -X POST localhost:3000/agent/plan -d '{"goal":"YOUR_GOAL","code":"YOUR_CODE"}'

# 2. Execute
curl -X POST localhost:3000/agent/next -d '{"code":"CURRENT_CODE"}'

# 3. Check Progress
curl -X GET localhost:3000/agent/status
```

---

## 📡 API Endpoints

| Method | Endpoint | Purpose | Body |
|--------|----------|---------|------|
| `POST` | `/agent/plan` | Initialize plan | `{goal, code, options}` |
| `POST` | `/agent/next` | Execute next step | `{code, context}` |
| `POST` | `/agent/step/:index` | Execute specific step | `{code, context}` |
| `POST` | `/agent/undo` | Revert last step | `{}` |
| `GET` | `/agent/status` | Get execution state | - |

---

## 🎮 Commands

### Initialize
```javascript
POST /agent/plan
{
  "goal": "Add JWT authentication",
  "code": "// current auth code",
  "options": { "autonomous": true }
}
```

### Next Step
```javascript
POST /agent/next
{
  "code": "// current code state"
}
```

### Jump to Step
```javascript
POST /agent/step/2
{
  "code": "// current code"
}
```

### Undo
```javascript
POST /agent/undo
```

### Status
```javascript
GET /agent/status
```

---

## 📊 Response Format

### Step Result
```javascript
{
  "success": true,
  "data": {
    "result": {
      "stepName": "implement-jwt",
      "action": "refactor",
      "output": "// COMPLETE working code",
      "success": true,
      "confirmation": {
        "message": "Completed: implement-jwt",
        "summary": "Code refactored"
      },
      "changes": {
        "linesAdded": 23,
        "linesRemoved": 5,
        "totalLines": 156
      }
    },
    "progress": {
      "current": 2,
      "total": 5,
      "remaining": 3
    }
  }
}
```

---

## 🎯 Action Types

| Type | Temp | Output |
|------|------|--------|
| `analyze` | 0.3 | Analysis + annotated code |
| `refactor` | 0.5 | Complete refactored code |
| `optimize` | 0.4 | Optimized code + explanations |
| `document` | 0.4 | Fully documented code |
| `test` | 0.6 | Complete test suite |
| `review` | 0.3 | Review findings |
| `fix` | 0.5 | Corrected code |

---

## 🔄 Workflow Patterns

### Sequential Execution
```javascript
// 1. Plan
const { plan } = await initPlan(goal, code);

// 2. Execute all steps
let currentCode = code;
for (let i = 0; i < plan.steps.length; i++) {
  const { result } = await executeNext(currentCode);
  currentCode = result.output;
}
```

### Interactive Selection
```javascript
// 1. Plan
const { plan } = await initPlan(goal, code);

// 2. Show steps to user
displaySteps(plan.steps);

// 3. Execute on click
async function onStepClick(index) {
  const { result } = await executeStep(index, currentCode);
  updateEditor(result.output);
}
```

### With Undo
```javascript
// Execute
const { result } = await executeNext(code);

// Undo if needed
if (!userSatisfied) {
  const { restoredCode } = await undo();
  // Try again with different approach
}
```

---

## ⚡ Code Examples

### JavaScript/Node
```javascript
const axios = require('axios');
const BASE_URL = 'http://localhost:3000';

// Initialize
const planRes = await axios.post(`${BASE_URL}/agent/plan`, {
  goal: 'Add error handling',
  code: myCode
});

// Execute next
const nextRes = await axios.post(`${BASE_URL}/agent/next`, {
  code: currentCode
});

// Undo
const undoRes = await axios.post(`${BASE_URL}/agent/undo`);

// Status
const statusRes = await axios.get(`${BASE_URL}/agent/status`);
```

### Python
```python
import requests

BASE_URL = 'http://localhost:3000'

# Initialize
plan_res = requests.post(f'{BASE_URL}/agent/plan', json={
    'goal': 'Add error handling',
    'code': my_code
})

# Execute next
next_res = requests.post(f'{BASE_URL}/agent/next', json={
    'code': current_code
})

# Undo
undo_res = requests.post(f'{BASE_URL}/agent/undo')

# Status
status_res = requests.get(f'{BASE_URL}/agent/status')
```

### React
```jsx
function AgentExecutor({ goal, code }) {
  const [plan, setPlan] = useState(null);
  const [currentCode, setCurrentCode] = useState(code);
  const [progress, setProgress] = useState({});
  
  const initPlan = async () => {
    const res = await fetch('/agent/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal, code })
    });
    const data = await res.json();
    setPlan(data.plan);
  };
  
  const executeNext = async () => {
    const res = await fetch('/agent/next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: currentCode })
    });
    const data = await res.json();
    setCurrentCode(data.result.output);
    setProgress(data.progress);
  };
  
  const undo = async () => {
    const res = await fetch('/agent/undo', { method: 'POST' });
    const data = await res.json();
    setCurrentCode(data.restoredCode);
  };
  
  return (
    <div>
      <button onClick={initPlan}>Initialize Plan</button>
      <button onClick={executeNext}>Next Step</button>
      <button onClick={undo}>Undo</button>
      <pre>{currentCode}</pre>
    </div>
  );
}
```

---

## 🚨 Common Errors

### "No active plan"
**Fix**: Call `/agent/plan` first
```bash
POST /agent/plan { "goal": "...", "code": "..." }
```

### "Nothing to undo"
**Fix**: Execute at least one step before undo
```bash
POST /agent/next { "code": "..." }
POST /agent/undo
```

### "Invalid step index"
**Fix**: Use 0-based index < plan.steps.length
```bash
# For 5 steps, valid indices: 0-4
POST /agent/step/2  # ✅ Valid
POST /agent/step/5  # ❌ Invalid
```

---

## 🎨 UI Integration

### Progress Bar
```javascript
const { current, total } = progress;
const percent = (current / total) * 100;
```

### Step List
```jsx
{plan.steps.map((step, i) => (
  <div key={i} onClick={() => executeStep(i)}>
    {step.name} - {step.action}
  </div>
))}
```

### Confirmation Toast
```javascript
if (result.success) {
  toast.success(
    `${result.confirmation.message}\n` +
    `+${result.changes.linesAdded} -${result.changes.linesRemoved}`
  );
}
```

---

## 📝 Testing Commands

### Test Plan
```bash
curl -X POST localhost:3000/agent/plan \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Add validation",
    "code": "function register(user) { return user; }"
  }'
```

### Test Next
```bash
curl -X POST localhost:3000/agent/next \
  -H "Content-Type: application/json" \
  -d '{"code": "function register(user) { return user; }"}'
```

### Test Undo
```bash
curl -X POST localhost:3000/agent/undo
```

### Test Status
```bash
curl -X GET localhost:3000/agent/status
```

---

## 🎯 Best Practices

1. **Always initialize plan first**
   ```javascript
   await initPlan(goal, code);  // Required
   await executeNext(code);      // Then execute
   ```

2. **Pass updated code to next step**
   ```javascript
   let code = originalCode;
   const step1 = await executeNext(code);
   code = step1.output;  // ✅ Use output
   const step2 = await executeNext(code);
   ```

3. **Check success before using output**
   ```javascript
   if (result.success) {
     updateCode(result.output);
   } else {
     handleError(result.error);
   }
   ```

4. **Monitor progress**
   ```javascript
   const status = await getStatus();
   console.log(`${status.currentStep}/${status.totalSteps}`);
   ```

5. **Use undo for experimentation**
   ```javascript
   await executeNext(code);
   // Not satisfied?
   await undo();
   // Try different approach
   await executeNext(code, { context: { approach: 'alternative' } });
   ```

---

## 💡 Pro Tips

- **Parallel steps**: Future feature, currently sequential
- **Undo limit**: 10 steps max
- **State persistence**: In-memory only (restart clears)
- **Code validation**: Automatic placeholder detection
- **Model selection**: Configurable per phase

---

## 📚 More Info

- Full API: `AUTONOMOUS_EXECUTION_API.md`
- Implementation: `AUTONOMOUS_AGENT_IMPLEMENTATION.md`
- Architecture: `V1.1_ARCHITECTURE.md`

---

**Need help?** Check logs at `hybridmind-backend/logs/`
