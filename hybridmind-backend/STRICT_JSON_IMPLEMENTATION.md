# Strict JSON Tool Calls - Backend Configuration

This document describes the backend implementation of strict JSON tool calls for the HybridMind agentic workflow system.

## Overview

The backend now enforces strict JSON output from AI models, ensuring that all agentic responses follow a defined tool-call schema. This eliminates parsing errors and fake "Tool Call:" blocks that previously caused issues.

## Architecture

### 1. System Prompt (`config/agenticPrompts.js`)

Contains `STRICT_JSON_SYSTEM_PROMPT` that instructs AI models to:
- Output ONLY valid JSON
- NO markdown code blocks
- NO natural language explanations
- Follow exact tool schemas

### 2. Validation Utility (`utils/toolCallValidator.js`)

Provides three key functions:
- `validateToolCall(obj)` - Validates tool schema
- `cleanJsonOutput(rawOutput)` - Removes markdown code blocks
- `parseAndValidate(rawOutput, attempt)` - Complete parse & validate flow

### 3. Agentic Service (`services/agenticService.js`)

Handles API calls to all providers with:
- **Retry logic** (up to 3 attempts)
- **JSON mode enforcement** (`response_format: { type: 'json_object' }`)
- **Provider support**:
  - OpenAI (GPT-4, GPT-3.5)
  - Groq (Llama, Mixtral)
  - DeepSeek
  - OpenRouter
  - Anthropic (Claude)

### 4. Updated Routes & Controllers

- `routes/agent.js` - New `/execute` endpoint with strict JSON
- `controllers/agentController.js` - Updated to use agenticService

## Available Tools

The system supports these tool types:

1. **apply_edit** - Replace code at a location
2. **insert_text** - Insert code at a position
3. **create_file** - Create a new file
4. **delete_file** - Delete a file
5. **batch** - Execute multiple actions atomically
6. **thought** - Record reasoning (non-modifying)
7. **request_clarification** - Ask user for information

## API Usage

### Execute Agentic Workflow

```javascript
POST /agent/execute

{
  "prompt": "Fix the bug in app.ts",
  "context": "const foo = () => { ... }",
  "model": "gpt-4-turbo-preview",
  "provider": "openai"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "steps": [
      {
        "model": "gpt-4-turbo-preview",
        "provider": "openai",
        "attempt": 1,
        "aiResponse": "{\"tool\":\"apply_edit\",\"file\":\"app.ts\",...}",
        "usage": { "total_tokens": 0 },
        "cost": 0
      }
    ],
    "toolCall": {
      "tool": "apply_edit",
      "file": "app.ts",
      "start": { "line": 10, "character": 0 },
      "end": { "line": 15, "character": 0 },
      "text": "fixed code here"
    }
  }
}
```

## Provider Configuration

### OpenAI

```javascript
{
  model: 'gpt-4-turbo-preview',
  response_format: { type: 'json_object' },
  temperature: 0.2,
  max_tokens: 2000
}
```

### Groq

```javascript
{
  model: 'llama-3.3-70b-versatile',
  response_format: { type: 'json_object' }, // Supported
  temperature: 0.1,
  max_tokens: 2000
}
```

### DeepSeek

```javascript
{
  model: 'deepseek-chat',
  temperature: 0.3,
  max_tokens: 2000
  // No response_format support yet - relies on system prompt
}
```

### OpenRouter

```javascript
{
  model: 'anthropic/claude-3-sonnet',
  temperature: 0.2,
  max_tokens: 2000,
  // response_format support varies by model
}
```

## Retry Logic

The service automatically retries on failures:

1. **Attempt 1**: Initial call with strict system prompt
2. **Attempt 2**: If invalid, retry with error feedback
3. **Attempt 3**: Final attempt with critical warning

Example retry request:
```
CRITICAL: Previous response was invalid. Error: Missing "tool" field
Output ONLY valid JSON matching the tool schema.

Original request: Fix the bug in app.ts
```

## Error Handling

The service provides detailed error messages:

- **Invalid JSON syntax**: Parsing failed
- **Schema validation failed**: Missing required fields
- **Unknown tool type**: Tool not in approved list
- **API call failed**: Network or authentication error

## Environment Variables

Required in `.env`:

```bash
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
DEEPSEEK_API_KEY=...
OPENROUTER_API_KEY=sk-or-...
ANTHROPIC_API_KEY=sk-ant-...
```

## Testing

Test the strict JSON flow:

```bash
# Start backend
npm start

# Test endpoint
curl -X POST http://localhost:3001/agent/execute \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Add a TODO comment at line 5 of app.ts",
    "model": "gpt-4-turbo-preview",
    "provider": "openai"
  }'
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
      "text": "// TODO: Implement feature\n"
    }
  }
}
```

## Integration with VS Code Extension

The extension should:

1. Call `POST /agent/execute` with prompt and context
2. Parse `data.toolCall` from response
3. Execute the tool action (apply_edit, insert_text, etc.)
4. Handle errors from `success: false` responses

Example extension code:

```typescript
const response = await fetch('http://localhost:3001/agent/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: userRequest,
    context: fileContent,
    model: 'gpt-4-turbo-preview',
    provider: 'openai'
  })
});

const result = await response.json();
if (result.success) {
  const toolCall = result.data.toolCall;
  // Execute tool call...
}
```

## Benefits

1. **No more parsing errors** - Guaranteed valid JSON
2. **No fake tool calls** - Schema validation enforces structure
3. **Automatic retries** - Handles AI mistakes gracefully
4. **Multi-provider support** - Works with all major AI providers
5. **Detailed logging** - Debug issues easily

## Future Enhancements

- Token usage tracking
- Cost calculation per request
- Model performance metrics
- Tool call caching
- Batch optimization
