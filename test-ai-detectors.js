/**
 * Comprehensive Test Suite for AI-Powered Detection Systems
 * 
 * Tests all 5 AI-powered detectors:
 * 1. Intent Detection (confirm/cancel/adjust/new_request)
 * 2. Constraint Detection (readOnly/noDelete/noCreate/noTerminal)
 * 3. Security Risk Assessment (low/medium/high/critical)
 * 4. Task Complexity Assessment (simple/moderate/complex)
 * 5. Ambiguity Detection (clear/ambiguous)
 */

const BASE_URL = 'http://localhost:3000/run/single';
const MODEL = 'groq/llama-3.3-70b-versatile';

async function callDetector(systemPrompt, userMessage, maxTokens = 50) {
  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt: `${systemPrompt}\n\nUser message: "${userMessage}"`,
        maxTokens
      })
    });

    const data = await response.json();
    return data.output?.trim() || '';
  } catch (error) {
    return `ERROR: ${error.message}`;
  }
}

// ==================== 1. INTENT DETECTION ====================

async function testIntentDetection() {
  console.log('\n🎯 INTENT DETECTION TESTS\n');
  
  const testCases = [
    { input: 'yes', expected: 'confirm' },
    { input: 'sure thing', expected: 'confirm' },
    { input: 'sounds good', expected: 'confirm' },
    { input: 'let\'s do it', expected: 'confirm' },
    { input: 'k', expected: 'confirm' },
    { input: 'bet', expected: 'confirm' },
    { input: 'no', expected: 'cancel' },
    { input: 'never mind', expected: 'cancel' },
    { input: 'stop', expected: 'cancel' },
    { input: 'but only review', expected: 'adjust' },
    { input: 'ok but read-only', expected: 'adjust' },
    { input: 'what about the API?', expected: 'new_request' }
  ];

  const systemPrompt = `Classify user intent: confirm, cancel, adjust, or new_request. Respond with ONLY one word.`;

  let passed = 0;
  for (const test of testCases) {
    const result = await callDetector(systemPrompt, test.input, 10);
    const intent = result.toLowerCase();
    const success = intent === test.expected;
    if (success) passed++;
    
    console.log(`${success ? '✅' : '❌'} "${test.input}" → ${intent} ${success ? '' : `(expected ${test.expected})`}`);
  }
  
  console.log(`\nPassed: ${passed}/${testCases.length} (${((passed/testCases.length)*100).toFixed(1)}%)`);
}

// ==================== 2. CONSTRAINT DETECTION ====================

async function testConstraintDetection() {
  console.log('\n🔒 CONSTRAINT DETECTION TESTS\n');
  
  const testCases = [
    { input: 'just review the code', expected: { readOnly: true } },
    { input: 'be gentle with my files', expected: { readOnly: true } },
    { input: 'you can look but don\'t touch', expected: { readOnly: true } },
    { input: 'don\'t delete anything', expected: { noDelete: true } },
    { input: 'keep existing files', expected: { noDelete: true } },
    { input: 'no new files please', expected: { noCreate: true } },
    { input: 'don\'t run any commands', expected: { noTerminal: true } },
    { input: 'add a new feature', expected: {} }
  ];

  const systemPrompt = `Identify constraints from user message. Respond with JSON: {"readOnly": false, "noDelete": false, "noCreate": false, "noTerminal": false}. Set true only if constraint is mentioned.`;

  let passed = 0;
  for (const test of testCases) {
    const result = await callDetector(systemPrompt, test.input, 50);
    try {
      const constraints = JSON.parse(result);
      const hasExpectedConstraints = Object.keys(test.expected).every(key => constraints[key] === test.expected[key]);
      if (hasExpectedConstraints) passed++;
      
      const constraintStr = Object.entries(constraints).filter(([k, v]) => v).map(([k]) => k).join(', ') || 'none';
      console.log(`${hasExpectedConstraints ? '✅' : '❌'} "${test.input}" → ${constraintStr}`);
    } catch {
      console.log(`❌ "${test.input}" → Invalid JSON: ${result}`);
    }
  }
  
  console.log(`\nPassed: ${passed}/${testCases.length} (${((passed/testCases.length)*100).toFixed(1)}%)`);
}

// ==================== 3. SECURITY RISK ASSESSMENT ====================

async function testSecurityRiskAssessment() {
  console.log('\n⚠️ SECURITY RISK ASSESSMENT TESTS\n');
  
  const testCases = [
    { operation: 'Review package.json', files: ['package.json'], expected: 'low' },
    { operation: 'Add a button to index.html', files: ['index.html'], expected: 'low' },
    { operation: 'Install express package', files: ['package.json'], expected: 'medium' },
    { operation: 'Modify authentication system', files: ['auth.ts', 'auth.js'], expected: 'medium' },
    { operation: 'Delete old log files', files: ['logs/'], expected: 'high' },
    { operation: 'Run rm -rf node_modules', files: ['node_modules/'], expected: 'critical' },
    { operation: 'Delete all database migrations', files: ['migrations/'], expected: 'critical' }
  ];

  const systemPrompt = `Assess security risk: low, medium, high, or critical. Respond with ONLY one word.`;

  let passed = 0;
  for (const test of testCases) {
    const message = `Operation: ${test.operation}\nFiles: ${test.files.join(', ')}`;
    const result = await callDetector(systemPrompt, message, 5);
    const risk = result.toLowerCase();
    const success = risk === test.expected;
    if (success) passed++;
    
    const emoji = risk === 'critical' ? '🔴' : risk === 'high' ? '🟠' : risk === 'medium' ? '🟡' : '🟢';
    console.log(`${success ? '✅' : '❌'} ${emoji} "${test.operation}" → ${risk} ${success ? '' : `(expected ${test.expected})`}`);
  }
  
  console.log(`\nPassed: ${passed}/${testCases.length} (${((passed/testCases.length)*100).toFixed(1)}%)`);
}

