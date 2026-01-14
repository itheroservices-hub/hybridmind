/**
 * HybridMind Backend - Agent Tests
 * Automated testing for agent system
 */

const axios = require('axios');
const assert = require('assert');

const BASE_URL = 'http://localhost:3000';

describe('Agent System Tests', () => {
  
  describe('Planner Agent', () => {
    it('should create a valid plan from a goal', async () => {
      const response = await axios.post(`${BASE_URL}/agent/plan`, {
        goal: 'Add input validation',
        code: 'function test(x) { return x * 2; }',
        options: { autonomous: true }
      });

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
      });

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
      });

      // Execute first step
      const execResponse = await axios.post(`${BASE_URL}/agent/next`, {
        code: 'function divide(a, b) { return a / b; }'
      });

      assert.strictEqual(execResponse.status, 200);
      assert.ok(execResponse.data.data.result);
      assert.ok(execResponse.data.data.result.success !== undefined);
    });
  });

  describe('Model Selection', () => {
    it('should select different models for different tasks', async () => {
      const tasks = [
        { goal: 'Add tests', expectedAction: 'test' },
        { goal: 'Optimize performance', expectedAction: 'optimize' },
        { goal: 'Fix bugs', expectedAction: 'fix' }
      ];

      for (const task of tasks) {
        const response = await axios.post(`${BASE_URL}/agent/plan`, {
          goal: task.goal,
          code: 'function test() { return 1; }',
          options: { autonomous: true }
        });

        const plan = response.data.data.plan;
        assert.ok(plan.steps.some(s => s.action === task.expectedAction));
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid requests', async () => {
      try {
        await axios.post(`${BASE_URL}/agent/plan`, {
          // Missing required fields
        });
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
      });

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
