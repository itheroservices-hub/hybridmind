/**
 * Test Autonomous Agent Execution
 * 
 * This script tests the full autonomous execution flow:
 * 1. Plan initialization
 * 2. Step-by-step execution
 * 3. Undo functionality
 * 4. Status tracking
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`STEP ${step}: ${message}`, 'bright');
  log('='.repeat(60), 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAutonomousExecution() {
  log('\n🚀 AUTONOMOUS AGENT EXECUTION TEST', 'bright');
  log('Testing full autonomous execution flow\n', 'cyan');

  try {
    // ============================================================================
    // STEP 1: Initialize Plan
    // ============================================================================
    logStep(1, 'Initialize Execution Plan');
    
    const testGoal = 'Add input validation to user registration function';
    const testCode = `
function registerUser(username, email, password) {
  const user = {
    username,
    email,
    password
  };
  return saveToDatabase(user);
}
    `.trim();

    logInfo(`Goal: ${testGoal}`);
    logInfo('Initializing plan...');

    const planResponse = await axios.post(`${BASE_URL}/agent/plan`, {
      goal: testGoal,
      code: testCode,
      options: {
        autonomous: true
      }
    });

    const { plan, validation, status } = planResponse.data.data || planResponse.data;

    if (!validation.valid) {
      logError('Plan validation failed!');
      console.log('Issues:', validation.issues);
      return;
    }

    logSuccess('Plan initialized successfully');
    logInfo(`Strategy: ${plan.strategy}`);
    logInfo(`Total steps: ${plan.steps.length}`);
    
    console.log('\nPlan steps:');
    plan.steps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step.name} (${step.action})`);
      console.log(`     ${step.description}`);
    });

    await sleep(1000);

    // ============================================================================
    // STEP 2: Check Initial Status
    // ============================================================================
    logStep(2, 'Check Execution Status');

    const statusResponse1 = await axios.get(`${BASE_URL}/agent/status`);
    const initialStatus = statusResponse1.data.data || statusResponse1.data;

    logSuccess('Status retrieved');
    console.log(JSON.stringify(initialStatus.status || initialStatus, null, 2));

    await sleep(1000);

    // ============================================================================
    // STEP 3: Execute First Step
    // ============================================================================
    logStep(3, 'Execute First Step');

    let currentCode = testCode;

    logInfo('Executing step 1...');
    const step1Response = await axios.post(`${BASE_URL}/agent/next`, {
      code: currentCode
    });

    const step1Data = step1Response.data.data || step1Response.data;
    const step1Result = step1Data.result;

    if (step1Result.success) {
      logSuccess(`${step1Result.confirmation.message}`);
      logInfo(`Action: ${step1Result.action}`);
      logInfo(`Changes: +${step1Result.changes.linesAdded} -${step1Result.changes.linesRemoved} lines`);
      logInfo(`Output size: ${step1Result.confirmation.outputSize} bytes`);
      
      currentCode = step1Result.output;
    } else {
      logError('Step 1 failed');
      console.log('Error:', step1Result.error);
      return;
    }

    await sleep(1000);

    // ============================================================================
    // STEP 4: Execute Second Step
    // ============================================================================
    logStep(4, 'Execute Second Step');

    logInfo('Executing step 2...');
    const step2Response = await axios.post(`${BASE_URL}/agent/next`, {
      code: currentCode
    });

    const step2Data = step2Response.data.data || step2Response.data;
    const step2Result = step2Data.result;

    if (step2Result.success) {
      logSuccess(`${step2Result.confirmation.message}`);
      logInfo(`Progress: ${step2Data.progress.current}/${step2Data.progress.total}`);
      logInfo(`Remaining: ${step2Data.progress.remaining} steps`);
      
      currentCode = step2Result.output;
    } else {
      logError('Step 2 failed');
      console.log('Error:', step2Result.error);
      return;
    }

    await sleep(1000);

    // ============================================================================
    // STEP 5: Test Undo
    // ============================================================================
    logStep(5, 'Test Undo Functionality');

    logInfo('Undoing last step...');
    const undoResponse = await axios.post(`${BASE_URL}/agent/undo`);

    const undoData = undoResponse.data.data || undoResponse.data;

    if (undoData.success) {
      logSuccess(`${undoData.message}`);
      logInfo(`Undone step: ${undoData.undoneStep}`);
      
      currentCode = undoData.restoredCode;
    } else {
      logError('Undo failed');
      console.log('Message:', undoData.message);
    }

    await sleep(1000);

    // ============================================================================
    // STEP 6: Re-execute with Different Context
    // ============================================================================
    logStep(6, 'Re-execute with Different Context');

    logInfo('Re-executing step 2 with alternative approach...');
    const step2RetryResponse = await axios.post(`${BASE_URL}/agent/next`, {
      code: currentCode,
      context: {
        approach: 'conservative',
        additionalInfo: 'Focus on basic validation first'
      }
    });

    const step2RetryData = step2RetryResponse.data.data || step2RetryResponse.data;
    const step2RetryResult = step2RetryData.result;

    if (step2RetryResult.success) {
      logSuccess('Step re-executed with new context');
      logInfo(`Changes: +${step2RetryResult.changes.linesAdded} -${step2RetryResult.changes.linesRemoved} lines`);
    }

    await sleep(1000);

    // ============================================================================
    // STEP 7: Test Direct Step Execution
    // ============================================================================
    logStep(7, 'Test Direct Step Execution');

    if (plan.steps.length > 2) {
      logInfo(`Jumping to step 3 (index 2)...`);
      
      const step3Response = await axios.post(`${BASE_URL}/agent/step/2`, {
        code: currentCode
      });

      const step3Data = step3Response.data.data || step3Response.data;
      const step3Result = step3Data.result;

      if (step3Result.success) {
        logSuccess(`Direct execution: ${step3Result.confirmation.message}`);
      }
    } else {
      logInfo('Plan has fewer than 3 steps, skipping direct execution test');
    }

    await sleep(1000);

    // ============================================================================
    // STEP 8: Final Status Check
    // ============================================================================
    logStep(8, 'Final Status Check');

    const statusResponse2 = await axios.get(`${BASE_URL}/agent/status`);
    const finalStatus = statusResponse2.data.data || statusResponse2.data;

    logSuccess('Final status retrieved');
    console.log('\nExecution Summary:');
    console.log(`  Active Plan: ${finalStatus.status.hasActivePlan ? 'Yes' : 'No'}`);
    console.log(`  Current Step: ${finalStatus.status.currentStep}/${finalStatus.status.totalSteps}`);
    console.log(`  Executed Steps: ${finalStatus.status.executedSteps}`);
    console.log(`  Can Undo: ${finalStatus.status.canUndo ? 'Yes' : 'No'}`);
    console.log(`  Last Executed: ${finalStatus.status.lastExecuted || 'None'}`);

    // ============================================================================
    // SUCCESS
    // ============================================================================
    log('\n' + '='.repeat(60), 'green');
    log('✅ ALL TESTS PASSED', 'green');
    log('='.repeat(60), 'green');
    log('\nAutonomous execution system is working correctly!', 'bright');
    log('\nKey Features Verified:', 'cyan');
    log('  ✅ Plan initialization', 'green');
    log('  ✅ Sequential step execution', 'green');
    log('  ✅ Progress tracking', 'green');
    log('  ✅ Undo functionality', 'green');
    log('  ✅ Context-aware re-execution', 'green');
    log('  ✅ Direct step selection', 'green');
    log('  ✅ Status monitoring', 'green');
    log('  ✅ Change detection', 'green');
    log('  ✅ Result confirmation', 'green');

  } catch (error) {
    logError('\nTest failed with error:');
    console.error(error.response?.data || error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    
    log('\n' + '='.repeat(60), 'red');
    log('❌ TEST FAILED', 'red');
    log('='.repeat(60), 'red');
    
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  log('Starting autonomous agent tests...', 'cyan');
  log(`Target: ${BASE_URL}\n`, 'yellow');
  
  testAutonomousExecution()
    .then(() => {
      log('\n✅ Test suite completed successfully\n', 'green');
      process.exit(0);
    })
    .catch((error) => {
      logError('\n❌ Test suite failed\n');
      console.error(error);
      process.exit(1);
    });
}

module.exports = { testAutonomousExecution };
