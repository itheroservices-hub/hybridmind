/**
 * A minimal, mutable stand-in for the 'vscode' module, used for unit
 * testing code that would otherwise only run inside the VS Code extension
 * host. Registered directly into Node's require cache by test/setup.ts
 * before any test file loads, so `import * as vscode from 'vscode'`
 * anywhere in src/ resolves to this instead of failing to find a real
 * 'vscode' package (there isn't one outside the extension host).
 *
 * Call resetVscodeMock() in a beforeEach so call history and configured
 * responses don't leak between tests.
 */

export const sendTextCalls: string[] = [];
export const createTerminalCalls: number[] = [];
export const showWarningMessageCalls: any[][] = [];
export const writeFileCalls: { uri: any; content: any }[] = [];

let approvalChoice: 'Approve' | 'Deny' | undefined = undefined;
let workspaceRoot = 'C:\\fake-workspace';
let hasWorkspace = true;

export function resetVscodeMock(): void {
  sendTextCalls.length = 0;
  createTerminalCalls.length = 0;
  showWarningMessageCalls.length = 0;
  writeFileCalls.length = 0;
  approvalChoice = undefined;
  workspaceRoot = 'C:\\fake-workspace';
  hasWorkspace = true;
}

export function setApprovalChoice(choice: 'Approve' | 'Deny' | undefined): void {
  approvalChoice = choice;
}

export function setWorkspaceRoot(root: string): void {
  workspaceRoot = root;
}

export function setNoWorkspace(): void {
  hasWorkspace = false;
}

const terminal = {
  show: () => {},
  sendText: (command: string) => { sendTextCalls.push(command); },
};

export const window = {
  createTerminal: (_opts: any) => { createTerminalCalls.push(1); return terminal; },
  showWarningMessage: (...args: any[]) => {
    showWarningMessageCalls.push(args);
    return Promise.resolve(approvalChoice);
  },
  showInformationMessage: (..._args: any[]) => Promise.resolve(undefined),
  showErrorMessage: (..._args: any[]) => Promise.resolve(undefined),
  showTextDocument: (..._args: any[]) => Promise.resolve(undefined),
  createOutputChannel: (_name: string) => ({
    appendLine: (_msg: string) => {},
    show: () => {},
    clear: () => {},
  }),
};

export const workspace = {
  get workspaceFolders() {
    return hasWorkspace ? [{ uri: { fsPath: workspaceRoot } }] : undefined;
  },
  getConfiguration: (_section?: string) => ({
    get: (_key: string, defaultValue?: any) => defaultValue,
    update: (_key: string, _value: any, _target?: any) => Promise.resolve(),
  }),
  openTextDocument: (_uri: any) => Promise.resolve({ save: () => Promise.resolve(), getText: () => '', positionAt: (_n: number) => ({}) }),
  applyEdit: (_edit: any) => Promise.resolve(true),
  fs: {
    readFile: (_uri: any) => Promise.resolve(Buffer.from('')),
    writeFile: (uri: any, content: any) => { writeFileCalls.push({ uri, content }); return Promise.resolve(); },
  },
};

export const Uri = {
  file: (p: string) => ({ fsPath: p }),
  joinPath: (base: any, ...segments: string[]) => ({ fsPath: [base.fsPath, ...segments].join('/') }),
};

export class WorkspaceEdit {
  replace(..._args: any[]) {}
  insert(..._args: any[]) {}
  delete(..._args: any[]) {}
  createFile(..._args: any[]) {}
  deleteFile(..._args: any[]) {}
}

export class Range {
  constructor(public a?: any, public b?: any, public c?: any, public d?: any) {}
}

export class Position {
  constructor(public line?: any, public character?: any) {}
}

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

export const languages = {
  getDiagnostics: (..._args: any[]) => [],
};

export const commands = {
  executeCommand: (..._args: any[]) => Promise.resolve(undefined),
};

// Just enough of the tree view API to build and inspect TreeItems.

export class EventEmitter<T> {
  private listeners: Array<(value: T) => void> = [];
  event = (listener: (value: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => { this.listeners = this.listeners.filter((l) => l !== listener); } };
  };
  fire(value: T): void {
    this.listeners.forEach((listener) => listener(value));
  }
  dispose(): void {
    this.listeners = [];
  }
}

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export class TreeItem {
  id?: string;
  description?: string | boolean;
  tooltip?: any;
  iconPath?: any;
  command?: { command: string; title: string; arguments?: any[] };
  contextValue?: string;
  constructor(public label: string, public collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.None) {}
}

export class ThemeIcon {
  constructor(public id: string, public color?: any) {}
}

export class ThemeColor {
  constructor(public id: string) {}
}

export class MarkdownString {
  value = '';
  constructor(value?: string, public supportThemeIcons?: boolean) {
    this.value = value || '';
  }
  appendMarkdown(text: string): this {
    this.value += text;
    return this;
  }
  toString(): string {
    return this.value;
  }
}
