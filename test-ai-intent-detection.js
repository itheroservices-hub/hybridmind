/**
 * Test AI-Powered Intent Detection
 * 
 * This tests the new natural language understanding for user confirmations.
 * Instead of hardcoded keywords, HybridMind now uses an LLM to understand
 * intent, even with typos, slang, or creative phrasing.
 */

const testCases = [
  // Clear confirmations
  { input: "yes", expected: "confirm" },
  { input: "sure", expected: "confirm" },
  { input: "ok", expected: "confirm" },
  { input: "sure thing", expected: "confirm" },
  { input: "sounds good", expected: "confirm" },
  { input: "let's do it", expected: "confirm" },
  { input: "go ahead", expected: "confirm" },
  { input: "yep", expected: "confirm" },
  { input: "yeah", expected: "confirm" },
  { input: "absolutely", expected: "confirm" },
  
  // Clear cancellations
  { input: "no", expected: "cancel" },
  { input: "cancel", expected: "cancel" },
  { input: "stop", expected: "cancel" },
  { input: "never mind", expected: "cancel" },
  { input: "nah", expected: "cancel" },
  { input: "don't do it", expected: "cancel" },
  
  // Adjustments
  { input: "but only review", expected: "adjust" },
  { input: "ok but read-only", expected: "adjust" },
  { input: "yes but don't delete anything", expected: "adjust" },
  { input: "sure but be careful", expected: "adjust" },
  
  // New requests
  { input: "actually can you check the database instead?", expected: "new_request" },
  { input: "what about the API?", expected: "new_request" },
  { input: "can you help me with something else?", expected: "new_request" },
  
  // Edge cases - typos
  { input: "yse", expected: "confirm" },  // Should handle typo
  { input: "eys", expected: "confirm" },  // Should handle typo
  { input: "surething", expected: "confirm" },  // No space
  
  // Edge cases - slang
  { input: "k", expected: "confirm" },
  { input: "kk", expected: "confirm" },
  { input: "bet", expected: "confirm" },
  { input: "for sure", expected: "confirm" },
  { input: "100%", expected: "confirm" },
  
  // Context-dependent (these need conversation context to classify correctly)
  { input: "do it", expected: "confirm" },
  { input: "proceed", expected: "confirm" },
  { input: "continue", expected: "confirm" }
];

async function testIntent(userMessage, conversationContext = []) {
  try {
    const response = await fetch('http://localhost:3000/run/single', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'groq/llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are classifying user intent in a conversation about executing a plan. The user has been presented with a plan and is responding.

Classify their response as ONE of these:
- "confirm" - User wants to proceed with the plan (yes, ok, sure, sounds good, let's go, etc.)
- "cancel" - User wants to cancel (no, stop, never mind, etc.)
- "adjust" - User wants to modify constraints (but only..., just review, read-only, etc.)
- "new_request" - User is asking something completely different

Respond with ONLY the classification word, nothing else.`
          },
          ...conversationContext,
          {
            role: 'user',
            content: userMessage
          }
        ],
        maxTokens: 10
      })
    });

    const data = await response.json();
    return data.output?.trim().toLowerCase() || 'new_request';
  } catch (error) {
    console.error('Intent detection error:', error.message);
    return 'error';
  }
}

async function runTests() {
  console.log('🧪 Testing AI-Powered Intent Detection\n');
  console.log('This demonstrates natural language understanding vs keyword matching.\n');
  
  const results = {
    passed: 0,
    failed: 0,
    errors: 0
  };

  for (const testCase of testCases) {
    const detected = await testIntent(testCase.input);
    const passed = detected === testCase.expected;
    
    if (detected === 'error') {
      results.errors++;
      console.log(`❌ ERROR: "${testCase.input}"`);
    } else if (passed) {
      results.passed++;
      console.log(`✅ "${testCase.input}" → ${detected}`);
    } else {
      results.failed++;
      console.log(`❌ "${testCase.input}" → ${detected} (expected ${testCase.expected})`);
    }
  }

  console.log('\n📊 Results:');
  console.log(`   Passed: ${results.passed}/${testCases.length}`);
  console.log(`   Failed: ${results.failed}/${testCases.length}`);
  console.log(`   Errors: ${results.errors}/${testCases.length}`);
  console.log(`   Accuracy: ${((results.passed / testCases.length) * 100).toFixed(1)}%`);

  console.log('\n💡 Key Insights:');
  console.log('   - Natural language > keyword matching');
  console.log('   - Handles typos, slang, creative phrasing');
  console.log('   - Same AI that writes code can understand intent');
  console.log('   - Self-improving: HybridMind can eventually enhance its own intent detection');
}

// Run if executed directly
if (require.main === module) {
  console.log('🚀 Starting backend on http://localhost:3000...\n');
  console.log('Make sure the backend is running: npm start or node server.js\n');
  
  setTimeout(() => {
    runTests().catch(console.error);
  }, 1000);
}

module.exports = { testIntent };
