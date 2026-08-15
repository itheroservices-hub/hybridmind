'use strict';

const ALLOWED_COMMANDS = [
  'ls', 'dir', 'cat', 'type', 'pwd', 'echo',
  'node', 'npm', 'npx', 'git', 'python', 'python3', 'pip'
];

// Shell metacharacters and control characters not allowed in any argument
const ARG_METACHAR_PATTERN = /[;&|$`\n\r\u0000\\]/;

/**
 * Simple tokenizer that handles quoted strings (no shell expansion).
 * @param {string} raw
 * @returns {{ tokens: string[], error?: string }}
 */
function tokenizeCommand(raw) {
  const input = String(raw || '').trim();
  if (!input) return { tokens: [], error: 'Empty command' };

  const tokens = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inSingle) {
      if (ch === "'") { inSingle = false; }
      else { current += ch; }
    } else if (inDouble) {
      if (ch === '"') { inDouble = false; }
      else { current += ch; }
    } else if (ch === "'") {
      inSingle = true;
    } else if (ch === '"') {
      inDouble = true;
    } else if (ch === ' ' || ch === '\t') {
      if (current.length > 0) { tokens.push(current); current = ''; }
    } else {
      current += ch;
    }
  }

  if (inSingle || inDouble) {
    return { tokens: [], error: 'Unterminated quote in command' };
  }
  if (current.length > 0) tokens.push(current);

  return { tokens };
}

/**
 * Validate a raw command string against the allowlist.
 * Returns { valid, cmd, args, reason? }
 *
 * @param {string} rawCommand
 * @returns {{ valid: boolean, cmd?: string, args?: string[], reason?: string }}
 */
function validateCommand(rawCommand) {
  const { tokens, error } = tokenizeCommand(rawCommand);

  if (error || tokens.length === 0) {
    return { valid: false, reason: error || 'Empty command' };
  }

  const [cmd, ...args] = tokens;
  const normalizedCmd = cmd.toLowerCase().replace(/\.exe$/i, '');

  if (!ALLOWED_COMMANDS.includes(normalizedCmd)) {
    return { valid: false, reason: `Command '${cmd}' is not in the allowed list` };
  }

  for (const arg of args) {
    if (ARG_METACHAR_PATTERN.test(arg)) {
      return { valid: false, reason: `Argument contains disallowed characters: ${arg}` };
    }
    // Block path traversal
    if (arg.includes('..')) {
      return { valid: false, reason: `Path traversal sequence detected in argument: ${arg}` };
    }
  }

  return { valid: true, cmd: normalizedCmd, args };
}

/**
 * Returns true if the command requires human approval regardless of allowlist validity.
 * @param {string} rawCommand
 * @returns {boolean}
 */
function requiresApprovalByPolicy(rawCommand) {
  const lower = String(rawCommand || '').toLowerCase().trim();
  const policyPatterns = [
    /^git\s+push/,
    /^npm\s+publish/,
    /^npx\s+.*deploy/,
  ];
  return policyPatterns.some(p => p.test(lower));
}

module.exports = { ALLOWED_COMMANDS, validateCommand, requiresApprovalByPolicy };
