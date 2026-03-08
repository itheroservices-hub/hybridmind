# HybridMind Advanced Features Guide

Complete guide to the 4 advanced features that enhance Python agent capabilities.

## Overview

These advanced features make HybridMind's Python agents more autonomous, capable, and insightful:

1. **Code Execution Sandbox** - Agents test their generated code automatically
2. **Multi-Agent Coordination** - Agents collaborate using shared tools
3. **Tool Usage Analytics** - Track which tools agents use most
4. **Custom Tools** - Easily add domain-specific tools

## 1. Code Execution Sandbox 🔒

Agents generate code, test it in a safe environment, and iterate until it works.

### Features

- **Automatic Testing**: Code is executed and tested automatically
- **Iterative Refinement**: Keeps trying until code works (configurable max iterations)
- **Team Review**: Optional multi-agent review (Coder → Executor → Tester)
- **Safe Execution**: Docker-based sandboxing (optional)
- **Statistics Tracking**: Success rates, iteration counts, execution times

### API Endpoint

```http
POST /agent/execute-with-sandbox
```

### Request Body

```json
{
  "task": "Create a function to calculate fibonacci sequence",
  "language": "python",
  "max_iterations": 3,
  "use_team_review": false
}
```

### Response

```json
{
  "success": true,
  "final_code": "def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)",
  "iterations": 2,
  "all_tests_passed": true,
  "execution_time": 12.5,
  "feature": "code_execution_sandbox"
}
```

### Use Cases

- **Code Generation**: Generate working code, not just syntactically correct code
- **Bug Fixing**: Fix code until all tests pass
- **Algorithm Implementation**: Verify algorithms work correctly
- **API Integration**: Test API calls work before deployment

### Example from Node.js

```javascript
const response = await fetch('http://localhost:8000/agent/execute-with-sandbox', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    task: 'Create a function to validate email addresses',
    language: 'python',
    max_iterations: 3,
    use_team_review: true  // Use multi-agent team
  })
});

const result = await response.json();
console.log('Working code:', result.final_code);
```

---

## 2. Multi-Agent Coordination 🤝

Multiple agents collaborate using shared tools to solve complex problems.

### Coordination Patterns

#### A. Sequential Pipeline

**Researcher → Architect → Coder → Reviewer**

Each agent builds on the previous agent's work.

```http
POST /agent/coordinated-pipeline
```

```json
{
  "task": "Create a data validation system with error handling"
}
```

**Use Cases:**
- Feature development (research → design → implement → review)
- Complex problem solving
- Multi-phase projects

#### B. Parallel Exploration

Multiple agents explore different approaches simultaneously, then a judge picks the best.

```http
POST /agent/parallel-explore
```

```json
{
  "problem": "Design a caching system",
  "approaches": [
    "In-memory cache with LRU",
    "Redis distributed cache",
    "File-based cache with TTL"
  ]
}
```

**Use Cases:**
- Architecture decisions
- Algorithm selection
- Trade-off analysis
- Solution comparison

#### C. Collaborative Debugging

**Analyzer → Fixer → Validator**

Team debugs code together.

```http
POST /agent/collaborative-debug
```

```json
{
  "code": "def divide(a, b):\n    return a / b",
  "error_message": "ZeroDivisionError: division by zero"
}
```

**Use Cases:**
- Bug fixing
- Error diagnosis
- Code optimization
- Test failure analysis

### Response Format

```json
{
  "success": true,
  "phases": [
    {
      "agent": "Researcher",
      "result": "Research findings..."
    },
    {
      "agent": "Architect",
      "result": "Architecture plan..."
    }
  ],
  "execution_time": 45.2,
  "feature": "multi_agent_coordination"
}
```

### Example from Node.js

```javascript
// Sequential pipeline
const response = await fetch('http://localhost:8000/agent/coordinated-pipeline', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    task: 'Build authentication system'
  })
});

const result = await response.json();
result.phases.forEach(phase => {
  console.log(`${phase.agent}: ${phase.result}`);
});
```

---

## 3. Tool Usage Analytics 📊

Track which tools agents use, success rates, and performance metrics.

### Features

