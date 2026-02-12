/**
 * Quick Test for Strict JSON Agentic Workflow
 * Run this to verify everything is working
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testStrictJsonWorkflow() {
  console.log('🧪 Testing Strict JSON Agentic Workflow\n');

  // Test 1: Simple insert_text
  console.log('Test 1: Insert TODO comment');
  console.log('─'.repeat(50));
  
  try {
    const response = await axios.post(`${BASE_URL}/agent/execute`, {
      goal: 'Add a TODO comment at line 5 of app.ts', // Use 'goal' instead of 'prompt'
      model: 'llama-3.3-70b-versatile',
      provider: 'groq'
    });

    if (response.data.success) {
      console.log('✅ SUCCESS!');
      console.log('Tool Call:', JSON.stringify(response.data.data.toolCall, null, 2));
      console.log('Model:', response.data.data.steps[0].model);
      console.log('Attempt:', response.data.data.steps[0].attempt);
    } else {
      console.log('❌ FAILED:', response.data.error);
    }
  } catch (error) {
    console.log('❌ ERROR:', error.response?.data?.error || error.message);
  }

  console.log('\n' + '═'.repeat(50));
  console.log('✅ Test complete!\n');
}

// Run the test
testStrictJsonWorkflow().catch(console.error);
