/**
 * Test Updated Model IDs
 */

const fetch = require('node-fetch');
require('dotenv').config();

const API_KEY = process.env.OPENROUTER_API_KEY;
const BASE_URL = 'https://openrouter.ai/api/v1';

const UPDATED_MODELS = [
  // Reasoning
  { id: 'deepseek/deepseek-r1-0528', name: 'DeepSeek R1 Latest' },
  { id: 'openai/o3-deep-research', name: 'o3 Deep Research' },
  { id: 'microsoft/phi-4-reasoning-plus', name: 'Phi-4 Reasoning' },
  
  // Flagship
  { id: 'anthropic/claude-opus-4.5', name: 'Claude Opus 4.5' },
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5' },
  { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  
  // Specialized
  { id: 'mistralai/codestral-2508', name: 'Codestral 2508' },
  { id: 'mistralai/devstral-2512', name: 'Devstral 2512' },
  { id: 'qwen/qwen3-coder-plus', name: 'Qwen 3 Coder Plus' },
  { id: 'perplexity/sonar-pro-search', name: 'Perplexity Sonar Pro' },
  { id: 'x-ai/grok-4', name: 'Grok 4' }
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
        messages: [{ role: 'user', content: 'Reply with only: "OK"' }],
        max_tokens: 10
      })
    });
    
    const data = await response.json();
    return response.ok ? { success: true } : { success: false, error: data.error?.message };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testUpdatedModels() {
  console.log('🧪 Testing Updated Model IDs\n');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  let working = 0;
  let failed = 0;
  
  for (const model of UPDATED_MODELS) {
    process.stdout.write(`${model.name.padEnd(30)}... `);
    const result = await testModel(model);
    
    if (result.success) {
      console.log('✅ WORKS');
      working++;
    } else {
      console.log(`❌ ${result.error?.substring(0, 50) || 'Failed'}`);
      failed++;
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`\n✅ Working: ${working}/${UPDATED_MODELS.length}`);
  console.log(`❌ Failed: ${failed}/${UPDATED_MODELS.length}`);
  console.log(`\n${working === UPDATED_MODELS.length ? '🎉 ALL MODELS WORKING!' : '⚠️ Some models need attention'}`);
}

testUpdatedModels();
