import * as assert from 'assert';
import { resolveWorkspacePath } from '../src/security/workspacePath';
import { FAKE_WORKSPACE_ROOT, OUTSIDE_ABSOLUTE_PATH } from './mocks/platformPaths';
import { resetVscodeMock, setWorkspaceRoot, setNoWorkspace } from './mocks/vscode';

describe('resolveWorkspacePath / safeFileUri', () => {
  const root = FAKE_WORKSPACE_ROOT;

  beforeEach(() => {
    resetVscodeMock();
    setWorkspaceRoot(root);
  });

  it('allows a plain relative path inside the workspace', () => {
    const resolved = resolveWorkspacePath('src/index.ts');
    assert.ok(resolved.startsWith(root));
  });

  it('blocks an absolute path outside the workspace, the gap that let a tool call reach any file on disk', () => {
    assert.throws(
      () => resolveWorkspacePath(OUTSIDE_ABSOLUTE_PATH),
      /Blocked/,
    );
  });

  it('blocks a ../ traversal that escapes the workspace root', () => {
    assert.throws(
      () => resolveWorkspacePath('../../../../etc/passwd'),
      /Blocked/,
    );
  });

  it('allows a nested relative path that stays inside the workspace even with an internal ../ that never escapes', () => {
    const resolved = resolveWorkspacePath('src/agents/../utils/helper.ts');
    assert.ok(resolved.startsWith(root));
  });

  it('throws when no workspace folder is open', () => {
    setNoWorkspace();
    assert.throws(() => resolveWorkspacePath('anything.ts'), /No workspace folder open/);
  });
});
