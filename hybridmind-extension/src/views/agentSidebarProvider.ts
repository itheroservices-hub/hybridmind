import * as vscode from 'vscode';
import { AgentConfig, AgentConfigData, AgentSlot } from '../agents/agentConfig';
import { LicenseManager } from '../auth/licenseManager';

export class AgentSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'hybridmind.agentSidebar';
  private _view?: vscode.WebviewView;

  // a minimal catalog of agents; ideally fetched from backend
  private static readonly AGENT_CATALOG: AgentSlot[] = [
    { id: 'strategic-planner', display: 'Strategic Planner' },
    { id: 'constraint-solver', display: 'Constraint Solver' },
    { id: 'research-synthesizer', display: 'Research Synthesizer' },
    { id: 'critical-evaluator', display: 'Critical Evaluator' },
    { id: 'memory-curator', display: 'Memory Curator' },
    { id: 'scenario-simulation', display: 'Scenario Simulation' },
    { id: 'logic-verifier', display: 'Logic & Verification' },
    { id: 'bug-hunter', display: 'Bug-Hunting Agent' },
    { id: 'code-generator', display: 'Code Generation Agent' },
    { id: 'refactoring', display: 'Refactoring Agent' }
  ];

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async msg => {
      switch (msg.command) {
        case 'getConfig': {
          const cfg = AgentConfig.load();
          const license = LicenseManager.getInstance();
          webviewView.webview.postMessage({
            command: 'config',
            data: cfg,
            license: {
              maxSlots: license.maxAgentSlots(),
              allowsTeams: license.allowsTeamCreation()
            }
          });
          break;
        }
        case 'saveConfig': {
          await AgentConfig.save(msg.data);
          break;
        }
        case 'openAgentSlotPicker': {
          this.showAgentPicker();
          break;
        }
        case 'setApiKey': {
          // forward to extension command
          vscode.commands.executeCommand('hybridmind.setApiKey');
          break;
        }
        case 'createTeam': {
          const cfg = AgentConfig.load();
          if (cfg.slots.length === 0) {
            vscode.window.showInformationMessage('No agents available to form a team');
            break;
          }
          const picks = await vscode.window.showQuickPick(
            cfg.slots.map(s => ({ label: s.display, id: s.id })),
            { canPickMany: true, placeHolder: 'Select agents for new team' }
          );
          if (picks && picks.length) {
            const ids = picks.map(p => p.id);
            await AgentConfig.addTeam(ids);
            const newCfg = AgentConfig.load();
            webviewView.webview.postMessage({ command: 'config', data: newCfg });
          }
          break;
        }
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'agentSidebar.css')
    );
    const nonce = getNonce();

    // static catalog of agents (could be fetched from backend later)
    const AGENT_CATALOG = [
      { id: 'strategic-planner', display: 'Strategic Planner', category: 'Cognitive' },
      { id: 'constraint-solver', display: 'Constraint Solver', category: 'Cognitive' },
      { id: 'research-synthesizer', display: 'Research Synthesizer', category: 'Cognitive' },
      { id: 'critical-evaluator', display: 'Critical Evaluator', category: 'Cognitive' },
      { id: 'memory-curator', display: 'Memory Curator', category: 'Cognitive' },
      { id: 'scenario-simulation', display: 'Scenario Simulation', category: 'Cognitive' },
      { id: 'logic-verifier', display: 'Logic & Verification', category: 'Cognitive' },
      { id: 'bug-hunter', display: 'Bug-Hunting Agent', category: 'Developer' },
      { id: 'code-generator', display: 'Code Generation Agent', category: 'Developer' },
      { id: 'refactoring', display: 'Refactoring Agent', category: 'Developer' },
      // ... add more entries from list as desired
    ];

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:;">
<link href="${styleUri}" rel="stylesheet" />
<title>Agent Sync</title>
</head>
<body>
  <h2>Agent Sync</h2>
  <button id="setApiKey" class="small">Set API Key (BYOK)</button>
  <div id="slots" class="slot-container"></div>
  <button id="addSlot" class="primary">+ Add agent</button>
  <hr/>
  <div id="teams" style="display:none;">
    <h3>Your Teams</h3>
    <button id="newTeam" class="primary">New team</button>
    <div id="teamList" class="team-list"></div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('addSlot')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'openAgentSlotPicker' });
    });
    document.getElementById('setApiKey')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'setApiKey' });
    });
    document.getElementById('newTeam')?.addEventListener('click', () => {
      vscode.postMessage({ command: 'createTeam' });
    });

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.command === 'config') {
        renderConfig(msg.data);
      }
    });

    vscode.postMessage({ command: 'getConfig' });

    function renderConfig(msg) {
      const cfg = msg.data;
      const license = msg.license || { maxSlots: 0, allowsTeams: false };

      const slotsDiv = document.getElementById('slots');
      slotsDiv.innerHTML = '';
      cfg.slots.forEach((slot, idx) => {
        const slotEl = document.createElement('div');
        slotEl.className = 'slot';
        slotEl.textContent = slot.display + (slot.config ? ' ⚙️' : '');
        slotEl.addEventListener('click', () => {
          const current = slot.config || '';
          const res = prompt('Workflow notes for ' + slot.display + ':', current);
          if (res !== null) {
            slot.config = res;
            vscode.postMessage({command:'saveConfig', data: cfg});
            renderConfig({data:cfg, license});
          }
        });
        slotsDiv.appendChild(slotEl);
      });

      const addBtn = document.getElementById('addSlot');
      if (cfg.slots.length >= license.maxSlots) {
        addBtn.setAttribute('disabled', 'true');
        addBtn.textContent = 'Limit reached';
      } else {
        addBtn.removeAttribute('disabled');
        addBtn.textContent = '+ Add agent';
      }

      const teamSection = document.getElementById('teams');
      teamSection.style.display = license.allowsTeams ? 'block' : 'none';

      // render teams
      const teamList = document.getElementById('teamList');
      teamList.innerHTML = '';
      cfg.teams.forEach((team, tIdx) => {
        const tDiv = document.createElement('div');
        tDiv.className = 'team';
        tDiv.textContent = team.map(s=>s.display).join(', ');
        teamList.appendChild(tDiv);
      });
    }
  </script>
</body>
</html>`;
  }

  private async showAgentPicker() {
    const agents: AgentSlot[] = AgentSidebarProvider.AGENT_CATALOG;

    const pick = await vscode.window.showQuickPick(
      agents.map(a => ({ label: a.display, id: a.id })),
      { placeHolder: 'Select an agent to add' }
    );
    if (!pick || !this._view) return;

    const cfg = AgentConfig.load();
    const license = LicenseManager.getInstance();
    if (cfg.slots.length >= license.maxAgentSlots()) {
      vscode.window.showInformationMessage('You have reached your agent slot limit. Upgrade to add more.');
      return;
    }

    cfg.slots.push({ id: pick.id, display: pick.label });
    await AgentConfig.save(cfg);
    this._view.webview.postMessage({ command: 'config', data: cfg });
  }
}

/**
 * Generate a random nonce for CSP
 */
function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