- **Usage Statistics**: Which tools are used most
- **Success Rates**: Which tools work reliably
- **Performance Metrics**: Which tools are fastest/slowest
- **Agent Analysis**: Which agents use which tools
- **Task Insights**: Which tools are used for which tasks
- **Time Patterns**: Usage patterns over time

### API Endpoints

#### Get Tool Usage Statistics

```http
GET /analytics/tool-usage
```

**Response:**
```json
{
  "most_used": [
    {
      "tool": "filesystem_read_file",
      "calls": 145,
      "percentage": "32.5%"
    }
  ],
  "by_agent": {
    "code_generator": {
      "filesystem_read_file": 45,
      "web_search": 12
    }
  },
  "performance": {
    "slowest_tools": [...],
    "fastest_tools": [...],
    "most_reliable": [...],
    "least_reliable": [...]
  }
}
```

#### Get Comprehensive Analytics Report

```http
GET /analytics/comprehensive-report
```

**Response:**
```json
{
  "overview": {
    "total_tool_calls": 523,
    "unique_tools": 15,
    "unique_agents": 4,
    "overall_success_rate": "94.3%"
  },
  "most_used_tools": [...],
  "performance": {...},
  "by_agent": {...},
  "by_task_type": {...},
  "time_insights": {...}
}
```

#### Clear Old Analytics Data

```http
POST /analytics/clear
```

```json
{
  "days": 30  // Clear data older than 30 days
}
```

### Use Cases

- **Tool Optimization**: Identify slow or unreliable tools
- **Usage Patterns**: Understand which tools agents prefer
- **Performance Tuning**: Optimize frequently used tools
- **Error Detection**: Find tools that fail often
- **Capacity Planning**: Understand tool usage trends

### Example from Node.js

```javascript
// Get analytics
const response = await fetch('http://localhost:8000/analytics/comprehensive-report');
const analytics = await response.json();

console.log('Total tool calls:', analytics.overview.total_tool_calls);
console.log('Top used tools:', analytics.most_used_tools);
console.log('Success rate:', analytics.overview.overall_success_rate);
```

---

## 4. Custom Tools 🛠️

Easily add domain-specific tools to extend agent capabilities.

### Features

- **Easy Registration**: Add custom tools with simple API
- **Category Organization**: Group tools by category
- **Automatic Tracking**: Usage statistics for custom tools
- **Tool Discovery**: List and search custom tools
- **Agent Integration**: Custom tools work seamlessly with agents

### API Endpoints

#### Register Custom Tool

```http
POST /tools/register-custom
```

```json
{
  "name": "validate_credit_card",
  "description": "Validates credit card numbers using Luhn algorithm",
  "code": "def validate_credit_card(card_number: str) -> bool:\n    # Implementation...\n    return True",
  "category": "validation"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tool 'validate_credit_card' registered successfully",
  "tool_info": {
    "name": "validate_credit_card",
    "category": "validation",
    "call_count": 0
  }
}
```

#### Get Custom Tools

```http
GET /tools/custom
```

**Response:**
```json
{
  "all_tools": [
    {
      "name": "validate_credit_card",
      "description": "Validates credit cards",
      "category": "validation",
      "call_count": 45
    }
  ],
  "statistics": {
    "total_tools": 12,
    "categories": 4,
    "most_used_tools": [...]
  }
}
```

#### Remove Custom Tool

```http
DELETE /tools/custom/{tool_name}
```

#### Execute Agent with Custom Tools

```http
POST /agent/execute-with-custom-tools
```

```json
{
  "task": "Validate this credit card: 4532-1234-5678-9010",
  "agent_type": "code_generator",
  "tool_categories": ["validation"],
  "include_mcp_tools": false
}
```

### Built-in Custom Tools

HybridMind includes several useful custom tools:

**Data Processing:**
- `parse_json_string` - Parse and validate JSON
- `csv_to_json` - Convert CSV to JSON

**Text Processing:**
- `word_count` - Count words in text
- `extract_emails` - Extract email addresses

**Math:**
- `calculate_percentage` - Calculate percentages

**DateTime:**
- `days_between_dates` - Calculate days between dates

**Validation:**
- `validate_email` - Validate email format
- `validate_url` - Validate URL format

