import * as vscode from 'vscode';

export interface AgentSlot {
  id: string;
  display: string;
  config?: any;
}

export interface AgentConfigData {
  slots: AgentSlot[];
  teams: AgentSlot[][];
}

/**
 * Helper for persisting agent configuration in workspace settings.
 */
export class AgentConfig {
  private static readonly key = 'hybridmind.agentConfig';

  static load(): AgentConfigData {
    const cfg = vscode.workspace.getConfiguration().get<AgentConfigData>(this.key);
    if (cfg) {
      return cfg;
    }
    return { slots: [], teams: [] };
  }

  static save(cfg: AgentConfigData) {
    return vscode.workspace.getConfiguration().update(this.key, cfg, true);
  }

  static addSlot(slot: AgentSlot) {
    const cfg = AgentConfig.load();
    cfg.slots.push(slot);
    return AgentConfig.save(cfg);
  }

  static removeSlot(index: number) {
    const cfg = AgentConfig.load();
    cfg.slots.splice(index, 1);
    return AgentConfig.save(cfg);
  }

  static addTeam(agentIds: string[]) {
    const cfg = AgentConfig.load();
    // convert to slots based on existing slots
    const slots = cfg.slots.filter(s => agentIds.includes(s.id));
    cfg.teams.push(slots);
    return AgentConfig.save(cfg);
  }

  static removeTeam(index: number) {
    const cfg = AgentConfig.load();
    cfg.teams.splice(index, 1);
    return AgentConfig.save(cfg);
  }
}