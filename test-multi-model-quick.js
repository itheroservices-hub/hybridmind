/**
 * QUICK MULTI-MODEL TEST
 * Using correct model IDs from registry
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const TEST_CODE = 'function test() { return 1; }';
const TEST_PROMPT = 'Add error handling';

async function quickTest() {
  console.log('🧪 QUICK MULTI-MODEL SYSTEM TEST\n');
  console.log('='.repeat(60));

  try {
    // Test 1: Single Model
    console.log('\n\n1️⃣  SINGLE MODEL\n');
    const single = await axios.post(`${BASE_URL}/run/single`, {
      model: 'llama-3.3-70b',  // Use friendly name from registry
      prompt: TEST_PROMPT,
      code: TEST_CODE
    });
    console.log('✅ Single model works');
    
    // Response format: { success: true, data: { output: "...", model: "..." }, meta: { usage: {...} } }
    const output = single.data?.data?.output || '';
    console.log(`   Output length: ${output.length} chars`);
    console.log(`   Preview: ${output.substring(0, 100)}...\n`);

    // Test 2: Parallel (2 models)
    console.log('2️⃣  PARALLEL (2 free models)\n');
    const parallel = await axios.post(`${BASE_URL}/run/parallel`, {
      models: ['llama-3.3-70b', 'gemini-flash'],
      prompt: TEST_PROMPT,
      code: TEST_CODE
    });
    console.log('✅ Parallel works');
    parallel.data.data.results.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.model}: ${r.success ? '✓' : '✗'} (${r.output?.length || 0} chars)`);
    });

    // Test 3: Model Chaining
    console.log('\n3️⃣  MODEL CHAINING\n');
    const chain = await axios.post(`${BASE_URL}/run/chain`, {
      models: ['llama-3.3-70b', 'gemini-flash'],
      prompt: TEST_PROMPT,
      code: TEST_CODE
    });
    console.log('✅ Chaining works');
    const chainSteps = chain.data?.data?.steps || chain.data?.steps || [];
    const chainOutput = chain.data?.data?.output || chain.data?.data?.finalOutput || chain.data?.output || '';
    console.log(`   Steps: ${chainSteps.length}`);
    console.log(`   Final output: ${chainOutput.length} chars\n`);

    // Test 4: Get all available models
    console.log('4️⃣  AVAILABLE MODELS\n');
    const allModels = await axios.get(`${BASE_URL}/models`);
    const free = allModels.data.data.models.filter(m => m.tier === 'free');
    const premium = allModels.data.data.models.filter(m => m.tier === 'premium');
    
    console.log(`   Free models: ${free.length}`);
    free.slice(0, 6).forEach(m => console.log(`   - ${m.name}`));
    
    console.log(`\n   Premium models: ${premium.length}`);
    premium.slice(0, 6).forEach(m => console.log(`   - ${m.name}`));

    console.log('\n\n' + '='.repeat(60));
    console.log('🎉 ALL TESTS PASSED!\n');
    console.log('✅ Single model execution works');
    console.log('✅ Parallel comparison works (2 models)');
    console.log('✅ Model chaining works');
    console.log(`✅ ${free.length + premium.length} models available\n`);

  } catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error(`Error: ${error.response?.data?.message || error.message}`);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

quickTest().catch(console.error);