### Creating Custom Tools

#### Python Example

```python
from custom_tools import registry

@registry.register_from_function(category="business")
def calculate_discount(price: float, discount_percent: float) -> str:
    '''Calculate discounted price'''
    discount = price * (discount_percent / 100)
    final_price = price - discount
    return f"Original: ${price}, Discount: {discount_percent}%, Final: ${final_price}"
```

#### Via API Example

```javascript
// Register a custom tool
await fetch('http://localhost:8000/tools/register-custom', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'format_phone_number',
    description: 'Format phone numbers to standard format',
    code: `
def format_phone_number(phone: str) -> str:
    '''Format phone number to (XXX) XXX-XXXX'''
    digits = ''.join(filter(str.isdigit, phone))
    if len(digits) == 10:
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    return phone
    `,
    category: 'formatting'
  })
});

// Use the custom tool
const response = await fetch('http://localhost:8000/agent/execute-with-custom-tools', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    task: 'Format this phone number: 5551234567',
    tool_categories: ['formatting']
  })
});
```

### Use Cases

- **Domain-Specific Logic**: Add business-specific tools
- **API Wrappers**: Wrap external APIs as tools
- **Data Transformations**: Custom data processing
- **Validation Rules**: Business validation logic
- **Integration Points**: Connect to internal systems

---

## Integration with Node.js Backend

### Update pythonBridge.js

Add methods to call new endpoints:

```javascript
class PythonBridge {
  // ... existing methods ...
  
  async executeWithSandbox(task, options = {}) {
    return this._makeRequest('/agent/execute-with-sandbox', {
      task,
      language: options.language || 'python',
      max_iterations: options.maxIterations || 3,
      use_team_review: options.useTeamReview || false
    });
  }
  
  async coordinatedPipeline(task) {
    return this._makeRequest('/agent/coordinated-pipeline', { task });
  }
  
  async parallelExplore(problem, approaches) {
    return this._makeRequest('/agent/parallel-explore', { problem, approaches });
  }
  
  async collaborativeDebug(code, errorMessage) {
    return this._makeRequest('/agent/collaborative-debug', { 
      code, 
      error_message: errorMessage 
    });
  }
  
  async getToolAnalytics() {
    return this._makeRequest('/analytics/comprehensive-report', null, 'GET');
  }
  
  async registerCustomTool(name, description, code, category = 'custom') {
    return this._makeRequest('/tools/register-custom', {
      name,
      description,
      code,
      category
    });
  }
}
```

### Use in AgentCoordinator

```javascript
// In agentCoordinator.js
async executeComplexTask(task, context) {
  // For code generation tasks, use sandbox
  if (this.isCodeGenerationTask(task)) {
    return this.pythonBridge.executeWithSandbox(task, {
      useTeamReview: true,
      maxIterations: 3
    });
  }
  
  // For multi-phase tasks, use coordinated pipeline
  if (this.isMultiPhaseTask(task)) {
    return this.pythonBridge.coordinatedPipeline(task);
  }
  
  // For debugging, use collaborative debug
  if (this.isDebuggingTask(task, context)) {
    return this.pythonBridge.collaborativeDebug(
      context.code,
      context.error
    );
  }
  
  // Default execution
  return this.pythonBridge.executeAgent(task);
}
```

---

## Performance Considerations

### Code Execution Sandbox

- **Docker overhead**: ~2-5 seconds per execution
- **Can disable Docker**: Set `use_docker=False` for faster but less safe execution
- **Iteration cost**: Each iteration requires LLM call + execution
- **Recommended**: Max 3-5 iterations to balance quality and speed

### Multi-Agent Coordination

- **Sequential pipeline**: ~4x slower than single agent (4 agents sequentially)
- **Parallel exploration**: ~1.5x slower than single agent (parallel + judge)
- **Collaborative debug**: ~3x slower than single agent (3 agents sequentially)
- **Tradeoff**: Better quality results but longer execution time

### Analytics

- **Minimal overhead**: <1ms per tracked call
- **Auto-save**: Saves to disk every 10 calls
- **Memory usage**: ~1KB per tracked call
- **Cleanup**: Clear old data periodically

### Custom Tools

