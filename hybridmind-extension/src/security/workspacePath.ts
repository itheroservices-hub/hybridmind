import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Resolves a path from an LLM-generated tool call and confirms it stays
 * inside the open workspace before anything is allowed to read, write, or
 * delete it. Tool-call arguments are untrusted input: an absolute path or a
 * ../ sequence in what looks like a relative path can otherwise reach any
 * file on the machine (SSH keys, credential stores, other projects). Every
 * file-touching tool method should resolve its path through this function
 * rather than calling vscode.Uri.file() on a raw argument directly.
 */
export function resolveWorkspacePath(rawPath: string): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error('No workspace folder open');
  }
  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  const resolved = path.isAbsolute(rawPath)
    ? path.normalize(rawPath)
    : path.normalize(path.join(workspaceRoot, rawPath));

  const relativeToRoot = path.relative(workspaceRoot, resolved);
  const escapesWorkspace =
    relativeToRoot === '' ? false : relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot);

  if (escapesWorkspace) {
    throw new Error(
      `Blocked: '${rawPath}' resolves outside the open workspace (${workspaceRoot}). File operations are only permitted inside the workspace.`
    );
  }

  return resolved;
}

/** Same containment check as resolveWorkspacePath, returning a vscode.Uri directly. */
export function safeFileUri(rawPath: string): vscode.Uri {
  return vscode.Uri.file(resolveWorkspacePath(rawPath));
}
