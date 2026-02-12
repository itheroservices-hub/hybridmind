/**
 * Comprehensive OpenRouter Model Test
 * Tests all models we added and reports which work
 */

const fetch = require('node-fetch');
require('dotenv').config();

const API_KEY = process.env.OPENROUTER_API_KEY;
const BASE_URL = 'https://openrouter.ai/api/v1';

// All models we want to test
const MODELS_TO_TEST = [
  // Reasoning Models
  { id: 'openai/o1', name: 'OpenAI o1', category: 'Reasoning' },
  { id: 'openai/o1-mini', name: 'OpenAI o1-mini', category: 'Reasoning' },
  { id: 'openai/o1-preview', name: 'OpenAI o1-preview', category: 'Reasoning' },
  { id: 'openai/o3-mini', name: 'OpenAI o3-mini', category: 'Reasoning' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', category: 'Reasoning' },
  { id: 'deepseek/deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill', category: 'Reasoning' },
  
  // Flagship Models
  { id: 'openai/gpt-4o', name: 'GPT-4o', category: 'Flagship' },
  { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', category: 'Flagship' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', category: 'Flagship' },
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', category: 'Flagship' },
  { id: 'anthropic/claude-opus-4', name: 'Claude Opus 4', category: 'Flagship' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', category: 'Flagship' },
  
  // Fast & Affordable
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', category: 'Fast' },
  { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', category: 'Fast' },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', category: 'Fast' },
  { id: 'google/gemini-2.0-flash-thinking-exp', name: 'Gemini Flash Thinking', category: 'Fast' },
  { id: 'google/gemini-flash-1.5', name: 'Gemini Flash 1.5', category: 'Fast' },
  
  // Specialized
  { id: 'mistralai/codestral', name: 'Codestral', category: 'Specialized' },
  { id: 'mistralai/mistral-large', name: 'Mistral Large', category: 'Specialized' },
  { id: 'mistralai/mistral-small', name: 'Mistral Small', category: 'Specialized' },
  { id: 'qwen/qwen-2.5-coder-32b-instruct', name: 'Qwen Coder', category: 'Specialized' },
  { id: 'perplexity/llama-3.1-sonar-large-128k-online', name: 'Perplexity Sonar', category: 'Specialized' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', category: 'Specialized' },
  { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 405B', category: 'Specialized' },
  { id: 'x-ai/grok-2', name: 'Grok 2', category: 'Specialized' },
  { id: 'google/gemini-exp-1206', name: 'Gemini Exp', category: 'Specialized' }
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
          { role: 'user', content: 'Reply with only: "OK"' }
        ],
        max_tokens: 10
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { 
        success: false, 
        error: data.error?.message || JSON.stringify(data.error || 'Unknown error'),
        status: response.status
      };
    }
    
    return {
      success: true,
      response: data.choices[0].message.content,
      tokens: data.usage?.total_tokens || 0,
      model: data.model
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testAllModels() {
  console.log('🧪 COMPREHENSIVE OPENROUTER MODEL TEST\n');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  if (!API_KEY) {
    console.error('❌ OPENROUTER_API_KEY not set in .env file');
    return;
  }
  
  const results = {
    working: [],
    notWorking: [],
    byCategory: {}
  };
  
  for (const model of MODELS_TO_TEST) {
    process.stdout.write(`Testing ${model.name.padEnd(30)}... `);
    const result = await testModel(model);
    
    if (result.success) {
      console.log(`✅ WORKS (${result.tokens} tokens)`);
      results.working.push({ ...model, actualModel: result.model });
      
      if (!results.byCategory[model.category]) {
        results.byCategory[model.category] = { working: [], notWorking: [] };
      }
      results.byCategory[model.category].working.push(model);
    } else {
      console.log(`❌ FAILED: ${result.error.substring(0, 60)}`);
      results.notWorking.push({ ...model, error: result.error });
      
      if (!results.byCategory[model.category]) {
        results.byCategory[model.category] = { working: [], notWorking: [] };
      }
      results.byCategory[model.category].notWorking.push({ ...model, error: result.error });
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Print Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY\n');
  console.log(`✅ Working: ${results.working.length}/${MODELS_TO_TEST.length}`);
  console.log(`❌ Not Working: ${results.notWorking.length}/${MODELS_TO_TEST.length}`);
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📋 BY CATEGORY\n');
  
  for (const [category, models] of Object.entries(results.byCategory)) {
    console.log(`${category}:`);
    console.log(`  ✅ ${models.working.length} working`);
    console.log(`  ❌ ${models.notWorking.length} not working`);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ WORKING MODELS:\n');
  results.working.forEach(m => {
    console.log(`  ✓ ${m.name} (${m.id})`);
  });
  
  if (results.notWorking.length > 0) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('❌ NOT WORKING MODELS:\n');
    results.notWorking.forEach(m => {
      console.log(`  ✗ ${m.name} (${m.id})`);
      console.log(`    Error: ${m.error.substring(0, 100)}`);
    });
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✨ Test Complete!\n');
}

testAllModels();
