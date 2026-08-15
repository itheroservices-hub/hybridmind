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
const proxyquire = __importStar(require("proxyquire"));
function buildVscodeStub(workspaceRoot) {
    return {
        workspace: { workspaceFolders: [{ uri: { fsPath: workspaceRoot } }] },
        Uri: { file: (p) => ({ fsPath: p }) },
        '@global': true,
    };
}
describe('resolveWorkspacePath / safeFileUri', () => {
    const root = 'C:\\fake-workspace';
    it('allows a plain relative path inside the workspace', () => {
        const { resolveWorkspacePath } = proxyquire('../src/security/workspacePath', { vscode: buildVscodeStub(root) });
        const resolved = resolveWorkspacePath('src/index.ts');
        assert.ok(resolved.startsWith(root));
    });
    it('blocks an absolute path outside the workspace, the gap that let a tool call reach any file on disk', () => {
        const { resolveWorkspacePath } = proxyquire('../src/security/workspacePath', { vscode: buildVscodeStub(root) });
        assert.throws(() => resolveWorkspacePath('C:\\Users\\someone\\.ssh\\id_rsa'), /Blocked/);
    });
    it('blocks a ../ traversal that escapes the workspace root', () => {
        const { resolveWorkspacePath } = proxyquire('../src/security/workspacePath', { vscode: buildVscodeStub(root) });
        assert.throws(() => resolveWorkspacePath('../../../../etc/passwd'), /Blocked/);
    });
    it('allows a nested relative path that stays inside the workspace even with an internal ../ that never escapes', () => {
        const { resolveWorkspacePath } = proxyquire('../src/security/workspacePath', { vscode: buildVscodeStub(root) });
        const resolved = resolveWorkspacePath('src/agents/../utils/helper.ts');
        assert.ok(resolved.startsWith(root));
    });
    it('throws when no workspace folder is open', () => {
        const { resolveWorkspacePath } = proxyquire('../src/security/workspacePath', {
            vscode: { workspace: { workspaceFolders: undefined }, Uri: { file: (p) => ({ fsPath: p }) }, '@global': true },
        });
        assert.throws(() => resolveWorkspacePath('anything.ts'), /No workspace folder open/);
    });
});
//# sourceMappingURL=workspacePath.test.js.map