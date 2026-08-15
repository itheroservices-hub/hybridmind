import * as vscode from 'vscode';
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';

// Filled in once the Supabase project from HYBRIDMIND_CLOUD_PRO_PLAN.md is
// actually provisioned (get_project_url / get_publishable_keys). The anon
// key is safe to ship in the extension -- it's meant to be public, RLS is
// what actually protects data, matching every other IThero product's
// client-side Supabase usage.
const CLOUD_URL_SETTING = 'hybridmind.cloudUrl';
const CLOUD_ANON_KEY_SETTING = 'hybridmind.cloudAnonKey';

const SECRET_SESSION = 'hybridmind.secrets.cloudSession';

/**
 * HybridMind Cloud account: magic-link sign-in and session persistence.
 * Deliberately separate from LicenseManager's BYOK provider-key handling --
 * this manages the user's *IThero account* identity (for sync + Cloud Pro
 * subscription status), never a BYOK provider key. The two must not mix:
 * a provider key never leaves the user's machine, but a Cloud Pro session
 * genuinely does talk to IThero's own backend, because that's the whole
 * point of Cloud Pro.
 */
export class CloudAuth {
  private static instance: CloudAuth;
  private client: SupabaseClient | null = null;
  private context: vscode.ExtensionContext | null = null;
  private session: Session | null = null;

  private constructor() {}

  public static getInstance(context?: vscode.ExtensionContext): CloudAuth {
    if (!CloudAuth.instance) {
      CloudAuth.instance = new CloudAuth();
    }
    if (context && !CloudAuth.instance.context) {
      CloudAuth.instance.context = context;
    }
    return CloudAuth.instance;
  }

  private getClient(): SupabaseClient | null {
    if (this.client) return this.client;

    const config = vscode.workspace.getConfiguration('hybridmind');
    const url = config.get<string>('cloudUrl');
    const anonKey = config.get<string>('cloudAnonKey');

    if (!url || !anonKey) {
      // Not configured yet -- the Supabase project from the plan hasn't
      // been provisioned/wired in. Cloud features silently no-op rather
      // than error, since Cloud Pro is optional and BYOK use must keep
      // working with zero configuration either way.
      return null;
    }

    // createClient() throws synchronously on a malformed URL (e.g. a typo
    // in hybridmind.cloudUrl), not just when the setting is empty. Cloud Pro
    // must stay additive even for a misconfigured value, not just a missing
    // one -- an uncaught throw here would propagate out of initialize() and
    // fail activate() for BYOK users too, which is exactly what this whole
    // module is designed never to do.
    try {
      this.client = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false } // handled manually below via SecretStorage
      });
    } catch (e) {
      console.error('HybridMind Cloud: invalid cloud configuration, Cloud Pro disabled', e);
      return null;
    }
    return this.client;
  }

  /** Restore a previously-saved session, if any. Call once during activate().
   * Wrapped in a single try/catch end-to-end (not just around JSON.parse/
   * setSession) so a SecretStorage read failure (seen in the wild on some
   * Linux setups without a keyring backend) can't propagate out of
   * activate() and break BYOK for a user who never even touched Cloud Pro. */
  async initialize(): Promise<void> {
    if (!this.context) return;
    try {
      const stored = await this.context.secrets.get(SECRET_SESSION);
      if (!stored) return;

      const client = this.getClient();
      if (!client) return;

      const parsed: Session = JSON.parse(stored);
      const { data, error } = await client.auth.setSession({
        access_token: parsed.access_token,
        refresh_token: parsed.refresh_token,
      });
      if (!error && data.session) {
        this.session = data.session;
      }
    } catch (e) {
      console.error('HybridMind Cloud: failed to restore session', e);
    }
  }

  isSignedIn(): boolean {
    return this.session !== null;
  }

  isConfigured(): boolean {
    return this.getClient() !== null;
  }

  getAccessToken(): string | null {
    return this.session?.access_token ?? null;
  }

  getEmail(): string | null {
    return this.session?.user?.email ?? null;
  }

  /** The Supabase user/profile ID -- not a secret, safe to pass around (e.g.
   * as Stripe Checkout's client_reference_id) unlike the access token. */
  getUserId(): string | null {
    return this.session?.user?.id ?? null;
  }

  /**
   * Sends a magic link to the given email. Matches IThero's stated
   * preference for a blue-collar, tech-skeptical audience: no third-party
   * OAuth app to trust, just a link in their inbox.
   */
  async sendMagicLink(email: string): Promise<{ success: boolean; error?: string }> {
    const client = this.getClient();
    if (!client) {
      return { success: false, error: 'HybridMind Cloud is not configured yet.' };
    }

    const { error } = await client.auth.signInWithOtp({ email });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  /**
   * Completes sign-in once the user has the OTP/magic-link code (Supabase
   * can deliver either a clickable link or a 6-digit code via email;
   * the extension uses the code since a VS Code webview can't easily
   * intercept a deep-link redirect the way a mobile app can).
   */
  async verifyOtp(email: string, token: string): Promise<{ success: boolean; error?: string }> {
    const client = this.getClient();
    if (!client) {
      return { success: false, error: 'HybridMind Cloud is not configured yet.' };
    }

    const { data, error } = await client.auth.verifyOtp({ email, token, type: 'email' });
    if (error || !data.session) {
      return { success: false, error: error?.message ?? 'Sign-in failed.' };
    }

    this.session = data.session;
    if (this.context) {
      await this.context.secrets.store(SECRET_SESSION, JSON.stringify(data.session));
    }
    return { success: true };
  }

  async signOut(): Promise<void> {
    const client = this.getClient();
    if (client) {
      await client.auth.signOut();
    }
    this.session = null;
    if (this.context) {
      await this.context.secrets.delete(SECRET_SESSION);
    }
  }

  /** Exposed for cloudSync.ts to make authenticated table reads/writes. */
  getSupabaseClient(): SupabaseClient | null {
    return this.getClient();
  }
}
