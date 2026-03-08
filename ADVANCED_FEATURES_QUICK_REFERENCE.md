# Advanced Features Quick Reference

Quick command reference for HybridMind's 4 advanced Python agent features.

## 🔒 Code Execution Sandbox

**Agents test their own code automatically**

```bash
# Basic usage
curl -X POST http://localhost:8000/agent/execute-with-sandbox \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Create a fibonacci function",
    "language": "python",
    "max_iterations": 3
  }'

# With team review
curl -X POST http://localhost:8000/agent/execute-with-sandbox \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Create email validation regex",
    "language": "python",
    "max_iterations": 3,
    "use_team_review": true
  }'
```

**When to use:**
- ✅ Critical code generation
- ✅ Algorithm implementation
- ✅ Bug fixing with verification
- ❌ Simple string formatting (overkill)

---

## 🤝 Multi-Agent Coordination

**Multiple agents collaborate on complex tasks**

### 1. Sequential Pipeline (Research→Plan→Code→Review)

```bash
curl -X POST http://localhost:8000/agent/coordinated-pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Build authentication system"
  }'
```

**When to use:** Multi-phase development, complex features

### 2. Parallel Exploration

```bash
curl -X POST http://localhost:8000/agent/parallel-explore \
  -H "Content-Type: application/json" \
  -d '{
    "problem": "Design caching system",
    "approaches": [
      "In-memory cache",
      "Redis cache",
      "File-based cache"
    ]
  }'
```

**When to use:** Architecture decisions, algorithm selection, trade-off analysis

### 3. Collaborative Debugging

```bash
curl -X POST http://localhost:8000/agent/collaborative-debug \
  -H "Content-Type: application/json" \
  -d '{
    "code": "def divide(a, b):\n    return a / b",
    "error_message": "ZeroDivisionError"
  }'
```

**When to use:** Complex bugs, error diagnosis, test failures

---

## 📊 Tool Usage Analytics

**Track which tools agents use most**

```bash
# Get usage statistics
curl http://localhost:8000/analytics/tool-usage

# Get comprehensive report
curl http://localhost:8000/analytics/comprehensive-report

# Clear old data
curl -X POST http://localhost:8000/analytics/clear \
  -H "Content-Type: application/json" \
  -d '{"days": 30}'
```

**What you get:**
- Most used tools
- Success rates
- Performance metrics (speed)
- Usage by agent type
- Usage by task type

---

## 🛠️ Custom Tools

**Add domain-specific tools**

### Register Custom Tool

```bash
curl -X POST http://localhost:8000/tools/register-custom \
  -H "Content-Type: application/json" \
  -d '{
    "name": "calculate_discount",
    "description": "Calculate discounted price",
    "code": "def calculate_discount(price: float, percent: float) -> str:\n    discount = price * (percent / 100)\n    return f\"Final: ${price - discount}\"",
    "category": "business"
  }'
```

### List Custom Tools

```bash
# All custom tools
curl http://localhost:8000/tools/custom

# By category
curl "http://localhost:8000/tools/custom?category=business"
```

### Use Custom Tools with Agent

```bash
curl -X POST http://localhost:8000/agent/execute-with-custom-tools \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Calculate 20% discount on $100",
    "tool_categories": ["business"],
    "agent_type": "code_generator"
  }'
```

### Remove Custom Tool

```bash
curl -X DELETE http://localhost:8000/tools/custom/calculate_discount
```

---

## JavaScript/Node.js Examples

### From pythonBridge.js

```javascript
// Code execution
const result = await pythonBridge.executeWithSandbox(
  'Create fibonacci function',
  { maxIterations: 3, useTeamReview: true }
);

// Sequential pipeline
const pipeline = await pythonBridge.coordinatedPipeline(
  'Build authentication system'
);

// Parallel exploration
const exploration = await pythonBridge.parallelExplore(
  'Design caching system',
  ['In-memory', 'Redis', 'File-based']
);

// Collaborative debugging
const debug = await pythonBridge.collaborativeDebug(
  buggyCode,
  'ZeroDivisionError'
);

// Get analytics
const analytics = await pythonBridge.getToolAnalytics();

// Register custom tool
await pythonBridge.registerCustomTool(
  'my_tool',
  'Does something useful',
  'def my_tool(x):\n    return x * 2',
  'math'
);
```

---

## Built-in Custom Tools

**Data Processing:**
- `parse_json_string` - Parse and validate JSON
- `csv_to_json` - Convert CSV to JSON

**Text Processing:**
- `word_count` - Count words
- `extract_emails` - Extract emails from text

**Math:**
- `calculate_percentage` - Calculate percentages

**DateTime:**
- `days_between_dates` - Days between two dates

**Validation:**
- `validate_email` - Validate email format
- `validate_url` - Validate URL format

---

## Testing

```bash
# Run full test suite
python test-advanced-features.py

# Test specific feature
python -c "
import requests
result = requests.post('http://localhost:8000/agent/execute-with-sandbox', json={
    'task': 'Create hello world function',
    'language': 'python',
    'max_iterations': 1
})
print(result.json())
"
```

---

## Performance Tips

### Code Execution Sandbox
- ⚡ 2-5s overhead per execution (Docker)
- 💡 Disable Docker for speed: `use_docker=False`
- 📊 Use 3-5 max iterations (balance quality/speed)

### Multi-Agent Coordination
- ⚡ Sequential: ~4x slower (worth it for quality)
- ⚡ Parallel: ~1.5x slower (faster than sequential)
- 💡 Use single agent for simple tasks

### Analytics
- ⚡ <1ms overhead per call
- 💡 Clear old data monthly
- 📊 Auto-saves every 10 calls

### Custom Tools
- ⚡ Same speed as built-in tools
- 💡 Cache external API results
- 📊 Test before registering

---

## Common Patterns

### Generate and Test Code
```javascript
// Generate working code automatically
const result = await pythonBridge.executeWithSandbox(
  'Create function to parse dates',
  { maxIterations: 3, useTeamReview: true }
);
// Result includes tested, working code
```

### Multi-Phase Development
```javascript
// Research → Design → Implement → Review
const result = await pythonBridge.coordinatedPipeline(
  'Add payment processing feature'
);
// Each phase builds on previous
```

### Compare Solutions
```javascript
// Try different approaches, pick best
const result = await pythonBridge.parallelExplore(
  'Optimize database queries',
  ['Indexing', 'Caching', 'Denormalization']
);
console.log('Winner:', result.chosen_approach);
```

### Fix Bugs Automatically
```javascript
// Team debugs together
const result = await pythonBridge.collaborativeDebug(
  buggyCode,
  errorMessage
);
console.log('Fixed code:', result.fixed_code);
```

---

## Troubleshooting

**Sandbox timeout:**
```json
{"max_iterations": 2, "use_team_review": false}
```

**Coordination too slow:**
- Use single agent for simple tasks
- Reduce tool set to essentials

**No analytics data:**
```python
from tool_analytics import analytics
print(analytics.tool_calls)  # Check if tracking
```

**Custom tool error:**
```python
# Test code locally first
exec(your_tool_code)
```

---

## Next Steps

1. ✅ Start Python service: `python main.py`
2. ✅ Run tests: `python test-advanced-features.py`
3. ✅ Try examples above
4. ✅ Read full guide: `ADVANCED_FEATURES.md`
5. ✅ Integrate with Node.js: Update `pythonBridge.js`

**API Docs:** http://localhost:8000/docs