// ==================== 4. TASK COMPLEXITY ASSESSMENT ====================

async function testTaskComplexityAssessment() {
  console.log('\n📊 TASK COMPLEXITY ASSESSMENT TESTS\n');
  
  const testCases = [
    { task: 'Review package.json', expected: 'simple' },
    { task: 'Add a login button', expected: 'simple' },
    { task: 'Fix typo in README', expected: 'simple' },
    { task: 'Refactor authentication module', expected: 'moderate' },
    { task: 'Add user profile feature', expected: 'moderate' },
    { task: 'Implement new API endpoints', expected: 'moderate' },
    { task: 'Refactor entire authentication system', expected: 'complex' },
    { task: 'Migrate to new database architecture', expected: 'complex' },
    { task: 'Rebuild the payment system', expected: 'complex' }
  ];

  const systemPrompt = `Assess task complexity: simple, moderate, or complex. Respond with ONLY one word.`;

  let passed = 0;
  for (const test of testCases) {
    const result = await callDetector(systemPrompt, test.task, 5);
    const complexity = result.toLowerCase();
    const success = complexity === test.expected;
    if (success) passed++;
    
    console.log(`${success ? '✅' : '❌'} "${test.task}" → ${complexity} ${success ? '' : `(expected ${test.expected})`}`);
  }
  
  console.log(`\nPassed: ${passed}/${testCases.length} (${((passed/testCases.length)*100).toFixed(1)}%)`);
}

// ==================== 5. AMBIGUITY DETECTION ====================

async function testAmbiguityDetection() {
  console.log('\n❓ AMBIGUITY DETECTION TESTS\n');
  
  const testCases = [
    { message: 'fix it', expected: 'ambiguous', clarification: 'what needs fixing?' },
    { message: 'make it better', expected: 'ambiguous', clarification: 'better how?' },
    { message: 'update the code', expected: 'ambiguous', clarification: 'which code?' },
    { message: 'Review package.json', expected: 'clear' },
    { message: 'Add a login button to index.html', expected: 'clear' },
    { message: 'Fix the authentication bug in auth.ts', expected: 'clear' }
  ];

  const systemPrompt = `Is this request clear or ambiguous? If ambiguous, respond "AMBIGUOUS: <question>". If clear, respond "CLEAR".`;

  let passed = 0;
  for (const test of testCases) {
    const result = await callDetector(systemPrompt, test.message, 50);
    const isAmbiguous = result.startsWith('AMBIGUOUS');
    const success = (isAmbiguous && test.expected === 'ambiguous') || (!isAmbiguous && test.expected === 'clear');
    if (success) passed++;
    
    console.log(`${success ? '✅' : '❌'} "${test.message}" → ${isAmbiguous ? 'ambiguous' : 'clear'} ${success ? '' : `(expected ${test.expected})`}`);
    if (isAmbiguous) {
      console.log(`   → ${result}`);
    }
  }
  
  console.log(`\nPassed: ${passed}/${testCases.length} (${((passed/testCases.length)*100).toFixed(1)}%)`);
}

// ==================== RUN ALL TESTS ====================

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║  AI-POWERED DETECTION SYSTEMS - TEST SUITE        ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log('\nBackend: http://localhost:3000');
  console.log('Model: Llama 3.3 70B Versatile (Groq)\n');
  
  const startTime = Date.now();
  
  await testIntentDetection();
  await testConstraintDetection();
  await testSecurityRiskAssessment();
  await testTaskComplexityAssessment();
  await testAmbiguityDetection();
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║  TEST SUMMARY                                      ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log(`\nCompleted in ${duration}s`);
  console.log('\n💡 Key Benefits:');
  console.log('   ✅ Natural language understanding (not keyword matching)');
  console.log('   ✅ Handles typos, slang, creative phrasing');
  console.log('   ✅ Context-aware decisions');
  console.log('   ✅ Self-improving (same AI that writes code)');
  console.log('\n🚀 Vision: HybridMind can eventually analyze and improve its own code!\n');
}

// Run if executed directly
if (require.main === module) {
  console.log('Waiting for backend to be ready...\n');
  setTimeout(() => {
    runAllTests().catch(console.error);
  }, 1000);
}

module.exports = {
  testIntentDetection,
  testConstraintDetection,
  testSecurityRiskAssessment,
  testTaskComplexityAssessment,
  testAmbiguityDetection
};
