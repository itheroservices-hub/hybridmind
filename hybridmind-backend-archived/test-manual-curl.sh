#!/bin/bash

# Manual testing with curl commands
# Use these to test the strict JSON agentic service

echo "🧪 Strict JSON Agentic Service - Manual Tests"
echo "=============================================="

BASE_URL="http://localhost:3001"

# Test 1: Simple insert_text
echo ""
echo "Test 1: Simple insert_text tool call"
echo "--------------------------------------"
curl -X POST "$BASE_URL/agent/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Add a TODO comment at line 5 of app.ts",
    "model": "gpt-4-turbo-preview",
    "provider": "openai"
  }' | jq '.'

# Test 2: Apply edit with context
echo ""
echo "Test 2: Apply edit with file context"
echo "--------------------------------------"
curl -X POST "$BASE_URL/agent/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Fix the bug where the function returns undefined",
    "context": "function getUserData() {\n  const user = fetchUser();\n  // Missing return\n}",
    "model": "gpt-4-turbo-preview",
    "provider": "openai"
  }' | jq '.'

# Test 3: Create file
echo ""
echo "Test 3: Create new file"
echo "--------------------------------------"
curl -X POST "$BASE_URL/agent/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a new file called utils.ts with a helper function",
    "model": "gpt-4-turbo-preview",
    "provider": "openai"
  }' | jq '.'

# Test 4: Groq provider
echo ""
echo "Test 4: Using Groq (Llama)"
echo "--------------------------------------"
curl -X POST "$BASE_URL/agent/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Add error handling to this function",
    "context": "function process(data) { return data.map(x => x.value); }",
    "model": "llama-3.3-70b-versatile",
    "provider": "groq"
  }' | jq '.'

# Test 5: Legacy endpoint
echo ""
echo "Test 5: Legacy endpoint"
echo "--------------------------------------"
curl -X POST "$BASE_URL/agent" \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Add a comment to line 10",
    "code": "const x = 5;"
  }' | jq '.'

echo ""
echo "✅ All manual tests complete!"
