import * as vscode from 'vscode';
import {
  CheckResult,
  RiskTier,
  ScanResult,
  ServerSummary,
  Steward,
  approve,
  check,
  describeFailure,
  loadSteward,
  scan
} from './steward';

/**
 * The MCP Servers view: every MCP server configured on this machine, which
 * ones carry a key in their config file, which ones have been approved, and
 * whether an approved one has changed.
 *
 * Opening the view scans config files and starts nothing. Approve and Check
 * start the server they are run on, and only when the user asks.
 */

export const MCP_VIEW_ID = 'hybridmind.mcpServers';

const CAPTURE_TIMEOUT_MS = 30000;

type Node =
  | { kind: 'server'; server: ServerSummary }
  | { kind: 'site'; server: ServerSummary; client: string; configPath: string; hasInlineCredential: boolean }
  | { kind: 'event'; label: string; detail: string; risk: RiskTier }
  | { kind: 'note'; label: string; detail?: string; icon?: string };

const RISK_ICON: Record<RiskTier, string> = {
  critical: 'error',
  high: 'warning',
  medium: 'info',
  low: 'circle-small'
};

export class McpServersProvider implements vscode.TreeDataProvider<Node> {
  private readonly changed = new vscode.EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this.changed.event;

  private result: ScanResult | null = null;
  private error: string | null = null;
  private scanning: Promise<void> | null = null;
  /** Results of checks run this session, by server id. */
  private readonly checks = new Map<string, CheckResult>();

  constructor(private readonly loadStewardFn: () => Promise<Steward> = loadSteward) {}

  get lastScan(): ScanResult | null {
    return this.result;
  }

  steward(): Promise<Steward> {
    return this.loadStewardFn();
  }

  /** Re-read the config files. Starts no server. */
  refresh(): Promise<void> {
    if (!this.scanning) {
      this.scanning = (async () => {
        try {
          const folders = (vscode.workspace.workspaceFolders || []).map((folder) => folder.uri.fsPath);
          this.result = await scan(await this.loadStewardFn(), undefined, folders);
          this.error = null;
        } catch (error: any) {
          this.error = `Could not read MCP configuration: ${error?.message || error}`;
        } finally {
          this.scanning = null;
          this.changed.fire(undefined);
        }
      })();
    }
    return this.scanning;
  }

  recordCheck(serverId: string, result: CheckResult): void {
    this.checks.set(serverId, result);
    this.changed.fire(undefined);
  }

  forgetCheck(serverId: string): void {
    this.checks.delete(serverId);
  }

  getChildren(node?: Node): Node[] {
    if (!node) {
      if (this.error) {
        return [{ kind: 'note', label: this.error, icon: 'error' }];
      }
      if (!this.result) {
        return [{ kind: 'note', label: 'Looking for MCP servers...', icon: 'loading~spin' }];
      }
      const nodes: Node[] = this.result.servers.map((server) => ({ kind: 'server', server }));
      for (const problem of this.result.problems) {
        nodes.push({ kind: 'note', label: `Could not read a ${problem.client} config file`, detail: `${problem.configPath}\n${problem.reason}`, icon: 'warning' });
      }
      if (!nodes.length) {
        nodes.push({
          kind: 'note',
          label: 'No MCP servers found',
          detail: `Looked in ${this.result.scannedFiles} config file(s) for Claude, VS Code, Cursor and other clients.`,
          icon: 'info'
        });
      }
      return nodes;
    }

    if (node.kind === 'server') {
      const children: Node[] = [];
      const result = this.checks.get(node.server.id);
      if (result?.state === 'changed') {
        for (const event of result.events) {
          children.push({ kind: 'event', label: event.summary, detail: event.riskFactors.join('\n'), risk: event.risk });
        }
      }
      for (const site of node.server.registrations) {
        children.push({ kind: 'site', server: node.server, client: site.clientLabel, configPath: site.configPath, hasInlineCredential: site.hasInlineCredential });
      }
      return children;
    }
    return [];
  }

