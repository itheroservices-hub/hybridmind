/**
 * Simple test to verify OpenRouter-only setup works
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testSimpleRequest() {
  console.log('\n🧪 Testing OpenRouter Model Routing');
  console.log('═'.repeat(60));
  
  try {
    console.log('\n1️⃣  Testing free model (llama-3.3-70b)...');
    const response = await axios.post(`${BASE_URL}/run/single`, {
      model: 'llama-3.3-70b',
      prompt: 'Say "Hello from HybridMind!" in exactly that phrase.'
    });

    console.log('✅ SUCCESS!');
    console.log('Response:', response.data);
    console.log('═'.repeat(60));
    
  } catch (error) {
    console.log('❌ FAILED');
    console.log('Error:', error.response?.data || error.message);
    console.log('═'.repeat(60));
  }
}

// Give server a moment to start if just launched
setTimeout(testSimpleRequest, 1000);
