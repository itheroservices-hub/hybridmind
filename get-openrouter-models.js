/**
 * Get all available models from OpenRouter API
 */

const fetch = require('node-fetch');
require('dotenv').config();

const API_KEY = process.env.OPENROUTER_API_KEY;

async function getAvailableModels() {
  console.log('📡 Fetching available models from OpenRouter...\n');
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    });
    
    const data = await response.json();
    const models = data.data;
    
    console.log(`Found ${models.length} models\n`);
    
    // Filter for interesting models
    const categories = {
      reasoning: [],
      openai: [],
      anthropic: [],
      google: [],
      mistral: [],
      meta: [],
      deepseek: [],
      qwen: [],
      perplexity: [],
      xai: []
    };
    
    models.forEach(model => {
      const id = model.id;
      const name = model.name;
      
      // Categorize
      if (id.includes('o1') || id.includes('o3') || id.includes('reasoning') || id.includes('deepseek-r')) {
        categories.reasoning.push({ id, name });
      }
      if (id.startsWith('openai/')) {
        categories.openai.push({ id, name });
      }
      if (id.startsWith('anthropic/')) {
        categories.anthropic.push({ id, name });
      }
      if (id.startsWith('google/')) {
        categories.google.push({ id, name });
      }
      if (id.startsWith('mistralai/')) {
        categories.mistral.push({ id, name });
      }
      if (id.startsWith('meta-llama/')) {
        categories.meta.push({ id, name });
      }
      if (id.startsWith('deepseek/')) {
        categories.deepseek.push({ id, name });
      }
      if (id.startsWith('qwen/')) {
        categories.qwen.push({ id, name });
      }
      if (id.startsWith('perplexity/')) {
        categories.perplexity.push({ id, name });
      }
      if (id.startsWith('x-ai/')) {
        categories.xai.push({ id, name });
      }
    });
    
    // Print categories
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🧠 REASONING MODELS\n');
    categories.reasoning.slice(0, 10).forEach(m => console.log(`  ${m.id}`));
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🤖 OPENAI MODELS\n');
    categories.openai.slice(0, 15).forEach(m => console.log(`  ${m.id}`));
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎭 ANTHROPIC MODELS\n');
    categories.anthropic.forEach(m => console.log(`  ${m.id}`));
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔮 GOOGLE MODELS\n');
    categories.google.slice(0, 15).forEach(m => console.log(`  ${m.id}`));
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🌊 MISTRAL MODELS\n');
    categories.mistral.forEach(m => console.log(`  ${m.id}`));
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🦙 META LLAMA MODELS\n');
    categories.meta.slice(0, 10).forEach(m => console.log(`  ${m.id}`));
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔬 DEEPSEEK MODELS\n');
    categories.deepseek.forEach(m => console.log(`  ${m.id}`));
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🐉 QWEN MODELS\n');
    categories.qwen.slice(0, 10).forEach(m => console.log(`  ${m.id}`));
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔍 PERPLEXITY MODELS\n');
    categories.perplexity.forEach(m => console.log(`  ${m.id}`));
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('⚡ X.AI MODELS\n');
    categories.xai.forEach(m => console.log(`  ${m.id}`));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

getAvailableModels();