  getTreeItem(node: Node): vscode.TreeItem {
    switch (node.kind) {
      case 'server': {
        const server = node.server;
        const result = this.checks.get(server.id);
        const hasChildren = server.registrations.length > 0 || result?.state === 'changed';
        const item = new vscode.TreeItem(server.name, hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        item.id = `server:${server.id}`;

        const badges: string[] = [];
        if (result?.state === 'changed') {
          badges.push(`changed since approved (${result.worstRisk})`);
        } else if (result?.state === 'unchanged') {
          badges.push('unchanged');
        } else {
          badges.push(server.approved ? 'approved' : 'not approved');
        }
        if (server.hasInlineCredential) {
          badges.push('key in config file');
        }
        item.description = badges.join(' · ');

        if (result?.state === 'changed' && (result.worstRisk === 'critical' || result.worstRisk === 'high')) {
          item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('problemsWarningIcon.foreground'));
        } else if (server.hasInlineCredential) {
          item.iconPath = new vscode.ThemeIcon('key', new vscode.ThemeColor('problemsWarningIcon.foreground'));
        } else if (result?.state === 'unchanged') {
          item.iconPath = new vscode.ThemeIcon('pass');
        } else {
          item.iconPath = new vscode.ThemeIcon(server.approved ? 'shield' : 'circle-outline');
        }

        const tooltip = new vscode.MarkdownString(undefined, true);
        tooltip.appendMarkdown(`**${escapeMarkdown(server.name)}**\n\n`);
        tooltip.appendMarkdown(`${server.transport === 'http' ? 'Remote server at' : 'Local program'} \`${escapeMarkdown(server.where)}\`\n\n`);
        tooltip.appendMarkdown(`Found in ${server.registrations.length} config file(s).\n\n`);
        if (server.hasInlineCredential) {
          tooltip.appendMarkdown('A key is written directly in a config file. Anyone who can read that file can use it.\n\n');
        }
        if (result?.state === 'changed') {
          tooltip.appendMarkdown(`Its tools changed since you approved them on ${formatDate(result.approvedAt)}. Expand to see what changed. Risk levels are a heuristic, not a verdict.\n\n`);
        } else if (server.approved) {
          tooltip.appendMarkdown('Approved. Use Check for changes to compare it with what you approved.\n\n');
        } else {
          tooltip.appendMarkdown('Not approved yet. Approve records what it advertises now, so later changes can be spotted. Approving starts the server once.\n\n');
        }
        item.tooltip = tooltip;
        item.contextValue = server.approved ? 'mcpServer.approved' : 'mcpServer.unapproved';
        return item;
      }
      case 'site': {
        const item = new vscode.TreeItem(node.client, vscode.TreeItemCollapsibleState.None);
        item.description = node.hasInlineCredential ? 'key written in this file' : node.configPath;
        item.tooltip = node.configPath;
        item.iconPath = new vscode.ThemeIcon(node.hasInlineCredential ? 'key' : 'file');
        item.command = { command: 'hybridmind.mcp.openConfig', title: 'Open config file', arguments: [node.configPath] };
        return item;
      }
      case 'event': {
        const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
        item.description = node.risk;
        item.tooltip = node.detail ? `Why (a heuristic, not a verdict):\n${node.detail}` : undefined;
        item.iconPath = new vscode.ThemeIcon(RISK_ICON[node.risk]);
        return item;
      }
      case 'note': {
        const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
        item.tooltip = node.detail;
        item.iconPath = node.icon ? new vscode.ThemeIcon(node.icon) : undefined;
        return item;
      }
    }
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_{}[\]()#+\-.!|<>]/g, '\\$&');
}

function formatDate(iso?: string): string {
  if (!iso) {
    return 'an earlier date';
  }
  const date = new Date(iso);
  return isNaN(date.getTime()) ? iso : date.toLocaleString();
}

function summarizeCounts(result: CheckResult): string {
  return (['critical', 'high', 'medium', 'low'] as RiskTier[])
    .filter((risk) => result.counts[risk] > 0)
    .map((risk) => `${result.counts[risk]} ${risk}`)
    .join(', ');
}

const WARNED_KEY = 'hybridmind.mcp.warnedInlineCredentials';

/** Registers the MCP Servers view and its commands. */
export function registerMcpServers(context: vscode.ExtensionContext, provider: McpServersProvider = new McpServersProvider()): McpServersProvider {
  const view = vscode.window.createTreeView(MCP_VIEW_ID, { treeDataProvider: provider, showCollapseAll: true });
  context.subscriptions.push(view);

  const refreshAndWarn = async () => {
    await provider.refresh();
    await warnAboutInlineCredentials(context, provider.lastScan);
  };

  // Scanning only reads config files, so it is safe to do whenever the view shows.
  void refreshAndWarn();
  context.subscriptions.push(view.onDidChangeVisibility((event) => {
    if (event.visible) {
      void provider.refresh();
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('hybridmind.mcp.refresh', () => refreshAndWarn()));

  context.subscriptions.push(vscode.commands.registerCommand('hybridmind.mcp.openConfig', async (configPath: string) => {
    if (typeof configPath === 'string' && configPath) {
      await vscode.window.showTextDocument(vscode.Uri.file(configPath), { preview: true });
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('hybridmind.mcp.approve', async (node?: { kind: string; server?: ServerSummary }) => {
    const server = node?.kind === 'server' ? node.server : undefined;
    if (!server) {
      return;
    }
    const choice = await vscode.window.showInformationMessage(
      `Approve ${server.name}?`,
      {
        modal: true,
        detail: `HybridMind will start ${server.name} once to read the tools it advertises, then remember them as approved. Later checks compare against this. Only approve a server you trust as it is today.`
      },
      'Start and approve'
    );
    if (choice !== 'Start and approve') {
      return;
    }
    try {
      const result = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Approving ${server.name}`, cancellable: true },
        async (_progress, token) => {
          const controller = new AbortController();
          token.onCancellationRequested(() => controller.abort());
          return approve(await provider.steward(), server.ref, { signal: controller.signal, timeoutMs: CAPTURE_TIMEOUT_MS });
        }
      );
      provider.forgetCheck(server.id);
      await provider.refresh();
      vscode.window.showInformationMessage(`Approved ${server.name}: ${result.tools} tool(s) and ${result.items} item(s) in all. Use Check for changes to compare against this later.`);
    } catch (error) {
      vscode.window.showErrorMessage(describeFailure(error, server.name));
    }
  }));

  const runCheck = async (server: ServerSummary, signal: AbortSignal): Promise<CheckResult> => {
    const result = await check(await provider.steward(), server.ref, { signal, timeoutMs: CAPTURE_TIMEOUT_MS });
    provider.recordCheck(server.id, result);
    return result;
  };

  context.subscriptions.push(vscode.commands.registerCommand('hybridmind.mcp.check', async (node?: { kind: string; server?: ServerSummary }) => {
    const server = node?.kind === 'server' ? node.server : undefined;
    if (!server) {
      return;
    }
    try {
      const result = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Checking ${server.name} for changes`, cancellable: true },
        async (_progress, token) => {
          const controller = new AbortController();
          token.onCancellationRequested(() => controller.abort());
          return runCheck(server, controller.signal);
        }
      );
      if (result.state === 'not-approved') {
        vscode.window.showInformationMessage(`${server.name} has not been approved yet, so there is nothing to compare against. Approve it first.`);
      } else if (result.state === 'unchanged') {
        vscode.window.showInformationMessage(`${server.name} is unchanged since you approved it on ${formatDate(result.approvedAt)}.`);
      } else {
        const action = await vscode.window.showWarningMessage(
          `${server.name} changed since you approved it: ${summarizeCounts(result)}. Expand it in MCP Servers to see what changed.`,
          'Show',
          'Approve as it is now'
        );
        if (action === 'Show') {
          await vscode.commands.executeCommand(`${MCP_VIEW_ID}.focus`);
        } else if (action === 'Approve as it is now') {
          await vscode.commands.executeCommand('hybridmind.mcp.approve', { kind: 'server', server });
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(describeFailure(error, server.name));
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('hybridmind.mcp.checkAll', async () => {
    await provider.refresh();
    const approved = (provider.lastScan?.servers || []).filter((server) => server.approved);
    if (!approved.length) {
      vscode.window.showInformationMessage('No MCP servers are approved yet. Approve one from the MCP Servers view first.');
      return;
    }
    const changed: string[] = [];
    const failed: string[] = [];
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Checking approved MCP servers', cancellable: true },
      async (progress, token) => {
        const controller = new AbortController();
        token.onCancellationRequested(() => controller.abort());
        for (const [index, server] of approved.entries()) {
          if (token.isCancellationRequested) {
            break;
          }
          progress.report({ message: `${server.name} (${index + 1} of ${approved.length})`, increment: 100 / approved.length });
          try {
            const result = await runCheck(server, controller.signal);
            if (result.state === 'changed') {
              changed.push(`${server.name} (${result.worstRisk})`);
            }
          } catch (error) {
            failed.push(describeFailure(error, server.name));
          }
        }
      }
    );
    if (changed.length) {
      vscode.window.showWarningMessage(`Changed since approved: ${changed.join(', ')}. Expand them in MCP Servers to see what changed.`);
    } else if (!failed.length) {
      vscode.window.showInformationMessage(`All ${approved.length} approved MCP server(s) are unchanged.`);
    }
    if (failed.length) {
      vscode.window.showErrorMessage(`Could not check ${failed.length} server(s). ${failed[0]}`);
    }
  }));

  return provider;
}

/**
 * Say once, not on every start, when servers have keys written into their
 * config files. Remembers which servers it has already mentioned.
 */
async function warnAboutInlineCredentials(context: vscode.ExtensionContext, result: ScanResult | null): Promise<void> {
  if (!result || !result.withInlineCredentials) {
    return;
  }
  const already = new Set<string>(context.globalState.get<string[]>(WARNED_KEY, []));
  const fresh = result.servers.filter((server) => server.hasInlineCredential && !already.has(server.id));
  if (!fresh.length) {
    return;
  }
  await context.globalState.update(WARNED_KEY, [...already, ...fresh.map((server) => server.id)]);
  const names = fresh.slice(0, 3).map((server) => server.name).join(', ') + (fresh.length > 3 ? ` and ${fresh.length - 3} more` : '');
  const action = await vscode.window.showWarningMessage(
    `${fresh.length} MCP server(s) have an API key written directly in a config file: ${names}. Anyone who can read that file can use the key.`,
    'Show'
  );
  if (action === 'Show') {
    await vscode.commands.executeCommand(`${MCP_VIEW_ID}.focus`);
  }
}
