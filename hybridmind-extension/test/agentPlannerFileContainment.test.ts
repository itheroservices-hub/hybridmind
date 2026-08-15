import * as assert from 'assert';
import { AgentPlanner, ExecutionPlan } from '../src/agents/agentPlanner';
import { AutonomyManager, AutonomyLevel } from '../src/agents/autonomyManager';
import { resetVscodeMock, setWorkspaceRoot, writeFileCalls } from './mocks/vscode';

/**
 * Regression test for a real vulnerability found in security review: the
 * 'edit'/'create'/'delete'/'refactor' branch of AgentPlanner._executeStep
 * resolved step.file with a raw vscode.Uri.file()/joinPath() call instead of
 * the same safeFileUri() containment check every other file-touching path in
 * the extension uses. step.file comes from an LLM-generated plan step, so an
 * absolute or ../ path there reached disk directly: reads (fed into the
 * code-gen prompt, an exfil path for SSH keys/.env) and the deterministic
 * fallback's writes both bypassed workspacePath.ts entirely.
 */
describe('AgentPlanner file steps respect workspace containment', () => {
  beforeEach(() => {
    resetVscodeMock();
    setWorkspaceRoot('C:\\fake-workspace');
  });

  function makePlan(file: string): ExecutionPlan {
    return {
      goal: 'test',
      analysis: 'test',
      reasoning: 'test',
      steps: [
        {
          id: 1,
          type: 'create',
          description: 'create a hello world file',
          file,
          reasoning: 'test',
        },
      ],
    };
  }

  it('blocks a create step whose file path escapes the workspace via ../ traversal', async () => {
    const planner = new AgentPlanner(new AutonomyManager(AutonomyLevel.FullAuto));
    const plan = makePlan('../../../../etc/passwd_evil.txt');

    const result = await planner.executePlan(plan);

    assert.strictEqual(result.stepsFailed, 1);
    assert.strictEqual(result.stepsCompleted, 0);
    assert.strictEqual(writeFileCalls.length, 0, 'a path that escapes the workspace must never reach vscode.workspace.fs.writeFile');
    assert.match(result.actions[0].details ?? '', /Blocked/);
  });

  it('blocks a create step whose file path is absolute and outside the workspace', async () => {
    const planner = new AgentPlanner(new AutonomyManager(AutonomyLevel.FullAuto));
    const plan = makePlan('C:\\Users\\someone\\.ssh\\id_rsa');

    const result = await planner.executePlan(plan);

    assert.strictEqual(result.stepsFailed, 1);
    assert.strictEqual(writeFileCalls.length, 0);
    assert.match(result.actions[0].details ?? '', /Blocked/);
  });

  it('still allows a plain relative file path inside the workspace through to the write path', async () => {
    const planner = new AgentPlanner(new AutonomyManager(AutonomyLevel.FullAuto));
    const plan = makePlan('hello.html');
    // Deterministic fallback only fires for a recognized "hello world" HTML request.
    plan.steps[0].description = 'create a hello world html file';

    const result = await planner.executePlan(plan);

    assert.strictEqual(result.stepsCompleted, 1);
    assert.strictEqual(writeFileCalls.length, 1, 'a legitimate in-workspace path should still reach the write path');
  });
});
