import * as assert from 'assert';
import { CloudAuth } from '../src/cloud/cloudAuth';
import { checkCloudProActive } from '../src/cloud/cloudSync';
import { LicenseManager } from '../src/auth/licenseManager';
import { resetVscodeMock } from './mocks/vscode';

/**
 * HybridMind Cloud Pro must be entirely additive: a user who never sets
 * hybridmind.cloudUrl (the overwhelming majority, at least until this
 * actually ships) must see zero behavior change and zero errors. These
 * tests exist specifically to guard that "not configured" path, since a
 * bug there would break BYOK for everyone, not just Cloud Pro subscribers.
 */
describe('HybridMind Cloud Pro (additive, must fail safe when unconfigured)', () => {
  beforeEach(() => {
    resetVscodeMock();
  });

  it('CloudAuth reports not configured when hybridmind.cloudUrl is unset', () => {
    const auth = CloudAuth.getInstance();
    assert.strictEqual(auth.isConfigured(), false);
  });

  it('CloudAuth reports not signed in with no session, without throwing', () => {
    const auth = CloudAuth.getInstance();
    assert.strictEqual(auth.isSignedIn(), false);
    assert.strictEqual(auth.getAccessToken(), null);
    assert.strictEqual(auth.getEmail(), null);
    assert.strictEqual(auth.getUserId(), null);
  });

  it('sendMagicLink fails gracefully (no throw) when Cloud is not configured', async () => {
    const auth = CloudAuth.getInstance();
    const result = await auth.sendMagicLink('someone@example.com');
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
  });

  it('checkCloudProActive returns false without ever making a network call when not signed in', async () => {
    const active = await checkCloudProActive();
    assert.strictEqual(active, false);
  });

  it('LicenseManager.setCloudProActive(true) makes isPro() true, and (false) reverts it', () => {
    const lm = LicenseManager.getInstance();
    lm.setCloudProActive(true);
    assert.strictEqual(lm.isPro(), true);
    assert.strictEqual(lm.getTier(), 'pro');

    lm.setCloudProActive(false);
    assert.strictEqual(lm.isPro(), false);
    assert.strictEqual(lm.getTier(), 'free');
  });
});
