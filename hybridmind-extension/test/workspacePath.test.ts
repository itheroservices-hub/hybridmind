import * as assert from 'assert';
import { resolveWorkspacePath } from '../src/security/workspacePath';
import { resetVscodeMock, setWorkspaceRoot, setNoWorkspace } from './mocks/vscode';

describe('resolveWorkspacePath / safeFileUri', () => {
  const root = 'C:\\fake-workspace';

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
      () => resolveWorkspacePath('C:\\Users\\someone\\.ssh\\id_rsa'),
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
