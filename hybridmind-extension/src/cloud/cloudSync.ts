import * as vscode from 'vscode';
import { CloudAuth } from './cloudAuth';

/**
 * The actual product being sold: chain/workflow templates and agent
 * configuration follow the signed-in user across machines, instead of
 * being lost on reinstall or stuck on whichever machine they were created
 * on. Deliberately does NOT sync BYOK provider keys -- those stay local in
 * SecretStorage, see licenseManager.ts and HYBRIDMIND_CLOUD_PRO_PLAN.md for
 * why that line isn't crossed even though it would be technically easy to.
 */
export class CloudSync {
  private static instance: CloudSync;
  private constructor() {}

  public static getInstance(): CloudSync {
    if (!CloudSync.instance) {
      CloudSync.instance = new CloudSync();
    }
    return CloudSync.instance;
  }

  private requireSignedInClient() {
    const auth = CloudAuth.getInstance();
    if (!auth.isSignedIn()) return null;
    return auth.getSupabaseClient();
  }

  async pushChainTemplate(name: string, templateJson: unknown): Promise<{ success: boolean; error?: string }> {
    const client = this.requireSignedInClient();
    if (!client) return { success: false, error: 'Not signed in to HybridMind Cloud.' };

    const { data: userData } = await client.auth.getUser();
    if (!userData?.user) return { success: false, error: 'Session expired, please sign in again.' };

    const { error } = await client.from('synced_chain_templates').upsert({
      profile_id: userData.user.id,
      name,
      template_json: templateJson,
      updated_at: new Date().toISOString(),
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  async pullChainTemplates(): Promise<{ success: boolean; templates?: Array<{ name: string; templateJson: unknown }>; error?: string }> {
    const client = this.requireSignedInClient();
    if (!client) return { success: false, error: 'Not signed in to HybridMind Cloud.' };

    const { data, error } = await client
      .from('synced_chain_templates')
      .select('name, template_json')
      .order('updated_at', { ascending: false });

    if (error) return { success: false, error: error.message };
    return {
      success: true,
      templates: (data ?? []).map(row => ({ name: row.name, templateJson: row.template_json })),
    };
  }

  async pushAgentConfig(configJson: unknown): Promise<{ success: boolean; error?: string }> {
    const client = this.requireSignedInClient();
    if (!client) return { success: false, error: 'Not signed in to HybridMind Cloud.' };

    const { data: userData } = await client.auth.getUser();
    if (!userData?.user) return { success: false, error: 'Session expired, please sign in again.' };

    const { error } = await client.from('synced_agent_configs').upsert({
      profile_id: userData.user.id,
      config_json: configJson,
      updated_at: new Date().toISOString(),
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  async pullAgentConfig(): Promise<{ success: boolean; configJson?: unknown; error?: string }> {
    const client = this.requireSignedInClient();
    if (!client) return { success: false, error: 'Not signed in to HybridMind Cloud.' };

    const { data: userData } = await client.auth.getUser();
    if (!userData?.user) return { success: false, error: 'Session expired, please sign in again.' };

    const { data, error } = await client
      .from('synced_agent_configs')
      .select('config_json')
      .eq('profile_id', userData.user.id)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    return { success: true, configJson: data?.config_json };
  }
}

/** Checks Cloud Pro subscription status via the check-subscription Edge
 * Function. This is the real source of truth (see plan doc) -- nothing
 * about Pro status is ever decided client-side. Returns false (not an
 * error) if Cloud isn't configured or the user isn't signed in, since Pro
 * status defaults to inactive in both cases, not an exceptional state. */
export async function checkCloudProActive(): Promise<boolean> {
  const auth = CloudAuth.getInstance();
  if (!auth.isSignedIn()) return false;

  const config = vscode.workspace.getConfiguration('hybridmind');
  const url = config.get<string>('cloudUrl');
  if (!url) return false;

  try {
    const response = await fetch(`${url}/functions/v1/check-subscription`, {
      headers: { Authorization: `Bearer ${auth.getAccessToken()}` },
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { active?: boolean };
    return data.active === true;
  } catch (e) {
    console.error('HybridMind Cloud: subscription check failed', e);
    return false;
  }
}
