import * as vscode from 'vscode';
import { CloudAuth } from './cloudAuth';
import { checkCloudProActive } from './cloudSync';
import { LicenseManager } from '../auth/licenseManager';

/** Registers the HybridMind Cloud sign-in/out and upgrade commands. */
export function registerCloudCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.cloudSignIn', async () => {
      const auth = CloudAuth.getInstance();

      if (!auth.isConfigured()) {
        vscode.window.showInformationMessage(
          'HybridMind Cloud is not set up in this build yet. It syncs your chain templates and agent config across machines with a HybridMind Pro subscription.'
        );
        return;
      }

      if (auth.isSignedIn()) {
        const choice = await vscode.window.showInformationMessage(
          `Signed in to HybridMind Cloud as ${auth.getEmail()}.`,
          'Sign Out'
        );
        if (choice === 'Sign Out') {
          await auth.signOut();
          LicenseManager.getInstance().setCloudProActive(false);
          vscode.window.showInformationMessage('Signed out of HybridMind Cloud.');
        }
        return;
      }

      const email = await vscode.window.showInputBox({
        prompt: 'Enter your email to sign in to HybridMind Cloud',
        placeHolder: 'you@example.com',
        validateInput: value => (value && value.includes('@') ? null : 'Enter a valid email address'),
      });
      if (!email) return;

      const sendResult = await auth.sendMagicLink(email);
      if (!sendResult.success) {
        vscode.window.showErrorMessage(`Could not send sign-in code: ${sendResult.error}`);
        return;
      }

      const code = await vscode.window.showInputBox({
        prompt: `Enter the 6-digit code sent to ${email}`,
        placeHolder: '123456',
      });
      if (!code) return;

      const verifyResult = await auth.verifyOtp(email, code);
      if (!verifyResult.success) {
        vscode.window.showErrorMessage(`Sign-in failed: ${verifyResult.error}`);
        return;
      }

      const active = await checkCloudProActive();
      LicenseManager.getInstance().setCloudProActive(active);

      vscode.window.showInformationMessage(
        active
          ? `Signed in as ${email}. HybridMind Pro is active.`
          : `Signed in as ${email}. Templates and config will sync, but Pro isn't active on this account yet.`
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('hybridmind.upgradeToCloudPro', async () => {
      const config = vscode.workspace.getConfiguration('hybridmind');
      const checkoutUrl = config.get<string>('cloudCheckoutUrl');

      if (!checkoutUrl) {
        vscode.window.showInformationMessage(
          'HybridMind Pro checkout isn\'t live yet. See HYBRIDMIND_CLOUD_PRO_PLAN.md for what\'s left to turn this on.'
        );
        return;
      }

      const auth = CloudAuth.getInstance();
      if (!auth.isSignedIn()) {
        vscode.window.showInformationMessage('Sign in to HybridMind Cloud first, then upgrade.');
        await vscode.commands.executeCommand('hybridmind.cloudSignIn');
        return;
      }

      // client_reference_id ties the Checkout Session back to this profile
      // so the webhook (supabase/functions/stripe-webhook) knows which row
      // to update -- see HYBRIDMIND_CLOUD_PRO_PLAN.md, Stripe pattern step 3.
      // Deliberately the user ID, never the access token: a session token
      // in a URL would leak via browser history, logs, and referrer
      // headers, and would hand out live account access to anyone who saw
      // that URL, not just identify which row to update.
      const url = `${checkoutUrl}?client_reference_id=${encodeURIComponent(auth.getUserId() ?? '')}`;
      vscode.env.openExternal(vscode.Uri.parse(url));
    })
  );
}
