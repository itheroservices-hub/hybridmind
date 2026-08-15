'use strict';

const licenseValidator = require('./licenseValidator');

/**
 * Resolve a license token into an actor object.
 */
async function resolveActorFromLicense(token) {
  if (!token) return null;

  const validateFn =
    (licenseValidator && licenseValidator.validateLicense) ||
    (licenseValidator && licenseValidator.validate) ||
    (typeof licenseValidator === 'function' ? licenseValidator : null);

  if (typeof validateFn !== 'function') return null;

  // validateLicense is an Express middleware, not a direct function —
  // simulate req/res to extract the tier it would set.
  return new Promise((resolve) => {
    const fakeReq = {
      headers: { 'x-license-key': token },
      header: (name) => name.toLowerCase() === 'x-license-key' ? token : undefined,
      query: {}
    };
    const fakeRes = {};
    const next = () => {
      const tier = String(fakeReq.tier || fakeReq.user?.tier || 'free').toLowerCase();
      const identity = String(fakeReq.user?.licenseKey || token).slice(0, 16);
      resolve({ identity, tier });
    };
    try {
      const result = validateFn(fakeReq, fakeRes, next);
      // If it returns a promise, await it
      if (result && typeof result.then === 'function') {
        result.then(() => {}).catch(() => resolve(null));
      }
    } catch {
      resolve(null);
    }
  });
}

function extractAuthToken(req) {
  const authHeader = String(req.headers.authorization || '').trim();
  const licenseHeader = String(req.headers['x-license-key'] || '').trim();

  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (licenseHeader) return licenseHeader;
  return '';
}

/**
 * Authenticate MCP caller.
 * Requires Bearer token or x-license-key header.
 * ADMIN_SECRET env var grants admin tier.
 */
async function requireMcpAuth(req, res, next) {
  const token = extractAuthToken(req);

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const adminSecret = String(process.env.ADMIN_SECRET || '').trim();
  if (adminSecret && token === adminSecret) {
    req.mcpActor = { identity: 'admin-secret', tier: 'admin' };
    req.tier = 'admin';
    return next();
  }

  const actor = await resolveActorFromLicense(token);
  if (!actor) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  req.mcpActor = actor;
  req.tier = actor.tier;
  return next();
}

/**
 * Require admin or enterprise tier.
 */
async function requireMcpAdmin(req, res, next) {
  return requireMcpAuth(req, res, async () => {
    const token = extractAuthToken(req);
    const adminSecret = String(process.env.ADMIN_SECRET || '').trim();
    const actorTier = String(req.mcpActor?.tier || '').toLowerCase();

    const isAdminSecret = Boolean(adminSecret) && token === adminSecret;
    const isEnterprise = actorTier === 'enterprise';

    if (!isAdminSecret && !isEnterprise) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    return next();
  });
}

module.exports = { requireMcpAuth, requireMcpAdmin };
