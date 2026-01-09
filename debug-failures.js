const axios = require('axios');
require('dotenv').config();

async function debugFailures() {
  console.log('🔍 Debugging Failed Tests\n');

  // Test DeepSeek
  console.log('1️⃣ Testing DeepSeek Chat...');
  try {
    const res = await axios.post('http://localhost:3000/run/single', {
      model: 'deepseek-chat',
      prompt: 'Hello'
    });
    console.log('✅ DeepSeek works');
  } catch (error) {
    console.log('❌ DeepSeek failed:', error.response?.data || error.message);
  }

  // Test Qwen
  console.log('\n2️⃣ Testing Qwen Max...');
  try {
    const res = await axios.post('http://localhost:3000/run/single', {
      model: 'qwen-max',
      prompt: 'Hello'
    });
    console.log('✅ Qwen works');
  } catch (error) {
    console.log('❌ Qwen failed:', error.response?.data || error.message);
  }

  // Test Parallel
  console.log('\n3️⃣ Testing Parallel...');
  try {
    const res = await axios.post('http://localhost:3000/run/parallel', {
      models: ['llama-3.3-70b', 'gemini-2.0-flash-exp'],
      prompt: 'Hello'
    });
    console.log('✅ Parallel works');
  } catch (error) {
    console.log('❌ Parallel failed:', error.response?.data || error.message);
  }

  // Test Chain
  console.log('\n4️⃣ Testing Chain...');
  try {
    const res = await axios.post('http://localhost:3000/run/chain', {
      models: ['llama-3.3-70b', 'gemini-2.0-flash-exp'],
      prompt: 'Hello'
    });
    console.log('✅ Chain works');
  } catch (error) {
    console.log('❌ Chain failed:', error.response?.data || error.message);
  }

  // Test Agentic
  console.log('\n5️⃣ Testing Agentic...');
  try {
    const res = await axios.post('http://localhost:3000/agent/execute', {
      goal: 'Write hello world',
      code: ''
    });
    console.log('✅ Agentic works');
  } catch (error) {
    console.log('❌ Agentic failed:', error.response?.data || error.message);
  }
}

debugFailures();
