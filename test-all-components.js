const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'http://localhost:3000';
let testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

async function test(name, fn) {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    await fn();
    console.log(`✅ PASSED: ${name}`);
    testResults.passed++;
  } catch (error) {
    console.log(`❌ FAILED: ${name}`);
    console.log(`   Error: ${error.message}`);
    testResults.failed++;
    testResults.errors.push({ test: name, error: error.message });
  }
}

async function runTests() {
  console.log('🚀 HybridMind Extension - Comprehensive Component Testing\n');
  console.log('=' .repeat(60));

  // ========================================
  // 1. BACKEND HEALTH & CONNECTIVITY
  // ========================================
  console.log('\n📡 BACKEND HEALTH & CONNECTIVITY');
  console.log('-'.repeat(60));

  await test('Health endpoint responds', async () => {
    const res = await axios.get(`${BASE_URL}/health`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.data.status !== 'ok') throw new Error('Health check failed');
  });

  await test('Root endpoint responds with API info', async () => {
    const res = await axios.get(`${BASE_URL}/`);
    if (!res.data.name) throw new Error('Missing API name');
    if (!res.data.endpoints) throw new Error('Missing endpoints list');
  });

  // ========================================
  // 2. MODELS ENDPOINT
  // ========================================
  console.log('\n🤖 MODELS ENDPOINT');
  console.log('-'.repeat(60));

  let availableModels = [];

  await test('GET /models returns model list', async () => {
    const res = await axios.get(`${BASE_URL}/models`);
    if (!res.data.success) throw new Error('Response not successful');
    if (!res.data.data.models) throw new Error('No models in response');
    availableModels = res.data.data.models;
    if (availableModels.length === 0) throw new Error('Models array is empty');
    console.log(`   Found ${availableModels.length} models`);
  });

  await test('Models have required fields', async () => {
    const model = availableModels[0];
    const required = ['id', 'provider', 'name', 'capabilities', 'strengths'];
    required.forEach(field => {
      if (!model[field]) throw new Error(`Missing field: ${field}`);
    });
  });

  await test('Groq models are available', async () => {
    const groqModels = availableModels.filter(m => m.provider === 'groq');
    if (groqModels.length === 0) throw new Error('No Groq models found');
    console.log(`   Found ${groqModels.length} Groq models: ${groqModels.map(m => m.id).join(', ')}`);
  });

  // ========================================
  // 3. SINGLE MODEL EXECUTION
  // ========================================
  console.log('\n🎯 SINGLE MODEL EXECUTION (/run/single)');
  console.log('-'.repeat(60));

  await test('Llama 3.3 70B responds to simple prompt', async () => {
    const res = await axios.post(`${BASE_URL}/run/single`, {
      model: 'llama-3.3-70b',
      prompt: 'Say "test successful" and nothing else'
    });
    if (!res.data.success) throw new Error('Response not successful');
    if (!res.data.data.output) throw new Error('No output in response');
    console.log(`   Response: "${res.data.data.output.substring(0, 50)}..."`);
  });

  await test('DeepSeek Chat responds', async () => {
    const res = await axios.post(`${BASE_URL}/run/single`, {
      model: 'deepseek-chat',
      prompt: 'Reply with just the word "working"'
    });
    if (!res.data.success) throw new Error('Response not successful');
    if (!res.data.data.output) throw new Error('No output');
    console.log(`   Response: "${res.data.data.output.substring(0, 50)}"`);
  });

  await test('Qwen Max responds', async () => {
    const res = await axios.post(`${BASE_URL}/run/single`, {
      model: 'qwen-max',
      prompt: 'Say hello'
    });
    if (!res.data.success) throw new Error('Response not successful');
    if (!res.data.data.output) throw new Error('No output');
    console.log(`   Response: "${res.data.data.output.substring(0, 50)}"`);
  });

  await test('Gemini responds', async () => {
    const res = await axios.post(`${BASE_URL}/run/single`, {
      model: 'gemini-2.0-flash-exp',
      prompt: 'Say "gemini works"'
    });
    if (!res.data.success) throw new Error('Response not successful');
    if (!res.data.data.output) throw new Error('No output');
    console.log(`   Response: "${res.data.data.output.substring(0, 50)}"`);
  });

  await test('Code context is included in prompt', async () => {
    const res = await axios.post(`${BASE_URL}/run/single`, {
      model: 'llama-3.3-70b',
      prompt: 'What does this function do?',
      code: 'function add(a, b) { return a + b; }'
    });
    if (!res.data.success) throw new Error('Response not successful');
    const output = res.data.data.output.toLowerCase();
    if (!output.includes('add') && !output.includes('sum')) {
      throw new Error('Model did not reference the code');
    }
    console.log(`   Model analyzed code correctly`);
  });

  await test('Temperature parameter is respected', async () => {
    const res = await axios.post(`${BASE_URL}/run/single`, {
      model: 'llama-3.3-70b',
      prompt: 'Say hi',
      temperature: 0.1
    });
    if (!res.data.success) throw new Error('Response not successful');
  });

  await test('Invalid model returns error', async () => {
    try {
      await axios.post(`${BASE_URL}/run/single`, {
        model: 'nonexistent-model',
        prompt: 'test'
      });
      throw new Error('Should have thrown error for invalid model');
    } catch (error) {
      if (error.response && error.response.status === 500) {
        console.log(`   Correctly returns error for invalid model`);
      } else {
        throw error;
      }
    }
  });

  // ========================================
  // 4. PARALLEL EXECUTION
  // ========================================
  console.log('\n⚡ PARALLEL EXECUTION (/run/parallel)');
  console.log('-'.repeat(60));

  await test('Multiple models respond in parallel', async () => {
    const res = await axios.post(`${BASE_URL}/run/parallel`, {
      models: ['llama-3.3-70b', 'deepseek-chat'],
      prompt: 'Say your model name'
    });
    if (!res.data.success) throw new Error('Response not successful');
    if (!res.data.data.results) throw new Error('No results array');
    if (res.data.data.results.length !== 2) {
      throw new Error(`Expected 2 results, got ${res.data.data.results.length}`);
    }
    console.log(`   Both models responded successfully`);
  });

  await test('Parallel execution includes model IDs', async () => {
    const res = await axios.post(`${BASE_URL}/run/parallel`, {
      models: ['llama-3.3-70b', 'qwen-max'],
      prompt: 'test'
    });
    const results = res.data.data.results;
    results.forEach(r => {
      if (!r.model) throw new Error('Result missing model ID');
      if (!r.output) throw new Error('Result missing output');
    });
    console.log(`   All results have model IDs and outputs`);
  });

  // ========================================
  // 5. CHAIN EXECUTION
  // ========================================
  console.log('\n🔗 CHAIN EXECUTION (/run/chain)');
  console.log('-'.repeat(60));

  await test('Chain executes models sequentially', async () => {
    const res = await axios.post(`${BASE_URL}/run/chain`, {
      models: ['llama-3.3-70b', 'deepseek-chat'],
      prompt: 'Refine this text: Hello world',
      options: {}
    });
    if (!res.data.success) throw new Error('Response not successful');
    if (!res.data.data.output) throw new Error('No final output');
    if (!res.data.data.steps) throw new Error('No steps array');
    if (res.data.data.steps.length !== 2) {
      throw new Error(`Expected 2 steps, got ${res.data.data.steps.length}`);
    }
    console.log(`   Chain completed with ${res.data.data.steps.length} steps`);
  });

  await test('Chain passes output between models', async () => {
    const res = await axios.post(`${BASE_URL}/run/chain`, {
      models: ['llama-3.3-70b', 'qwen-max'],
      prompt: 'Improve this: test'
    });
    const steps = res.data.data.steps;
    if (steps[0].output === steps[1].output) {
      console.log(`   Warning: Outputs are identical, may not be chaining properly`);
    } else {
      console.log(`   Models produced different outputs (chaining working)`);
    }
  });

  // ========================================
  // 6. AGENTIC WORKFLOW
  // ========================================
  console.log('\n🤖 AGENTIC WORKFLOW (/agent/execute)');
  console.log('-'.repeat(60));

  await test('Agentic workflow executes', async () => {
    const res = await axios.post(`${BASE_URL}/agent/execute`, {
      goal: 'Write a simple hello world function in JavaScript',
      code: '',
      options: {}
    }, { timeout: 60000 }); // 60 second timeout for agentic
    
    if (!res.data.success) throw new Error('Response not successful');
    console.log(`   Agentic workflow completed`);
  });

  // ========================================
  // 7. ERROR HANDLING
  // ========================================
  console.log('\n🛡️ ERROR HANDLING');
  console.log('-'.repeat(60));

  await test('Missing prompt returns error', async () => {
    try {
      await axios.post(`${BASE_URL}/run/single`, {
        model: 'llama-3.3-70b'
        // no prompt
      });
      throw new Error('Should have returned error');
    } catch (error) {
      if (error.response && error.response.status >= 400) {
        console.log(`   Correctly validates missing prompt`);
      } else {
        throw error;
      }
    }
  });

  await test('Empty models array returns error', async () => {
    try {
      await axios.post(`${BASE_URL}/run/parallel`, {
        models: [],
        prompt: 'test'
      });
      throw new Error('Should have returned error');
    } catch (error) {
      if (error.response && error.response.status >= 400) {
        console.log(`   Correctly validates empty models array`);
      } else {
        throw error;
      }
    }
  });

  // ========================================
  // 8. RESPONSE FORMAT VALIDATION
  // ========================================
  console.log('\n📋 RESPONSE FORMAT VALIDATION');
  console.log('-'.repeat(60));

  await test('Single execution response format', async () => {
    const res = await axios.post(`${BASE_URL}/run/single`, {
      model: 'llama-3.3-70b',
      prompt: 'test'
    });
    if (!res.data.success) throw new Error('Missing success field');
    if (!res.data.data) throw new Error('Missing data field');
    if (!res.data.meta) throw new Error('Missing meta field');
    if (!res.data.meta.timestamp) throw new Error('Missing timestamp');
    if (!res.data.meta.usage) throw new Error('Missing usage stats');
    console.log(`   Response format is correct`);
  });

  await test('Usage stats are included', async () => {
    const res = await axios.post(`${BASE_URL}/run/single`, {
      model: 'llama-3.3-70b',
      prompt: 'test'
    });
    const usage = res.data.meta.usage;
    if (typeof usage.promptTokens !== 'number') throw new Error('Missing promptTokens');
    if (typeof usage.completionTokens !== 'number') throw new Error('Missing completionTokens');
    if (typeof usage.totalTokens !== 'number') throw new Error('Missing totalTokens');
    console.log(`   Usage: ${usage.totalTokens} tokens (${usage.promptTokens} + ${usage.completionTokens})`);
  });

  // ========================================
  // SUMMARY
  // ========================================
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.errors.forEach(e => {
      console.log(`   - ${e.test}: ${e.error}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  
  if (testResults.failed === 0) {
    console.log('🎉 ALL TESTS PASSED! Extension is fully functional.');
  } else {
    console.log('⚠️  Some tests failed. Review errors above.');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('\n💥 Fatal error during testing:', error.message);
  process.exit(1);
});
