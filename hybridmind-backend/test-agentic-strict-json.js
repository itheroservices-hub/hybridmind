/**
 * Test Suite for Strict JSON Agentic Service
 * Tests tool call validation, retry logic, and provider integration
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// Test cases
const tests = [
  {
    name: 'Simple insert_text tool call',
    data: {
      prompt: 'Add a TODO comment at line 5 of app.ts',
      context: '',
      model: 'gpt-4-turbo-preview',
      provider: 'openai'
    },
    expectedTool: 'insert_text'
  },
  {
    name: 'Apply edit with context',
    data: {
      prompt: 'Fix the bug where the function returns undefined',
      context: `function getUserData() {
  const user = fetchUser();
  // Missing return statement
}`,
      model: 'gpt-4-turbo-preview',
      provider: 'openai'
    },
    expectedTool: 'apply_edit'
  },
  {
    name: 'Batch operation',
    data: {
      prompt: 'Add error handling and logging to the function',
      context: `function processData(data) {
  return data.map(item => item.value);
}`,
      model: 'gpt-4-turbo-preview',
      provider: 'openai'
    },
    expectedTool: 'batch'
  },
  {
    name: 'Request clarification',
    data: {
      prompt: 'Refactor this code',
      context: `// Ambiguous code`,
      model: 'gpt-4-turbo-preview',
      provider: 'openai'
    },
    expectedTool: 'request_clarification'
  },
  {
    name: 'Test with Groq (Llama)',
    data: {
      prompt: 'Create a new file called utils.ts with a helper function',
      context: '',
      model: 'llama-3.3-70b-versatile',
      provider: 'groq'
    },
    expectedTool: 'create_file'
  }
];

/**
 * Run a single test
 */
async function runTest(test) {
  console.log(`\n🧪 Testing: ${test.name}`);
  console.log('─'.repeat(60));
  
  try {
    const startTime = Date.now();
    
    const response = await axios.post(
      `${BASE_URL}/agent/execute`,
      test.data,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000 // 30 second timeout
      }
    );
    
    const duration = Date.now() - startTime;
    
    if (response.data.success) {
      const toolCall = response.data.data.toolCall;
      const actualTool = toolCall.tool || (Array.isArray(toolCall) ? toolCall[0]?.tool : 'unknown');
      
      console.log(`✅ SUCCESS (${duration}ms)`);
      console.log(`   Tool: ${actualTool}`);
      console.log(`   Model: ${response.data.data.steps[0].model}`);
      console.log(`   Attempt: ${response.data.data.steps[0].attempt}`);
      console.log(`   Response Preview:`, JSON.stringify(toolCall, null, 2).substring(0, 200) + '...');
      
      // Validate JSON structure
      if (typeof toolCall !== 'object') {
        console.log('❌ VALIDATION FAILED: Response is not a valid JSON object');
        return false;
      }
      
      if (actualTool !== test.expectedTool && test.expectedTool !== 'any') {
        console.log(`⚠️  WARNING: Expected tool "${test.expectedTool}", got "${actualTool}"`);
      }
      
      return true;
    } else {
      console.log('❌ FAILED:', response.data.error);
      return false;
    }
    
  } catch (error) {
    console.log('❌ ERROR:', error.response?.data?.error || error.message);
    if (error.response?.data) {
      console.log('   Response:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

/**
 * Test legacy endpoint
 */
async function testLegacyEndpoint() {
  console.log(`\n🧪 Testing: Legacy endpoint (/agent)`);
  console.log('─'.repeat(60));
  
  try {
    const response = await axios.post(
      `${BASE_URL}/agent`,
      {
        goal: 'Add a comment to line 10',
        code: 'const x = 5;'
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );
    
    console.log('✅ SUCCESS');
    console.log('   Output:', JSON.stringify(response.data.output, null, 2).substring(0, 200) + '...');
    return true;
  } catch (error) {
    console.log('❌ ERROR:', error.response?.data?.error || error.message);
    return false;
  }
}

/**
 * Test validation utility directly
 */
function testValidation() {
  console.log(`\n🧪 Testing: Validation Utility`);
  console.log('─'.repeat(60));
  
  const { validateToolCall } = require('./utils/toolCallValidator');
  
  const testCases = [
    {
      name: 'Valid apply_edit',
      data: {
        tool: 'apply_edit',
        file: 'test.ts',
        start: { line: 1, character: 0 },
        end: { line: 2, character: 0 },
        text: 'new code'
      },
      shouldPass: true
    },
    {
      name: 'Invalid - missing file',
      data: {
        tool: 'apply_edit',
        start: { line: 1, character: 0 },
        end: { line: 2, character: 0 },
        text: 'new code'
      },
      shouldPass: false
    },
    {
      name: 'Invalid - unknown tool',
      data: {
        tool: 'magic_wand',
        file: 'test.ts'
      },
      shouldPass: false
    },
    {
      name: 'Valid batch',
      data: {
        tool: 'batch',
        actions: [
          { tool: 'thought', content: 'Thinking...' },
          { tool: 'insert_text', file: 'app.ts', position: { line: 5, character: 0 }, text: 'code' }
        ]
      },
      shouldPass: true
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testCases) {
    const result = validateToolCall(test.data);
    const actualPass = result.valid;
    
    if (actualPass === test.shouldPass) {
      console.log(`✅ ${test.name}`);
      passed++;
    } else {
      console.log(`❌ ${test.name}`);
      console.log(`   Expected: ${test.shouldPass}, Got: ${actualPass}`);
      console.log(`   Errors:`, result.errors);
      failed++;
    }
  }
  
  console.log(`\nValidation Tests: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🚀 Starting Strict JSON Agentic Service Tests');
  console.log('═'.repeat(60));
  
  // Check if server is running
  try {
    await axios.get(`${BASE_URL}/health`).catch(() => {
      console.log('⚠️  Warning: Health check failed, but continuing tests...');
    });
  } catch (error) {
    console.log('❌ Backend server not responding at', BASE_URL);
    console.log('   Please start the server with: npm start');
    process.exit(1);
  }
  
  // Test validation utility first
  const validationPassed = testValidation();
  
  // Test legacy endpoint
  await testLegacyEndpoint();
  
  // Run all API tests
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const result = await runTest(test);
    if (result) {
      passed++;
    } else {
      failed++;
    }
    
    // Small delay between tests to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Test Summary:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('═'.repeat(60));
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('❌ Test suite crashed:', error);
  process.exit(1);
});
