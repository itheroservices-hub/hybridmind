# 🧪 HybridMind MEGA TEST Suite
## Complete System Verification for v2.0.0

**Purpose:** Comprehensive end-to-end testing of the entire HybridMind system  
**Scope:** All components, all features, all integrations  
**Target:** v2.0.0 - Autonomous Agent System  
**Duration:** 2-4 hours for complete test suite

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Environment Setup](#environment-setup)
3. [Core System Tests](#core-system-tests)
4. [Feature Tests](#feature-tests)
5. [Integration Tests](#integration-tests)
6. [Performance & Load Tests](#performance--load-tests)
7. [Security Tests](#security-tests)
8. [Error Handling Tests](#error-handling-tests)
9. [End-to-End Workflows](#end-to-end-workflows)
10. [Results & Reporting](#results--reporting)

---

## 🚀 Quick Start

### Run All Tests (Automated)

```bash
# From project root
npm run test-all

# Or individual test suites:
cd hybridmind-python-service
python test-task-decomposition.py
python test-advanced-features.py
python test-mcp-tools-integration.py

cd ..
node test-hybrid-architecture.js
node test-all-components.js
```

### Expected Duration
- **Automated tests:** 10-15 minutes
- **Manual tests:** 1-2 hours
- **Performance tests:** 30 minutes
- **E2E workflows:** 30-60 minutes

---

## 🔧 Environment Setup

### Prerequisites Checklist

```bash
# 1. Check Node.js
node --version  # Should be v18+

# 2. Check Python
python --version  # Should be 3.11+

# 3. Check npm packages
npm list

# 4. Check Python packages
pip list

# 5. Verify environment variables
# Create .env file with:
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
```

### Start All Services

**Terminal 1: Python Service**
```bash
cd hybridmind-python-service
python main.py
# Should see: "Uvicorn running on http://127.0.0.1:8000"
```

**Terminal 2: Node.js Backend**
```bash
npm start
# Should see: "Server running on port 3000"
```

**Terminal 3: VS Code Extension**
```bash
# Press F5 in VS Code
# Opens Extension Development Host
```

### Health Checks

```bash
# Python service
curl http://localhost:8000/health
# Expected: {"status": "healthy", "version": "2.0.0"}

# Node.js backend
curl http://localhost:3000/health
# Expected: {"status": "ok", "uptime": ...}

# VS Code extension
# Open Command Palette → Type "HybridMind"
# Should see multiple commands
```

---

## 🧪 Core System Tests

### Test 1: Basic Agent Response

**Objective:** Verify core agent functionality

```bash
curl -X POST http://localhost:8000/agent/chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is 2 + 2?",
    "agent_name": "assistant"
  }'
```

**Expected Response:**
```json
{
  "response": "4 (or detailed explanation)",
  "agent": "assistant",
  "timestamp": "..."
}
```

**Pass Criteria:**
- ✅ Returns valid JSON
- ✅ Response is relevant
- ✅ No error messages
- ✅ Response time < 5s

---

### Test 2: Multi-Model Support

**Objective:** Verify multiple AI models work

```bash
# Test GPT-4
curl -X POST http://localhost:8000/agent/chat \
  -d '{"query": "Hello", "model": "gpt-4"}'

# Test Claude
curl -X POST http://localhost:8000/agent/chat \
  -d '{"query": "Hello", "model": "claude-3-sonnet"}'

# Test Groq
curl -X POST http://localhost:8000/agent/chat \
  -d '{"query": "Hello", "model": "mixtral-8x7b"}'
```

**Pass Criteria:**
- ✅ All models respond successfully
- ✅ Different response styles (if expected)
- ✅ No API errors

---

### Test 3: MCP Tools Access

**Objective:** Verify M365 Agents Toolkit integration

```bash
curl -X POST http://localhost:8000/agent/chat \
  -d '{
    "query": "Use get_knowledge tool to find info about app manifests",
    "use_mcp_tools": true
  }'
```

**Pass Criteria:**
- ✅ Tool called successfully
- ✅ Returns knowledge from M365 docs
- ✅ Tool tracked in analytics

---

### Test 4: Agent Persistence

**Objective:** Verify agent memory and context

```bash
# First message
curl -X POST http://localhost:8000/agent/chat \
  -d '{"query": "My name is Alice", "conversation_id": "test-123"}'

# Follow-up (should remember)
curl -X POST http://localhost:8000/agent/chat \
  -d '{"query": "What is my name?", "conversation_id": "test-123"}'
```

**Pass Criteria:**
- ✅ Second response includes "Alice"
- ✅ Context maintained across requests
- ✅ Conversation ID working

---

## 🎯 Feature Tests

### Feature 1: Task Decomposition System

#### Test 1.1: Basic Decomposition

```bash
curl -X POST http://localhost:8000/task/decompose \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Create a to-do list web app with React and Node.js"
  }'
```

**Expected Result:**
```json
{
  "task_id": "task_...",
  "original_task": "Create a to-do list web app...",
  "subtasks": [
    {
      "id": 0,
      "description": "Set up project structure...",
      "status": "pending",
      "complexity": 2,
      "assigned_agent": "code_generator",
      "dependencies": []
    },
    ...5-7 more subtasks
  ],
  "total_subtasks": 6,
  "estimated_time": "2-3 hours"
}
```

**Verify:**
- ✅ Returns unique task_id
- ✅ Creates 4-8 logical subtasks
- ✅ Subtasks have descriptions
- ✅ Dependencies logical (e.g., setup before coding)
- ✅ Complexity ratings (1-5)
- ✅ Agents assigned appropriately
- ✅ Estimation provided

---

#### Test 1.2: Complex Task Decomposition

```bash
curl -X POST http://localhost:8000/task/decompose \
  -d '{
    "task": "Build a full-stack e-commerce platform with user auth, product catalog, shopping cart, payment processing, order management, and admin dashboard. Use React, Node.js, PostgreSQL, Redis, Stripe, and Docker."
  }'
```

**Expected Result:**
- ✅ Handles complex requirements
- ✅ Creates 15-25 subtasks
- ✅ Organized into logical phases
- ✅ Dependencies properly structured
- ✅ Multiple agent types used

---

#### Test 1.3: Progress Tracking

```bash
# Create task
TASK_ID=$(curl -X POST http://localhost:8000/task/decompose \
  -d '{"task": "Simple test task"}' | jq -r '.task_id')

# Check initial progress
curl http://localhost:8000/task/$TASK_ID/progress

# Start first subtask
curl -X POST http://localhost:8000/task/$TASK_ID/subtask/0/start

# Complete first subtask
curl -X POST http://localhost:8000/task/$TASK_ID/subtask/0/complete \
  -d '{"result": "Subtask completed successfully"}'

# Check updated progress
curl http://localhost:8000/task/$TASK_ID/progress
```

**Verify:**
- ✅ Initial progress = 0%
- ✅ After completion: progress increases
- ✅ Completed count accurate
- ✅ Status transitions: pending → in_progress → completed
- ✅ Timestamps recorded

---

#### Test 1.4: Dependency Management

```bash
# Create task with dependencies
TASK_ID=$(curl -X POST http://localhost:8000/task/decompose \
  -d '{"task": "Deploy app with tests"}' | jq -r '.task_id')

# Try to start subtask 3 (which depends on 0, 1, 2)
curl -X POST http://localhost:8000/task/$TASK_ID/subtask/3/start
```

**Expected:**
- ✅ Should fail with dependency error
- ✅ Error message lists incomplete dependencies
- ✅ Can start after dependencies complete

---

#### Test 1.5: Automatic Execution (Single)

```bash
TASK_ID=$(curl -X POST http://localhost:8000/task/decompose \
  -d '{"task": "Write function to reverse string"}' | jq -r '.task_id')

# Execute next subtask automatically
curl -X POST http://localhost:8000/task/$TASK_ID/execute-next
```

**Verify:**
- ✅ Selects correct next subtask
- ✅ Executes with appropriate agent
- ✅ Stores result
- ✅ Updates status
- ✅ Returns execution result

---

#### Test 1.6: Automatic Execution (All)

```bash
TASK_ID=$(curl -X POST http://localhost:8000/task/decompose \
  -d '{"task": "Create function to validate email"}' | jq -r '.task_id')

# Execute all subtasks automatically
curl -X POST http://localhost:8000/task/$TASK_ID/execute-all
```

**Verify:**
- ✅ All subtasks executed in order
- ✅ Dependencies respected
- ✅ Progress updates incrementally
- ✅ Final status = completed
- ✅ Results for each subtask
- ✅ Total execution time reasonable

---

#### Test 1.7: Task Listing

```bash
# Create multiple tasks
for i in {1..5}; do
  curl -X POST http://localhost:8000/task/decompose \
    -d "{\"task\": \"Test task $i\"}"
done

# List all tasks
curl http://localhost:8000/tasks
```

**Verify:**
- ✅ All tasks returned
- ✅ Includes task IDs, descriptions
- ✅ Shows current status
- ✅ Progress percentages
- ✅ Sorted by creation time

---

#### Test 1.8: Task Deletion

```bash
TASK_ID=$(curl -X POST http://localhost:8000/task/decompose \
  -d '{"task": "Temporary task"}' | jq -r '.task_id')

# Delete task
curl -X DELETE http://localhost:8000/task/$TASK_ID

# Verify deleted
curl http://localhost:8000/task/$TASK_ID
```

**Verify:**
- ✅ Task deleted successfully
- ✅ Returns 404 on subsequent requests
- ✅ Removed from task list

---

### Feature 2: Code Execution Sandbox

#### Test 2.1: Simple Code Generation & Testing

```bash
curl -X POST http://localhost:8000/agent/execute-with-sandbox \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Create a function to calculate factorial of a number",
    "max_iterations": 3
  }'
```

**Expected Flow:**
1. Coder generates factorial function
2. Executor tests with sample inputs
3. If tests fail, Coder refines
4. Repeats until tests pass or max iterations
5. Returns working code

**Verify:**
- ✅ Code generated
- ✅ Code executed successfully
- ✅ Test results shown
- ✅ Iterations tracked
- ✅ Final code works
- ✅ Returns function definition

---

#### Test 2.2: Code with Bugs (Iteration)

```bash
curl -X POST http://localhost:8000/agent/execute-with-sandbox \
  -d '{
    "task": "Create function to divide two numbers (should handle division by zero)",
    "max_iterations": 3
  }'
```

**Expected:**
- ✅ First attempt may fail test (division by zero)
- ✅ Second iteration adds error handling
- ✅ Tests pass
- ✅ Iteration count > 1

---

#### Test 2.3: Team Review Mode

```bash
curl -X POST http://localhost:8000/agent/execute-with-sandbox \
  -d '{
    "task": "Create function to validate credit card number using Luhn algorithm",
    "max_iterations": 3,
    "use_team_review": true
  }'
```

**Verify:**
- ✅ Multiple agents involved
- ✅ Code reviewed before execution
- ✅ Feedback provided
- ✅ Higher quality output
- ✅ Takes longer but more thorough

---

#### Test 2.4: Complex Algorithm

```bash
curl -X POST http://localhost:8000/agent/execute-with-sandbox \
  -d '{
    "task": "Implement quicksort algorithm",
    "max_iterations": 5
  }'
```

**Verify:**
- ✅ Handles complex logic
- ✅ Tests with various inputs
- ✅ Sorting works correctly
- ✅ Edge cases handled

---

### Feature 3: Multi-Agent Coordination

#### Test 3.1: Sequential Pipeline

```bash
curl -X POST http://localhost:8000/agent/coordinated-pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Research best practices for API security and implement rate limiting",
    "agents": ["researcher", "architect", "coder", "reviewer"]
  }'
```

**Expected Flow:**
1. **Researcher:** Finds API security best practices
2. **Architect:** Designs rate limiting system
3. **Coder:** Implements the design
4. **Reviewer:** Validates implementation

**Verify:**
- ✅ Each agent executes in order
- ✅ Output of agent A becomes input to agent B
- ✅ Final result is cohesive
- ✅ Shows progression of work
- ✅ Each stage visible in response

---

#### Test 3.2: Parallel Exploration

```bash
curl -X POST http://localhost:8000/agent/parallel-explore \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Find the best approach for real-time data synchronization",
    "num_agents": 3
  }'
```

**Expected:**
- Agent 1: WebSockets approach
- Agent 2: Server-Sent Events approach
- Agent 3: Polling approach
- Judge: Evaluates and picks best

**Verify:**
- ✅ 3 different approaches generated
- ✅ Each approach detailed
- ✅ Pros/cons listed
- ✅ Best approach selected
- ✅ Reasoning provided

---

#### Test 3.3: Collaborative Debugging

```bash
curl -X POST http://localhost:8000/agent/collaborative-debug \
  -H "Content-Type: application/json" \
  -d '{
    "code": "async function fetchData() { const response = await fetch(url); return response.json(); }",
    "error": "ReferenceError: url is not defined"
  }'
```

**Expected Flow:**
1. **Analyzer:** Identifies missing `url` parameter
2. **Fixer:** Adds parameter to function signature
3. **Validator:** Tests fixed code

**Verify:**
- ✅ Issue identified correctly
- ✅ Solution proposed
- ✅ Fixed code provided
- ✅ Fix solves the error
- ✅ No new errors introduced

---

### Feature 4: Tool Usage Analytics

#### Test 4.1: Track Tool Usage

```bash
# Generate tool usage
curl -X POST http://localhost:8000/agent/chat \
  -d '{"query": "Read package.json file"}'

curl -X POST http://localhost:8000/agent/chat \
  -d '{"query": "Search web for Python tutorials"}'

curl -X POST http://localhost:8000/agent/chat \
  -d '{"query": "List files in current directory"}'

# Get analytics
curl http://localhost:8000/analytics/comprehensive-report
```

**Verify:**
- ✅ Total tool calls tracked
- ✅ Individual tools listed
- ✅ Usage count per tool
- ✅ Success rates shown
- ✅ Performance metrics included

---

#### Test 4.2: Analytics Report Details

```bash
curl http://localhost:8000/analytics/comprehensive-report
```

**Expected Sections:**
```json
{
  "overview": {
    "total_tool_calls": 150,
    "unique_tools_used": 12,
    "overall_success_rate": "94.7%",
    "total_execution_time": "450.3s"
  },
  "most_used_tools": [
    {"name": "filesystem_read", "calls": 45, "percentage": "30%"},
    ...
  ],
  "success_rates": [...],
  "performance": {
    "fastest_tools": [...],
    "slowest_tools": [...]
  },
  "usage_by_agent": {...},
  "usage_by_task_type": {...},
  "time_based_patterns": {...}
}
```

**Verify:**
- ✅ All sections present
- ✅ Data accurate
- ✅ Percentages calculated correctly
- ✅ Performance metrics reasonable

---

#### Test 4.3: Clear Analytics

```bash
# Clear all analytics
curl -X POST http://localhost:8000/analytics/clear

# Verify cleared
curl http://localhost:8000/analytics/comprehensive-report
```

**Verify:**
- ✅ Confirmation returned
- ✅ All counters reset to 0
- ✅ No tools listed
- ✅ Clean slate

---

### Feature 5: Custom Tools System

#### Test 5.1: Register Multiple Custom Tools

```bash
# Tool 1: Business calculation
curl -X POST http://localhost:8000/tools/register-custom \
  -H "Content-Type: application/json" \
  -d '{
    "name": "calculate_tax",
    "description": "Calculate tax on amount",
    "code": "def calculate_tax(amount: float, rate: float = 0.08) -> float:\n    return amount * rate",
    "category": "business"
  }'

# Tool 2: Text processing
curl -X POST http://localhost:8000/tools/register-custom \
  -d '{
    "name": "count_words",
    "description": "Count words in text",
    "code": "def count_words(text: str) -> int:\n    return len(text.split())",
    "category": "text"
  }'

# Tool 3: Date handling
curl -X POST http://localhost:8000/tools/register-custom \
  -d '{
    "name": "days_until",
    "description": "Calculate days until date",
    "code": "from datetime import datetime\ndef days_until(date_str: str) -> int:\n    target = datetime.fromisoformat(date_str)\n    return (target - datetime.now()).days",
    "category": "datetime"
  }'
```

**Verify:**
- ✅ All 3 tools registered
- ✅ Confirmation for each
- ✅ No errors

---

#### Test 5.2: List Custom Tools

```bash
curl http://localhost:8000/tools/custom
```

**Expected:**
```json
{
  "total_tools": 3,
  "tools": [
    {
      "name": "calculate_tax",
      "description": "Calculate tax on amount",
      "category": "business",
      "created_at": "...",
      "usage_count": 0
    },
    ...
  ],
  "by_category": {
    "business": 1,
    "text": 1,
    "datetime": 1
  }
}
```

**Verify:**
- ✅ All tools listed
- ✅ Correct details
- ✅ Categorized properly

---

#### Test 5.3: Use Custom Tools

```bash
# Use calculate_tax tool
curl -X POST http://localhost:8000/agent/execute-with-custom-tools \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Calculate tax on $1000 with 10% rate",
    "custom_tool_names": ["calculate_tax"]
  }'

# Use count_words tool
curl -X POST http://localhost:8000/agent/execute-with-custom-tools \
  -d '{
    "task": "Count words in: The quick brown fox jumps over the lazy dog",
    "custom_tool_names": ["count_words"]
  }'
```

**Verify:**
- ✅ Tools used by agent
- ✅ Correct results: $100 tax, 9 words
- ✅ Usage count increases
- ✅ Tracked in analytics

---

#### Test 5.4: Remove Custom Tool

```bash
# Remove tool
curl -X DELETE http://localhost:8000/tools/custom/calculate_tax

# Verify removed
curl http://localhost:8000/tools/custom

# Try to use removed tool (should fail)
curl -X POST http://localhost:8000/agent/execute-with-custom-tools \
  -d '{"task": "Calculate tax", "custom_tool_names": ["calculate_tax"]}'
```

**Verify:**
- ✅ Tool removed successfully
- ✅ Not in tools list
- ✅ Cannot be used anymore
- ✅ Error message clear

---

## 🔗 Integration Tests

### Test 1: Full Stack Integration

**Components:** VS Code Extension → Node.js Backend → Python Service

**Steps:**
1. Start all three services
2. Open VS Code Extension Development Host
3. Open Command Palette (Ctrl+Shift+P)
4. Search for "HybridMind: Decompose Task"
5. Enter task: "Create user login API"
6. Monitor logs in all terminals

**Verify:**
- ✅ Command triggers Node.js call
- ✅ Node.js calls Python service
- ✅ Python service processes request
- ✅ Response flows back through stack
- ✅ UI displays results
- ✅ No errors in any layer

---

### Test 2: Python ↔ Node.js Bridge

```bash
# From Node.js, call Python
node -e "
const axios = require('axios');
axios.post('http://localhost:8000/agent/chat', {
  query: 'Hello from Node.js'
}).then(res => console.log(res.data));
"
```

**Verify:**
- ✅ Connection successful
- ✅ Response received
- ✅ Data serialized correctly

---

### Test 3: Data Persistence

**Objective:** Verify data persists across service restarts

```bash
# Create task
TASK_ID=$(curl -X POST http://localhost:8000/task/decompose \
  -d '{"task": "Persistence test"}' | jq -r '.task_id')

echo $TASK_ID > /tmp/test_task_id.txt

# Stop Python service (Ctrl+C in terminal)
# Wait 5 seconds
# Restart: python main.py

# Retrieve task
TASK_ID=$(cat /tmp/test_task_id.txt)
curl http://localhost:8000/task/$TASK_ID
```

**Verify:**
- ✅ Task still exists
- ✅ All data intact
- ✅ Progress preserved
- ✅ No data corruption

---

### Test 4: Concurrent Requests

```bash
# Send 10 concurrent requests
for i in {1..10}; do
  curl -X POST http://localhost:8000/agent/chat \
    -d "{\"query\": \"Request $i\"}" &
done
wait

echo "All requests completed"
```

**Verify:**
- ✅ All requests succeed
- ✅ No race conditions
- ✅ Responses unique
- ✅ No crashes

---

## 📊 Performance & Load Tests

### Test 1: Response Time Benchmarks

```bash
# Measure response times
echo "Task Decomposition:"
time curl -X POST http://localhost:8000/task/decompose \
  -d '{"task": "Simple task"}'

echo "Agent Chat:"
time curl -X POST http://localhost:8000/agent/chat \
  -d '{"query": "Hello"}'

echo "Analytics Report:"
time curl http://localhost:8000/analytics/comprehensive-report
```

**Target Times:**
- ✅ Task decomposition: < 15s
- ✅ Agent chat: < 5s
- ✅ Analytics: < 1s
- ✅ Simple API calls: < 500ms

---

### Test 2: Memory Usage

```bash
# Monitor memory during operations
# Windows PowerShell:
Get-Process python | Select-Object ProcessName, WorkingSet, CPU

# After intensive operations:
# Create 20 tasks, execute all
for i in {1..20}; do
  TASK_ID=$(curl -s -X POST http://localhost:8000/task/decompose \
    -d "{\"task\": \"Load test $i\"}" | jq -r '.task_id')
  curl -s -X POST http://localhost:8000/task/$TASK_ID/execute-all
done

# Check memory again
Get-Process python | Select-Object ProcessName, WorkingSet, CPU
```

**Acceptable Range:**
- ✅ Python service: < 500MB
- ✅ Node.js backend: < 300MB
- ✅ No memory leaks (stable over time)

---

### Test 3: Load Test (100 Requests)

```bash
# Install Apache Bench (if needed)
# Or use this simple loop:

echo "Starting load test: 100 requests"
start_time=$(date +%s)

for i in {1..100}; do
  curl -s -X POST http://localhost:8000/agent/chat \
    -d '{"query": "Load test"}' > /dev/null
  echo -n "."
done

end_time=$(date +%s)
duration=$((end_time - start_time))

echo ""
echo "Completed 100 requests in ${duration}s"
echo "Average: $((duration / 100))s per request"
```

**Target:**
- ✅ 100 requests complete successfully
- ✅ Average < 3s per request
- ✅ No failures
- ✅ No crashes

---

## 🔒 Security Tests

### Test 1: API Authentication (if implemented)

```bash
# Request without auth
curl http://localhost:8000/analytics/comprehensive-report

# With auth (if required)
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8000/analytics/comprehensive-report
```

**Verify:**
- ✅ Unauthorized requests rejected (if auth enabled)
- ✅ Authorized requests succeed
- ✅ Proper status codes (401, 403)

---

### Test 2: Input Validation

```bash
# SQL injection attempt
curl -X POST http://localhost:8000/task/decompose \
  -d '{"task": "Test\"; DROP TABLE tasks; --"}'

# XSS attempt
curl -X POST http://localhost:8000/agent/chat \
  -d '{"query": "<script>alert(1)</script>"}'

# Malformed JSON
curl -X POST http://localhost:8000/agent/chat \
  -d '{invalid json}'

# Extremely long input
curl -X POST http://localhost:8000/agent/chat \
  -d "{\"query\": \"$(python -c 'print("A"*100000)')\"}"
```

**Verify:**
- ✅ Injection attempts sanitized
- ✅ XSS attempts escaped
- ✅ Malformed JSON returns 400
- ✅ Long inputs handled (truncated or rejected)
- ✅ No service crashes

---

### Test 3: Code Execution Safety

```bash
# Attempt to execute malicious code
curl -X POST http://localhost:8000/tools/register-custom \
  -d '{
    "name": "malicious",
    "code": "import os; os.system(\"rm -rf /\")",
    "category": "danger"
  }'
```

**Verify:**
- ✅ Dangerous code rejected
- ✅ System not compromised
- ✅ Error message returned

---

## ⚠️ Error Handling Tests

### Test 1: Invalid Endpoints

```bash
curl http://localhost:8000/nonexistent-endpoint
curl -X POST http://localhost:8000/task/invalid-id
curl http://localhost:8000/task/
```

**Verify:**
- ✅ 404 Not Found returned
- ✅ Error message clear
- ✅ Helpful suggestions (if any)

---

### Test 2: Missing Required Fields

```bash
# Missing task field
curl -X POST http://localhost:8000/task/decompose \
  -d '{}'

# Missing query field
curl -X POST http://localhost:8000/agent/chat \
  -d '{}'
```

**Verify:**
- ✅ 422 Unprocessable Entity
- ✅ Error describes missing field
- ✅ Example provided (if any)

---

### Test 3: Service Unavailability

**Steps:**
1. Stop Python service
2. Try API call from Node.js:

```bash
node -e "
const axios = require('axios');
axios.post('http://localhost:8000/agent/chat', {query: 'test'})
  .catch(err => console.log('Expected error:', err.code));
"
```

**Verify:**
- ✅ Error caught gracefully
- ✅ User-friendly error message
- ✅ Node.js doesn't crash

---

### Test 4: Timeout Handling

```bash
# Request with very complex task (may timeout)
curl -X POST http://localhost:8000/task/decompose \
  -d '{"task": "Build operating system from scratch with kernel, drivers, GUI, networking, security, and full documentation"}' \
  --max-time 30
```

**Verify:**
- ✅ Request times out gracefully
- ✅ Partial result returned (if any)
- ✅ Service remains responsive

---

## 🎭 End-to-End Workflows

### Workflow 1: Complete Feature Development

**Scenario:** Developer wants to add password reset feature

**Steps:**

1. **Decompose Task**
```bash
TASK_ID=$(curl -X POST http://localhost:8000/task/decompose \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Add password reset functionality with email verification to existing user authentication system"
  }' | jq -r '.task_id')

echo "Task ID: $TASK_ID"
```

2. **Review Decomposition**
```bash
curl http://localhost:8000/task/$TASK_ID | jq
```

**Expected subtasks:**
- Design password reset flow
- Create reset token generation
- Implement email service
- Create reset endpoint
- Add frontend UI
- Write tests
- Update documentation

3. **Execute Automatically**
```bash
curl -X POST http://localhost:8000/task/$TASK_ID/execute-all
```

4. **Monitor Progress**
```bash
while true; do
  clear
  curl -s http://localhost:8000/task/$TASK_ID/progress | jq
  sleep 5
done
```

5. **Review Results**
```bash
curl http://localhost:8000/task/$TASK_ID | jq '.subtasks[] | {description, status, result}'
```

**Success Criteria:**
- ✅ All subtasks completed
- ✅ Progress reaches 100%
- ✅ Code generated for each component
- ✅ Tests written and passed
- ✅ Documentation created
- ✅ Total time reasonable (< 30 minutes)

---

### Workflow 2: Debug Complex Issue

**Scenario:** Authentication fails on mobile devices

**Steps:**

1. **Initial Investigation**
```bash
curl -X POST http://localhost:8000/agent/chat \
  -d '{
    "query": "Investigate why authentication works on web but fails on mobile",
    "context": "Users report 401 errors on mobile app, web works fine"
  }'
```

2. **Collaborative Debugging**
```bash
curl -X POST http://localhost:8000/agent/collaborative-debug \
  -H "Content-Type: application/json" \
  -d '{
    "code": "auth.js code here...",
    "error": "401 Unauthorized on mobile",
    "context": "Web works, mobile fails"
  }'
```

3. **Test Fix**
```bash
curl -X POST http://localhost:8000/agent/execute-with-sandbox \
  -d '{
    "task": "Test authentication fix with mobile user agent",
    "context": "Fixed code from previous step"
  }'
```

4. **Create Task for Implementation**
```bash
TASK_ID=$(curl -X POST http://localhost:8000/task/decompose \
  -d '{
    "task": "Implement mobile authentication fix across backend and app"
  }' | jq -r '.task_id')

curl -X POST http://localhost:8000/task/$TASK_ID/execute-all
```

**Success Criteria:**
- ✅ Issue identified (e.g., CORS, user agent, token format)
- ✅ Fix tested and verified
- ✅ Implementation complete
- ✅ Both web and mobile work

---

### Workflow 3: Learning Project

**Scenario:** Developer wants to learn Docker by containerizing their app

**Steps:**

1. **Create Learning Task**
```bash
TASK_ID=$(curl -X POST http://localhost:8000/task/decompose \
  -d '{
    "task": "Learn Docker by containerizing my Node.js + MongoDB app, including development and production configs, multi-stage builds, and docker-compose setup"
  }' | jq -r '.task_id')
```

2. **Review Learning Path**
```bash
curl http://localhost:8000/task/$TASK_ID | jq '.subtasks[] | .description'
```

**Expected learning path:**
- Learn Docker basics
- Create Dockerfile for Node.js
- Create Dockerfile for MongoDB
- Set up docker-compose
- Configure development environment
- Configure production environment
- Learn multi-stage builds
- Add healthchecks
- Document usage

3. **Execute Step-by-Step** (learning mode)
```bash
# Execute one, review, learn, then next
for i in {0..8}; do
  echo "=== Step $i ===" curl -X POST http://localhost:8000/task/$TASK_ID/execute-next
  
  echo "Press Enter to continue..."
  read
done
```

**Success Criteria:**
- ✅ Each step educational
- ✅ Explanations provided
- ✅ Working Docker setup at end
- ✅ Developer understands concepts
- ✅ Documentation created

---

### Workflow 4: Refactoring Project

**Scenario:** Refactor legacy authentication module

**Steps:**

1. **Analysis Phase**
```bash
curl -X POST http://localhost:8000/agent/coordinated-pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Analyze legacy auth.js and propose modern refactoring",
    "agents": ["analyzer", "architect"],
    "context": "Legacy code: [paste code here]"
  }'
```

2. **Create Refactoring Task**
```bash
TASK_ID=$(curl -X POST http://localhost:8000/task/decompose \
  -d '{
    "task": "Refactor auth.js to use async/await, add error handling, improve security, and write tests"
  }' | jq -r '.task_id')
```

3. **Execute with Code Sandbox**
```bash
curl -X POST http://localhost:8000/task/$TASK_ID/execute-all
```

4. **Review Changes**
```bash
curl http://localhost:8000/task/$TASK_ID | jq '.subtasks[] | select(.status == "completed") | {description, result}'
```

**Success Criteria:**
- ✅ Modern code patterns
- ✅ All tests pass
- ✅ Security improved
- ✅ No breaking changes
- ✅ Documentation updated

---

## 📝 Results & Reporting

### Test Results Template

```markdown
# HybridMind v2.0.0 Test Results

**Date:** YYYY-MM-DD  
**Tester:** Name  
**Duration:** X hours  
**Environment:** Windows/Mac/Linux, Python X.X, Node X.X

## Summary

- **Total Tests:** 
- **Passed:** ✅ 
- **Failed:** ❌ 
- **Skipped:** ⏭️ 
- **Success Rate:** %

## Core System Tests

| Test | Status | Notes |
|------|--------|-------|
| Basic Agent Response | ✅ | |
| Multi-Model Support | ✅ | |
| MCP Tools Access | ✅ | |
| Agent Persistence | ✅ | |

## Feature Tests

### Task Decomposition
| Test | Status | Duration | Notes |
|------|--------|----------|-------|
| Basic Decomposition | ✅ | 12s | Created 6 subtasks |
| Complex Task | ✅ | 18s | Created 22 subtasks |
| Progress Tracking | ✅ | 5s | |
| Automatic Execution | ✅ | 45s | |

### Code Execution Sandbox
| Test | Status | Duration | Notes |
|------|--------|----------|-------|
| Simple Code Gen | ✅ | 35s | 2 iterations |
| Team Review | ✅ | 60s | 3 agents |

### Multi-Agent Coordination
| Test | Status | Duration | Notes |
|------|--------|----------|-------|
| Sequential Pipeline | ✅ | 120s | 4 agents |
| Parallel Exploration | ✅ | 90s | 3 agents |

### Tool Analytics
| Test | Status | Notes |
|------|--------|-------|
| Track Usage | ✅ | |
| Comprehensive Report | ✅ | |

### Custom Tools
| Test | Status | Notes |
|------|--------|-------|
| Register Tools | ✅ | 3 tools registered |
| Use Tools | ✅ | Correct results |

## Integration Tests

| Test | Status | Notes |
|------|--------|-------|
| Full Stack Integration | ✅ | |
| Python-Node Bridge | ✅ | |
| Data Persistence | ✅ | |
| Concurrent Requests | ✅ | 10 simultaneous |

## Performance Tests

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Task Decomposition | <15s | 12s | ✅ |
| Agent Chat | <5s | 3s | ✅ |
| Analytics Report | <1s | 0.5s | ✅ |
| Memory (Python) | <500MB | 380MB | ✅ |
| Memory (Node) | <300MB | 180MB | ✅ |

## Security Tests

| Test | Status | Notes |
|------|--------|-------|
| Input Validation | ✅ | All injections blocked |
| Code Safety | ✅ | Malicious code rejected |

## E2E Workflows

| Workflow | Status | Duration | Notes |
|----------|--------|----------|-------|
| Feature Development | ✅ | 25min | Password reset implemented |
| Debug Issue | ✅ | 15min | CORS issue fixed |
| Learning Project | ✅ | 40min | Docker learned & applied |
| Refactoring | ✅ | 30min | Auth module modernized |

## Issues Found

1. **Issue #1:** [Description]
   - Severity: High/Med/Low
   - Status: Open/Fixed
   - Notes: [Details]

## Recommendations

1. [Recommendation 1]
2. [Recommendation 2]

## Conclusion

**Ready for Release:** [ ] Yes [ ] No  

**Reasoning:** [Brief explanation]

**Next Steps:** [What needs to happen]
```

---

### Automated Results Collector

```bash
#!/bin/bash
# save as: collect-test-results.sh

echo "# HybridMind v2.0.0 Test Results" > TEST_RESULTS.md
echo "" >> TEST_RESULTS.md
echo "**Date:** $(date)" >> TEST_RESULTS.md
echo "" >> TEST_RESULTS.md

echo "Running automated tests..."

# Task Decomposition
echo "## Task Decomposition Tests" >> TEST_RESULTS.md
python test-task-decomposition.py > /tmp/td-results.txt 2>&1
if [ $? -eq 0 ]; then
    echo "✅ PASSED" >> TEST_RESULTS.md
else
    echo "❌ FAILED" >> TEST_RESULTS.md
    cat /tmp/td-results.txt >> TEST_RESULTS.md
fi

# Advanced Features
echo "## Advanced Features Tests" >> TEST_RESULTS.md
python test-advanced-features.py > /tmp/af-results.txt 2>&1
if [ $? -eq 0 ]; then
    echo "✅ PASSED" >> TEST_RESULTS.md
else
    echo "❌ FAILED" >> TEST_RESULTS.md
    cat /tmp/af-results.txt >> TEST_RESULTS.md
fi

# MCP Tools
echo "## MCP Tools Tests" >> TEST_RESULTS.md
python test-mcp-tools-integration.py > /tmp/mcp-results.txt 2>&1
if [ $? -eq 0 ]; then
    echo "✅ PASSED" >> TEST_RESULTS.md
else
    echo "❌ FAILED" >> TEST_RESULTS.md
    cat /tmp/mcp-results.txt >> TEST_RESULTS.md
fi

echo "Results saved to TEST_RESULTS.md"
```

---

## 🎯 Quick Test Commands

### Run Everything
```bash
# One command to rule them all
./mega-test.sh
```

### Individual Components
```bash
# Core system
curl http://localhost:8000/health

# Task decomposition
python test-task-decomposition.py

# Advanced features
python test-advanced-features.py

# Integration
node test-hybrid-architecture.js
```

### Key Metrics Check
```bash
# Response times
time curl http://localhost:8000/task/decompose -d '{"task": "test"}'

# Memory usage
Get-Process python,node | Select-Object ProcessName,WorkingSet

# Success rate
curl http://localhost:8000/analytics/comprehensive-report | jq '.overview.overall_success_rate'
```

---

## ✅ Final Checklist

Before declaring v2.0.0 ready:

- [ ] All automated tests pass
- [ ] Manual feature tests complete
- [ ] Integration tests successful
- [ ] Performance meets targets
- [ ] Security tests pass
- [ ] No high-severity bugs
- [ ] E2E workflows work
- [ ] Documentation accurate
- [ ] Real-world scenarios tested
- [ ] Memory usage acceptable
- [ ] Error handling robust

**If all checked:** 🎉 **READY FOR VSIX CREATION!**

---

## 🆘 Troubleshooting

### Tests Failing?

1. **Check services running:**
   ```bash
   curl http://localhost:8000/health
   curl http://localhost:3000/health
   ```

2. **Check logs:**
   - Python: Look at terminal running `python main.py`
   - Node: Look at terminal running `npm start`

3. **Restart services:**
   - Stop both (Ctrl+C)
   - Clear cache if needed
   - Start again

4. **Check environment:**
   ```bash
   python --version  # Should be 3.11+
   node --version    # Should be 18+
   pip list          # Verify packages
   ```

5. **Run individual test:**
   ```bash
   # Instead of full suite, test one feature
   curl -X POST http://localhost:8000/task/decompose \
     -d '{"task": "test"}' -v
   ```

### Performance Issues?

- Close other applications
- Check CPU usage in Task Manager
- Ensure adequate RAM (8GB+ recommended)
- Check API rate limits (if using paid APIs)

---

**Testing Guide Version:** 2.0.0  
**Last Updated:** February 21, 2026  
**Maintainer:** HybridMind Team

---

🚀 **Happy Testing! Let's make v2.0.0 rock-solid!**
