# HybridMind Protocol System

## Overview

The HybridMind AI Agent uses a structured request/response protocol that enhances AI interactions with comprehensive workspace context, conversation tracking, and standardized formatting.

## Architecture

```
┌─────────────────────┐
│  chatSidebarProvider│
│  (User Interface)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   agentPlanner      │
│  (Planning Engine)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  protocolHandler    │
│  (Request Builder)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   systemPrompt      │
│  (Prompt Templates) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Backend API       │
│  (Model Execution)  │
└─────────────────────┘
```

## Components

### 1. SystemPromptBuilder (`systemPrompt.ts`)

Builds comprehensive system prompts with:
- Core AI instructions and behavior guidelines
- Workflow guidance for complex tasks
- Tool usage instructions
- Communication style guidelines
- Output formatting rules
- Environment information (OS, timestamp)
- Workspace structure (folders, files, active file)

**Methods:**
- `buildSystemPrompt(env, workspace, context)` - Full prompt with all context
- `buildQuickPrompt(message)` - Simplified prompt for quick queries

### 2. ProtocolHandler (`protocolHandler.ts`)

Manages the request/response lifecycle:
- Formats AI requests with system prompts
- Gathers workspace structure (cached for performance)
- Tracks conversation history
- Parses structured AI responses
- Manages context and caching

**Methods:**
- `buildRequest(message, model, context, temp)` - Full structured request
- `buildQuickRequest(message, model)` - Simple request
- `parseResponse(raw)` - Parse and structure AI response
- `addToHistory(role, content)` - Track conversation
- `getHistory()` - Retrieve conversation history
- `clearHistory()` - Reset conversation
- `buildConversationContext()` - Get recent context string
- `invalidateCache()` - Clear workspace structure cache

### 3. AgentPlanner Integration (`agentPlanner.ts`)

Uses protocol handler for:
- Planning phase: Analyze requests and create execution plans
- Code generation: Generate specific code changes
- Conversation tracking: Maintain context across interactions

**New Methods:**
- `getProtocolHandler()` - Access protocol handler
- `clearHistory()` - Clear conversation
- `getConversationContext()` - Get conversation summary

## Request Flow

### 1. User Message
```typescript
const userMessage = "Review rateLimiter.js and suggest improvements";
```

### 2. Build Structured Request
```typescript
const request = await protocolHandler.buildRequest(
  userMessage,
  'llama-3.3-70b-versatile',
  additionalContext
);
```

**Request Structure:**
```typescript
{
  systemPrompt: string,     // Full system prompt with context
  userMessage: string,       // User's actual message
  conversationHistory: [],   // Last 10 messages
  model: string,             // Model to use
  temperature: number        // Optional temperature
}
```

### 3. Send to Backend
```typescript
const response = await axios.post('http://localhost:3000/run/single', {
  model: request.model,
  prompt: request.systemPrompt + '\n\n' + request.userMessage
});
```

### 4. Parse Response
```typescript
const aiResponse = protocolHandler.parseResponse(response.data);
```

**Response Structure:**
```typescript
{
  content: string,           // Main AI response
  toolCalls?: ToolCall[],    // Extracted tool calls
  reasoning?: string,        // AI's reasoning
  metadata: {
    model: string,
    tokensUsed?: number,
    executionTime?: number
  }
}
```

### 5. Update History
```typescript
protocolHandler.addToHistory('user', userMessage);
protocolHandler.addToHistory('assistant', aiResponse.content);
```

## Workspace Structure

The protocol automatically gathers and includes workspace structure:

```
Workspace:
Folders: e:\IThero\HybridMind
Active File: e:\IThero\HybridMind\server.js

Workspace Structure:
HybridMind/
	package.json
	server.js
	README.md
	hybridmind-backend/
		config/
			environment.js
			models.js
		controllers/
			agentController.js
		services/
			modelProxy.js
		...
	hybridmind-extension/
		src/
			agents/
				agentPlanner.ts
				protocolHandler.ts
				systemPrompt.ts
			views/
				chatSidebarProvider.ts
		...
```

## Conversation History

Tracks the last 50 messages (uses last 10 for context):

```typescript
[
  {
    role: 'user',
    content: 'Review rateLimiter.js',
    timestamp: '2026-01-13T...'
  },
  {
    role: 'assistant',
    content: 'I reviewed the file...',
    timestamp: '2026-01-13T...'
  }
]
```

## Caching Strategy

**Workspace Structure:**
- Cached for 5 minutes after first build
- Automatically invalidated on file system changes
- Can be manually invalidated with `invalidateCache()`

**Conversation History:**
- Kept in memory (last 50 messages)
- Automatically trimmed
- Cleared manually or on session end

## Example Usage

### Planning with Full Context
```typescript
const planner = new AgentPlanner(autonomy);
planner.setModel('llama-3.3-70b-versatile');

const plan = await planner.createPlan(
  "Review and improve error handling in modelProxy.js"
);
```

### Code Generation
```typescript
const toolCall = await planner._generateCodeChange(
  {
    type: 'edit',
    description: 'Add try-catch block',
    file: 'path/to/file.js'
  },
  fileContent
);
```

### Conversation Management
```typescript
// Get recent context
const context = planner.getConversationContext();

// Clear history for new session
planner.clearHistory();

// Access handler directly
const handler = planner.getProtocolHandler();
const history = handler.getHistory();
```

## Benefits

1. **Comprehensive Context**: AI has full workspace awareness
2. **Conversation Continuity**: Follow-up requests work naturally
3. **Structured Responses**: Consistent parsing and handling
4. **Performance**: Intelligent caching reduces overhead
5. **Flexibility**: Quick requests for simple queries, full context for complex tasks
6. **Debugging**: Clear separation of concerns, easy to trace requests

## Configuration

### System Prompt Sections

All sections are automatically included in full requests:

- **Core Instructions**: AI identity, behavior, capabilities
- **Workflow Guidance**: Multi-step task handling, parallelization
- **Tool Instructions**: How to use available tools
- **Communication Style**: Concise, direct, helpful
- **Output Formatting**: Markdown, code blocks, file links

### Adjustable Parameters

```typescript
// Temperature (0.0 - 1.0)
const request = await handler.buildRequest(
  message, 
  model, 
  context, 
  0.7  // Default
);

// Workspace depth (1-5)
const structure = await handler.buildWorkspaceStructure(3); // Default

// History size (up to 50 messages)
// Automatically uses last 10 for context
```

## Error Handling

```typescript
try {
  const request = await handler.buildRequest(message, model);
  const response = await callAPI(request);
  const parsed = handler.parseResponse(response);
} catch (error) {
  console.error('Protocol error:', error);
  // Fallback to simple request
  const quickRequest = handler.buildQuickRequest(message, model);
}
```

## Future Enhancements

- [ ] Multi-modal support (images, diagrams)
- [ ] Tool result caching
- [ ] Conversation summarization for long sessions
- [ ] Dynamic context pruning based on relevance
- [ ] Async workspace structure updates
- [ ] Session persistence across restarts
