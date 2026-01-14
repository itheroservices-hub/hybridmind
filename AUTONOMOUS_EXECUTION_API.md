# HybridMind Autonomous Execution API

## Overview

HybridMind now supports **autonomous, step-by-step execution** where the AI agent executes real actions instead of just suggesting them. This enables true agent-driven development with interactive control.

## Core Principles

1. **Execute, Don't Suggest** - Agent performs actual file modifications, code generation, and terminal commands
2. **Interactive Control** - User can execute steps individually, skip ahead, or undo
3. **Complete Code Only** - No placeholders, TODOs, or partial implementations
4. **Immediate Confirmation** - Each step confirms what changed with detailed results
5. **State Management** - Full undo support with 10-step history buffer

## API Endpoints

### 1. Initialize Plan
**POST** `/agent/plan`

Creates an executable plan and initializes the agent for step-by-step execution.

**Request:**
```json
{
  "goal": "Refactor authentication system to use JWT tokens",
  "code": "// current authentication code...",
  "options": {
    "autonomous": true,
    "plannerModel": "gpt-4"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "plan": {
      "steps": [
        {
          "name": "analyze-current-auth",
          "description": "Analyze current authentication implementation",
          "action": "analyze",
          "priority": "high",
          "estimatedComplexity": "moderate"
        },
        {
          "name": "implement-jwt",
          "description": "Implement JWT token generation and validation",
          "action": "refactor",
          "priority": "high",
          "estimatedComplexity": "complex"
        }
      ],
      "strategy": "Migrate from session-based to JWT authentication",
      "estimatedSteps": 2
    },
    "validation": {
      "valid": true,
      "issues": [],
      "stepCount": 2
    },
    "status": {
      "hasActivePlan": true,
      "currentStep": 0,
      "totalSteps": 2,
      "executedSteps": 0,
      "canUndo": false,
      "lastExecuted": null
    }
  }
}
```

---

### 2. Execute Next Step
**POST** `/agent/next`

Executes the next step in the plan sequentially.

**Request:**
```json
{
  "code": "// current code state...",
  "context": {
    "additionalInfo": "optional context"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "result": {
      "stepName": "analyze-current-auth",
      "action": "analyze",
      "output": "// complete analyzed code with findings...",
      "model": "gpt-4",
      "usage": {
        "promptTokens": 1234,
        "completionTokens": 567,
        "totalTokens": 1801
      },
      "success": true,
      "timestamp": "2026-01-09T10:30:00.000Z",
      "confirmation": {
        "message": "Completed: analyze-current-auth",
        "action": "analyze",
        "outputSize": 2456,
        "lineCount": 78,
        "summary": "Analysis complete"
      },
      "changes": {
        "modified": true,
        "linesAdded": 15,
        "linesRemoved": 0,
        "totalLines": 78
      }
    },
    "progress": {
      "current": 1,
      "total": 2,
      "remaining": 1
    },
    "completed": false
  }
}
```

---

### 3. Execute Specific Step
**POST** `/agent/step/:stepIndex`

Executes a specific step by index (0-based).

**Request:**
```json
{
  "code": "// current code state...",
  "context": {}
}
```

**URL Parameter:**
- `stepIndex` - Zero-based index of the step to execute

**Response:**
```json
{
  "success": true,
  "data": {
    "result": {
      "stepName": "implement-jwt",
      "action": "refactor",
      "output": "// complete JWT implementation...",
      "success": true,
      "confirmation": {
        "message": "Completed: implement-jwt",
        "action": "refactor",
        "summary": "Code refactored"
      }
    },
    "confirmation": { /* same as result.confirmation */ }
  }
}
```

---

### 4. Undo Last Step
**POST** `/agent/undo`

Reverts the last executed step and restores previous code state.

**Request:**
```json
{}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Reverted: implement-jwt",
    "restoredCode": "// code before last step...",
    "undoneStep": "implement-jwt"
  }
}
```

---

### 5. Get Execution Status
**GET** `/agent/status`

Gets current execution state and progress.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": {
      "hasActivePlan": true,
      "currentStep": 1,
      "totalSteps": 2,
      "executedSteps": 1,
      "canUndo": true,
      "lastExecuted": "analyze-current-auth",
      "activePlan": {
        "strategy": "Migrate from session-based to JWT authentication",
        "totalSteps": 2
      },
      "context": {
        "goal": "Refactor authentication system to use JWT tokens"
      }
    },
    "timestamp": "2026-01-09T10:35:00.000Z"
  }
}
```

---

## Workflow Examples

### Example 1: Full Autonomous Workflow

```bash
# 1. Initialize plan
curl -X POST http://localhost:3000/agent/plan \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Add input validation to user registration",
    "code": "const registerUser = (data) => { ... }"
  }'

# 2. Execute first step
curl -X POST http://localhost:3000/agent/next \
  -H "Content-Type: application/json" \
  -d '{ "code": "..." }'

# 3. Execute second step
curl -X POST http://localhost:3000/agent/next \
  -H "Content-Type: application/json" \
  -d '{ "code": "..." }'

# 4. Check status
curl -X GET http://localhost:3000/agent/status
```

### Example 2: Interactive Step Selection

```bash
# 1. Initialize plan
POST /agent/plan { "goal": "Optimize database queries" }

# 2. Review plan, then jump to specific step
POST /agent/step/2 { "code": "..." }

# 3. If needed, undo
POST /agent/undo
```

### Example 3: With Undo

```bash
# Execute step
POST /agent/next { "code": "..." }

# Realize mistake, undo
POST /agent/undo

