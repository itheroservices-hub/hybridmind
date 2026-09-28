/**
 * Paths that are genuinely absolute on the platform running the tests.
 *
 * The containment check uses Node's native path module, so what counts as
 * absolute depends on the OS. A Windows fixture like C:\Users\someone\.ssh on
 * Linux is a relative filename, which resolves inside the workspace and is
 * correctly allowed, so a test using it there checks nothing and fails for the
 * wrong reason. Picking the fixture per platform means each OS exercises the
 * attack that is actually possible on it.
 */
const WINDOWS = process.platform === 'win32';

export const FAKE_WORKSPACE_ROOT = WINDOWS ? 'C:\\fake-workspace' : '/fake-workspace';

/** An absolute path outside the workspace: the credential file an escape would reach. */
export const OUTSIDE_ABSOLUTE_PATH = WINDOWS ? 'C:\\Users\\someone\\.ssh\\id_rsa' : '/home/someone/.ssh/id_rsa';
