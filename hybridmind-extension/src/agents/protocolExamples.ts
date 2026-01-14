/**
 * Example: Using the HybridMind Protocol System
 * 
 * This file demonstrates how to use the protocol handler
 * for AI interactions with full workspace context
 */

import { ProtocolHandler } from './protocolHandler';
import { AgentPlanner } from './agentPlanner';
import { AutonomyManager } from './autonomyManager';

// ========================================
// Example 1: Basic Request with Full Context
// ========================================
async function basicRequestExample() {
  const protocol = new ProtocolHandler();
  
  // Build a request with full workspace context
  const request = await protocol.buildRequest(
    "Review the error handling in modelProxy.js",
    "llama-3.3-70b-versatile",
    "Focus on edge cases and error recovery"
  );
  
  console.log('System Prompt includes:');
  console.log('- Core AI instructions');
  console.log('- Workspace structure');
  console.log('- Environment info');
  console.log('- Tool guidelines');
  
  // Send to backend
  const axios = require('axios');
  const response = await axios.post('http://localhost:3000/run/single', {
    model: request.model,
    prompt: request.systemPrompt + '\n\n' + request.userMessage
  });
  
  // Parse response
  const aiResponse = protocol.parseResponse(response.data);
  console.log('AI Response:', aiResponse.content);
}

// ========================================
// Example 2: Conversation with History
// ========================================
async function conversationExample() {
  const protocol = new ProtocolHandler();
  
  // First message
  protocol.addToHistory('user', "What's in the services folder?");
  
  const request1 = await protocol.buildRequest(
    "What's in the services folder?",
    "llama-3.3-70b-versatile"
  );
  // ... call API ...
  protocol.addToHistory('assistant', "The services folder contains modelProxy.js, openaiService.js, etc.");
  
  // Follow-up message - context is preserved!
  protocol.addToHistory('user', "Can you review modelProxy.js?");
  
  const request2 = await protocol.buildRequest(
    "Can you review modelProxy.js?",
    "llama-3.3-70b-versatile"
  );
  
  // The request2 includes conversation history from request1
  console.log('Conversation context included in request');
}

// ========================================
// Example 3: Using with AgentPlanner
// ========================================
async function agentPlannerExample() {
  const autonomy = new AutonomyManager();
  const planner = new AgentPlanner(autonomy);
  
  // Set model
  planner.setModel('llama-3.3-70b-versatile');
  
  // Create a plan - automatically uses protocol handler internally
  const plan = await planner.createPlan(
    "Review and improve error handling in modelProxy.js"
  );
  
  if (plan) {
    console.log('Plan created:', plan.goal);
    console.log('Steps:', plan.steps.length);
    
    // Get conversation context
    const context = planner.getConversationContext();
    console.log('Recent conversation:', context);
    
    // Clear history when starting new topic
    planner.clearHistory();
  }
}

// ========================================
// Example 4: Quick Request (No Full Context)
// ========================================
async function quickRequestExample() {
  const protocol = new ProtocolHandler();
  
  // For simple queries that don't need workspace structure
  const request = protocol.buildQuickRequest(
    "What's the difference between let and const?",
    "llama-3.3-70b-versatile"
  );
  
  // Faster to build, lighter weight
  console.log('Quick request built without workspace scanning');
}

// ========================================
// Example 5: Cache Management
// ========================================
async function cacheExample() {
  const protocol = new ProtocolHandler();
  
  // First request builds workspace structure (slow)
  const request1 = await protocol.buildRequest(
    "List all TypeScript files",
    "llama-3.3-70b-versatile"
  );
  
  // Second request uses cached structure (fast)
  const request2 = await protocol.buildRequest(
    "Count the services",
    "llama-3.3-70b-versatile"
  );
  
  // Invalidate cache when files change
  protocol.invalidateCache();
  
  // Next request will rebuild structure
  const request3 = await protocol.buildRequest(
    "Updated workspace check",
    "llama-3.3-70b-versatile"
  );
}

// ========================================
// Example 6: Response Parsing
// ========================================
function responseParsingExample() {
  const protocol = new ProtocolHandler();
  
  // Handle various response formats
  const rawResponse1 = {
    output: "Here's the analysis...",
    model: "llama-3.3-70b",
    tokensUsed: 150
  };
  
  const rawResponse2 = {
    content: "Response text",
    toolCalls: [
      { name: "edit_file", parameters: { file: "test.ts" } }
    ]
  };
  
  const parsed1 = protocol.parseResponse(rawResponse1);
  console.log('Content:', parsed1.content);
  console.log('Model:', parsed1.metadata?.model);
  
  const parsed2 = protocol.parseResponse(rawResponse2);
  console.log('Tool calls:', parsed2.toolCalls);
}

// ========================================
// Example 7: Complete Workflow
// ========================================
async function completeWorkflowExample() {
  const protocol = new ProtocolHandler();
  const axios = require('axios');
  
  console.log('=== Starting AI Workflow ===');
  
  // Step 1: User asks a question
  const userMessage = "Review rateLimiter.js and suggest improvements";
  protocol.addToHistory('user', userMessage);
  
  // Step 2: Build request with full context
  const request = await protocol.buildRequest(
    userMessage,
    "llama-3.3-70b-versatile",
    "Focus on security and performance"
  );
  
  console.log('✓ Built request with:');
  console.log('  - System prompt');
  console.log('  - Workspace structure');
  console.log('  - Conversation history');
  
  // Step 3: Send to API
  const response = await axios.post('http://localhost:3000/run/single', {
    model: request.model,
    prompt: request.systemPrompt + '\n\n' + request.userMessage
  });
  
  console.log('✓ Received response');
  
  // Step 4: Parse response
  const aiResponse = protocol.parseResponse(response.data);
  protocol.addToHistory('assistant', aiResponse.content);
  
  console.log('✓ Parsed response:');
  console.log('  - Content:', aiResponse.content.slice(0, 100) + '...');
  console.log('  - Tool calls:', aiResponse.toolCalls?.length || 0);
  
  // Step 5: Handle follow-up
  const followUp = "Can you implement those changes?";
  protocol.addToHistory('user', followUp);
  
  const request2 = await protocol.buildRequest(
    followUp,
    "llama-3.3-70b-versatile"
  );
  
  // The second request automatically includes context from the first!
  console.log('✓ Follow-up request includes previous conversation');
  
  console.log('=== Workflow Complete ===');
}

// ========================================
// Run Examples
// ========================================
export async function runExamples() {
  console.log('\n📚 HybridMind Protocol System Examples\n');
  
  try {
    console.log('Example 1: Basic Request');
    // await basicRequestExample();
    
    console.log('\nExample 2: Conversation with History');
    // await conversationExample();
    
    console.log('\nExample 3: Agent Planner Integration');
    // await agentPlannerExample();
    
    console.log('\nExample 4: Quick Request');
    // await quickRequestExample();
    
    console.log('\nExample 5: Cache Management');
    // await cacheExample();
    
    console.log('\nExample 6: Response Parsing');
    responseParsingExample();
    
    console.log('\nExample 7: Complete Workflow');
    // await completeWorkflowExample();
    
  } catch (error) {
    console.error('Example error:', error);
  }
}

// Uncomment to run:
// runExamples();