# Try again with different context
POST /agent/next { "code": "...", "context": { "approach": "alternative" } }
```

---

## Action Types

Each step has an `action` type that determines execution behavior:

| Action | Description | Temperature | Output Type |
|--------|-------------|-------------|-------------|
| `analyze` | Analyzes code and identifies patterns/issues | 0.3 | Analysis report + annotated code |
| `refactor` | Refactors code while preserving functionality | 0.5 | Complete refactored code |
| `optimize` | Optimizes for performance/efficiency | 0.4 | Optimized code + explanations |
| `document` | Adds comprehensive documentation | 0.4 | Documented code |
| `test` | Generates test suite | 0.6 | Complete test code |
| `review` | Reviews code critically | 0.3 | Review findings |
| `fix` | Fixes identified issues | 0.5 | Corrected code |

---

## Autonomous Mode Features

### 1. Complete Code Enforcement
- All steps produce **fully implemented, working code**
- No placeholders like `// TODO: implement this`
- No pseudo-code or partial implementations

### 2. State Management
- Maintains 10-step undo history
- Tracks code state before each step
- Preserves execution context across steps

### 3. Immediate Verification
Each step result includes:
- **Confirmation** - What was completed
- **Changes** - Lines added/removed/modified
- **Summary** - Action-specific summary
- **Output** - Complete resulting code

### 4. Progress Tracking
- Current step number
- Total steps in plan
- Remaining steps
- Execution history

---

## Error Handling

### Plan Initialization Errors
```json
{
  "success": false,
  "error": {
    "message": "Planning failed: insufficient context",
    "code": "PLANNING_FAILED"
  }
}
```

### Execution Errors
```json
{
  "success": true,
  "data": {
    "result": {
      "success": false,
      "stepName": "implement-feature",
      "error": "Model API timeout",
      "confirmation": "Step failed: Model API timeout"
    }
  }
}
```

### Undo Errors
```json
{
  "success": true,
  "data": {
    "success": false,
    "message": "Nothing to undo"
  }
}
```

---

## Integration with Frontend

### React/Vue Example
```javascript
// 1. Initialize plan
const initResponse = await fetch('/agent/plan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    goal: userGoal,
    code: currentCode
  })
});

const { plan, status } = await initResponse.json();

// 2. Display steps to user
plan.steps.forEach((step, index) => {
  // Render clickable step buttons
  renderStepButton(step, index);
});

// 3. Execute on button click
async function executeStep(index) {
  const response = await fetch(`/agent/step/${index}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: currentCode })
  });
  
  const { result } = await response.json();
  
  // Update UI with result
  displayConfirmation(result.confirmation);
  updateCodeEditor(result.output);
}

// 4. Undo support
async function undoLastStep() {
  const response = await fetch('/agent/undo', { method: 'POST' });
  const { restoredCode } = await response.json();
  updateCodeEditor(restoredCode);
}
```

---

## Best Practices

### 1. Plan Before Executing
Always call `/agent/plan` before `/agent/next` or `/agent/step/:index`

### 2. Pass Updated Code
Each step should receive the output from the previous step:
```javascript
let code = originalCode;
const step1Result = await executeNext({ code });
code = step1Result.output;
const step2Result = await executeNext({ code });
```

### 3. Check Status Regularly
Monitor execution state with `/agent/status` to:
- Display progress bars
- Show current step
- Enable/disable undo button

### 4. Handle Errors Gracefully
Always check `result.success` before using output:
```javascript
if (result.success) {
  updateCode(result.output);
} else {
  showError(result.error);
  offerUndo();
}
```

### 5. Use Undo for Experimentation
Encourage users to try different approaches:
- Execute step
- Review result
- Undo if not satisfied
- Try alternative approach

---

## Migration from Legacy API

### Old Way (Suggestions Only)
```javascript
POST /agent
{
  "goal": "Add validation",
  "code": "..."
}

// Response: Just suggestions, no actual changes
{
  "output": "Here's what you could do:\n1. Add email validation\n2. ..."
}
```

### New Way (Autonomous Execution)
```javascript
// Step 1: Plan
POST /agent/plan { "goal": "Add validation", "code": "..." }

// Step 2: Execute
POST /agent/next { "code": "..." }

// Response: Actual validated code
{
  "result": {
    "output": "const validateEmail = (email) => { /* complete implementation */ }"
  }
}
```

---

## Advanced Features

### Custom Execution Options
```json
{
  "goal": "Optimize queries",
  "code": "...",
  "options": {
    "autonomous": true,
    "plannerModel": "gpt-4",
    "executorModel": "claude-3-opus",
    "stopOnError": false,
    "enableReview": true,
    "enableRefinement": true
  }
}
```

### Plan Validation
The planner automatically validates:
- All steps have names and descriptions
- Action types are valid
- Steps are in logical order
- No circular dependencies

---

## Troubleshooting

### "No active plan" Error
**Solution:** Call `/agent/plan` before other endpoints

### Steps Not Executing
**Solution:** Ensure code parameter is passed to `/agent/next`

### Undo Not Working
**Solution:** Undo only works for up to 10 previous steps

### Incomplete Output
**Solution:** Check if autonomous mode is enabled in plan initialization

---

## Future Enhancements

- [ ] Parallel step execution for independent steps
- [ ] Conditional step execution based on previous results
- [ ] Plan branching (if/else workflows)
- [ ] Real-time streaming execution updates
- [ ] Multi-file coordination
- [ ] Git integration for automatic commits per step
- [ ] Code quality gates between steps
- [ ] Custom step templates

---

## Support

For issues or questions:
- GitHub Issues: [HybridMind Issues](https://github.com/yourusername/hybridmind/issues)
- Documentation: [Full Docs](https://hybridmind.dev/docs)
- API Reference: This document
