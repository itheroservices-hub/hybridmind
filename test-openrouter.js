/**
 * Test OpenRouter API integration with multiple models
 */

const fetch = require('node-fetch');
require('dotenv').config();

const API_KEY = process.env.OPENROUTER_API_KEY;
const BASE_URL = 'https://openrouter.ai/api/v1';

const TEST_MODELS = [
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'openai/o1-mini', name: 'o1-mini' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' },
  { id: 'mistralai/codestral', name: 'Codestral' }
];

async function testModel(model) {
  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'HybridMind'
      },
      body: JSON.stringify({
        model: model.id,
        messages: [
          { role: 'user', content: 'Say "Hello from ' + model.name + '!" and nothing else.' }
        ],
        max_tokens: 50
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error?.message || 'Unknown error' };
    }
    
    return {
      success: true,
      response: data.choices[0].message.content,
      tokens: data.usage.total_tokens
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testAllModels() {
  console.log('🧪 Testing New OpenRouter Models\n');
  
  if (!API_KEY) {
    console.error('❌ OPENROUTER_API_KEY not set in .env file');
    return;
  }
  
  console.log('✓ API Key found:', API_KEY.substring(0, 20) + '...\n');
  
  for (const model of TEST_MODELS) {
    process.stdout.write(`Testing ${model.name}... `);
    const result = await testModel(model);
    
    if (result.success) {
      console.log(`✅ ${result.response} (${result.tokens} tokens)`);
    } else {
      console.log(`❌ ${result.error}`);
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✨ Test complete!');
}

testAllModels();