- **No overhead**: Same performance as built-in tools
- **Python execution**: Fast for simple tools
- **External API calls**: Depends on API latency
- **Caching recommended**: Cache tool results when possible

---

## Best Practices

### 1. Code Execution Sandbox

✅ **Do:**
- Use for critical code generation
- Set reasonable max_iterations (3-5)
- Use team review for complex code
- Test with sample inputs

❌ **Don't:**
- Use for simple string formatting (overkill)
- Set max_iterations > 10 (too slow)
- Execute untrusted code without Docker

### 2. Multi-Agent Coordination

✅ **Do:**
- Use sequential pipeline for multi-phase work
- Use parallel exploration for decision-making
- Use collaborative debug for complex bugs
- Provide clear task descriptions

❌ **Don't:**
- Use for simple one-step tasks
- Overuse (expensive in tokens and time)
- Forget to handle timeouts

### 3. Tool Analytics

✅ **Do:**
- Review analytics weekly
- Clear old data monthly
- Monitor success rates
- Optimize slow tools

❌ **Don't:**
- Track sensitive data
- Let data grow unbounded
- Ignore performance insights

### 4. Custom Tools

✅ **Do:**
- Document tools clearly
- Use descriptive names
- Categorize logically
- Test tools before registering

❌ **Don't:**
- Create duplicate tools
- Use vague descriptions
- Register untested code
- Forget error handling

---

## Monitoring and Debugging

### Check Feature Health

```javascript
// Get analytics to verify features are working
const analytics = await fetch('http://localhost:8000/analytics/comprehensive-report');
const data = await analytics.json();

if (data.overview.total_tool_calls > 0) {
  console.log('✅ Features are being used');
  console.log('Success rate:', data.overview.overall_success_rate);
} else {
  console.log('ℹ️  No usage data yet');
}
```

### View Logs

```bash
# Python service logs show all API calls
tail -f hybridmind-python-service/logs/service.log
```

### Test Individual Features

```bash
# Run test suite
cd hybridmind-python-service
python test-advanced-features.py
```

---

## Troubleshooting

### Code Execution Fails

**Problem:** Sandbox execution times out

**Solution:**
```json
{
  "task": "...",
  "max_iterations": 2,  // Reduce iterations
  "use_team_review": false  // Use single agent
}
```

### Multi-Agent Coordination Slow

**Problem:** Pipeline takes too long

**Solution:** Use simpler tools or single agent for basic tasks

### Analytics Missing Data

**Problem:** No analytics showing up

**Solution:** Verify logs are being written:
```python
from tool_analytics import analytics
print(analytics.get_comprehensive_report())
```

### Custom Tool Registration Fails

**Problem:** Tool code has syntax errors

**Solution:** Test code locally first:
```python
# Test your tool code
exec(your_tool_code)
```

---

## Examples

See complete examples in:
- `test-advanced-features.py` - Test suite with examples
- `HYBRID_ARCHITECTURE.md` - Architecture overview
- `MCP_TOOLS_INTEGRATION.md` - MCP tools usage

---

## Next Steps

1. **Try the features**: Run `python test-advanced-features.py`
2. **Integrate with UI**: Add badges/indicators to show when advanced features are used
3. **Custom tools**: Add domain-specific tools for your use case
4. **Monitor analytics**: Review tool usage weekly to optimize performance
5. **Experiment**: Try different coordination patterns for different task types

---

## API Reference Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/agent/execute-with-sandbox` | POST | Code execution with testing |
| `/agent/coordinated-pipeline` | POST | Sequential multi-agent |
| `/agent/parallel-explore` | POST | Parallel multi-agent |
| `/agent/collaborative-debug` | POST | Team debugging |
| `/analytics/tool-usage` | GET | Tool usage stats |
| `/analytics/comprehensive-report` | GET | Full analytics report |
| `/analytics/clear` | POST | Clear old data |
| `/tools/register-custom` | POST | Register custom tool |
| `/tools/custom` | GET | List custom tools |
| `/tools/custom/{name}` | DELETE | Remove custom tool |
| `/agent/execute-with-custom-tools` | POST | Use custom tools |

Need help? Check the full API documentation at `http://localhost:8000/docs`
