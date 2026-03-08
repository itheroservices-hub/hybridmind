/**
 * HybridMind Backend - Agent Tests
 * Automated testing for agent system
 */

const axios = require('axios');
const assert = require('assert');

const BASE_URL = 'http://localhost:3000';

// Use test license key bypass (requires NODE_ENV=test and TEST_LICENSE_KEY env var)
const TEST_KEY = process.env.TEST_LICENSE_KEY || 'hybridmind-test-key';
const AUTH_HEADERS = { 'x-license-key': TEST_KEY };

describe('Agent System Tests', () => {
  
  describe('Planner Agent', () => {
    it('should create a valid plan from a goal', async () => {
      const response = await axios.post(`${BASE_URL}/agent/plan`, {
        goal: 'Add input validation',
        code: 'function test(x) { return x * 2; }',
        options: { autonomous: true }
      }, { headers: AUTH_HEADERS });

      assert.strictEqual(response.status, 200);
      assert.ok(response.data.data.plan);
      assert.ok(Array.isArray(response.data.data.plan.steps));
      assert.ok(response.data.data.plan.steps.length > 0);
    });

    it('should handle missing code gracefully', async () => {
      const response = await axios.post(`${BASE_URL}/agent/plan`, {
        goal: 'Create a function',
        code: '',
        options: { autonomous: true }
      }, { headers: AUTH_HEADERS });

      assert.strictEqual(response.status, 200);
    });
  });

  describe('Executor Agent', () => {
    it('should execute a step successfully', async () => {
      // First create a plan
      const planResponse = await axios.post(`${BASE_URL}/agent/plan`, {
        goal: 'Add error handling',
        code: 'function divide(a, b) { return a / b; }',
        options: { autonomous: true }
      }, { headers: AUTH_HEADERS });

      // Execute first step
      const execResponse = await axios.post(`${BASE_URL}/agent/next`, {
        code: 'function divide(a, b) { return a / b; }'
      }, { headers: AUTH_HEADERS });

      assert.strictEqual(execResponse.status, 200);
      assert.ok(execResponse.data.data.result);
      assert.ok(execResponse.data.data.result.success !== undefined);
    });
  });

  describe('Model Selection', () => {
    it('should return a valid plan for different task types', async () => {
      const tasks = [
        'Add tests',
        'Optimize performance',
        'Fix bugs'
      ];

      for (const goal of tasks) {
        const response = await axios.post(`${BASE_URL}/agent/plan`, {
          goal,
          code: 'function test() { return 1; }',
          options: { autonomous: true }
        }, { headers: AUTH_HEADERS });

        assert.strictEqual(response.status, 200);
        const plan = response.data.data.plan;
        assert.ok(plan, `Expected plan for goal: ${goal}`);
        assert.ok(Array.isArray(plan.steps) && plan.steps.length > 0, `Expected steps for goal: ${goal}`);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid requests', async () => {
      try {
        await axios.post(`${BASE_URL}/agent/plan`, {
          // Missing required fields
        }, { headers: AUTH_HEADERS });
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.ok(error.response.status >= 400);
      }
    });

    it('should handle malformed code', async () => {
      const response = await axios.post(`${BASE_URL}/agent/plan`, {
        goal: 'Fix syntax',
        code: 'function broken( { return; }',
        options: { autonomous: true }
      }, { headers: AUTH_HEADERS });

      // Should still return a plan (agent can fix syntax)
      assert.strictEqual(response.status, 200);
    });
  });
});

// Run tests if this file is executed directly
if (require.main === module) {
  console.log('🧪 Running Agent Tests...\n');
  
  const tests = [
    { name: 'Plan Creation', fn: async () => {
      const response = await axios.post(`${BASE_URL}/agent/plan`, {
        goal: 'Add validation',
        code: 'function test(x) { return x; }',
        options: { autonomous: true }
      });
      assert.strictEqual(response.status, 200);
      console.log('✅ Plan creation test passed');
    }},
    { name: 'Step Execution', fn: async () => {
      await axios.post(`${BASE_URL}/agent/plan`, {
        goal: 'Add comments',
        code: 'function test() {}',
        options: { autonomous: true }
      });
      const response = await axios.post(`${BASE_URL}/agent/next`, {
        code: 'function test() {}'
      });
      assert.strictEqual(response.status, 200);
      console.log('✅ Step execution test passed');
    }},
    { name: 'Multi-Model Support', fn: async () => {
      const response = await axios.post(`${BASE_URL}/agent/plan`, {
        goal: 'Optimize code',
        code: 'for(let i=0;i<arr.length;i++){}',
        options: { autonomous: true }
      });
      assert.strictEqual(response.status, 200);
      console.log('✅ Multi-model test passed');
    }}
  ];

  (async () => {
    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      try {
        await test.fn();
        passed++;
      } catch (error) {
        console.error(`❌ ${test.name} failed:`, error.message);
        failed++;
      }
    }

    console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  })();
}

module.exports = describe;
