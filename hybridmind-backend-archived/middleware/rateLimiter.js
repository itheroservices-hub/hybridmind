// Redis connection: set REDIS_URL env var (e.g., redis://localhost:6379). Falls back to in-memory if unavailable.

const crypto = require('crypto');
let Redis;
try {
  Redis = require('ioredis');
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('Rate limiter: ioredis not installed, Redis-backed rate limiting disabled.');
  Redis = null;
}

// --- In-memory fallback store ---
class InMemoryStore {
  constructor() {
    this.requests = new Map();
    this.costs = new Map();
    this.tokens = new Map();
    this.CLEANUP_INTERVAL = 60000;
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
  }

  _getWindowId(windowMs) {
    return Math.floor(Date.now() / windowMs);
  }

  getKey(req) {
    if (req.user?.licenseKey) {
      return crypto.createHash('sha256').update(req.user.licenseKey).digest('hex').slice(0, 16);
    }
    if (req.user?.id) return req.user.id;
    return req.ip || 'unknown';
  }

  createLimiter({ windowMs, maxRequests, message }) {
    return (req, res, next) => {
      const key = `req:${this.getKey(req)}:${this._getWindowId(windowMs)}`;
      const now = Date.now();
      let info = this.requests.get(key);
      if (!info) {
        info = { count: 1, ts: now };
        this.requests.set(key, info);
      } else {
        info.count += 1;
      }
      if (info.count > maxRequests) {
        return res.status(429).json({ error: message });
      }
      return next();
    };
  }

  createTokenLimiter({ maxTokensPerMonth, message, tier }) {
    return async (req, res, next) => {
      if (tier === 'enterprise') return next();
      const key = `tokens:${this.getKey(req)}:${new Date().getUTCFullYear()}-${new Date().getUTCMonth() + 1}`;
      let info = this.tokens.get(key);
      if (!info) {
        info = { count: 0, month: new Date().getUTCMonth() };
        this.tokens.set(key, info);
      }
      const tokens = typeof req.tokenCost === 'number' ? req.tokenCost : 1;
      info.count += tokens;
      if (info.count > maxTokensPerMonth) {
        return res.status(429).json({ error: message });
      }
      return next();
    };
  }

  createCostLimiter({ maxCostPerDay, message }) {
    return (req, res, next) => {
      const key = `cost:${this.getKey(req)}:${new Date().toISOString().slice(0, 10)}`;
      let info = this.costs.get(key);
      if (!info) {
        info = { cost: 0 };
        this.costs.set(key, info);
      }
      const cost = typeof req.cost === 'number' ? req.cost : 1;
      info.cost += cost;
      if (info.cost > maxCostPerDay) {
        return res.status(429).json({ error: message });
      }
      return next();
    };
  }

  getStats() {
    return {
      requests: this.requests.size,
      tokens: this.tokens.size,
      costs: this.costs.size,
    };
  }

  cleanup() {
    const now = Date.now();
    for (const [key, info] of this.requests.entries()) {
      if (now - info.ts > 3600000) this.requests.delete(key);
    }
    for (const [key] of this.tokens.entries()) {
      const parts = key.split(':');
      if (parts.length >= 3) {
        const ym = parts[2];
        if (ym) {
          const [year, month] = ym.split('-').map(Number);
          const nowDate = new Date();
          if (year !== nowDate.getUTCFullYear() || month !== (nowDate.getUTCMonth() + 1)) {
            this.tokens.delete(key);
          }
        }
      }
    }
    for (const [key] of this.costs.entries()) {
      const parts = key.split(':');
      if (parts.length >= 3) {
        const dateStr = parts[2];
        if (dateStr) {
          const time = new Date(dateStr).getTime();
          if (!isNaN(time) && (now - time > 3 * 86400000)) this.costs.delete(key);
        }
      }
    }
  }
}

// --- Redis-backed store ---
class RedisBackedStore {
  constructor() {
    this.available = false;
    if (!Redis) return;
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, { lazyConnect: true });
    this.redis.connect().then(() => {
      this.available = true;
      // eslint-disable-next-line no-console
      console.info('Rate limiter: Connected to Redis');
    }).catch(() => {
      this.available = false;
      // eslint-disable-next-line no-console
      console.warn('Rate limiter: Redis unavailable, falling back to in-memory');
      if (this.redis) this.redis.disconnect();
    });
  }

  _getWindowId(windowMs) {
    return Math.floor(Date.now() / windowMs);
  }

  getKey(req) {
    if (req.user?.licenseKey) {
      return crypto.createHash('sha256').update(req.user.licenseKey).digest('hex').slice(0, 16);
    }
    if (req.user?.id) return req.user.id;
    return req.ip || 'unknown';
  }

  createLimiter({ windowMs, maxRequests, message }) {
    return async (req, res, next) => {
      if (!this.available) {
        return this.__fallback.createLimiter({ windowMs, maxRequests, message })(req, res, next);
      }
      const key = `hm:rl:req:${this.getKey(req)}:${this._getWindowId(windowMs)}`;
      try {
        const cnt = await this.redis.incr(key);
        if (cnt === 1) await this.redis.expire(key, Math.ceil(windowMs / 1000));
        if (cnt > maxRequests) return res.status(429).json({ error: message });
        return next();
      } catch {
        return this.__fallback.createLimiter({ windowMs, maxRequests, message })(req, res, next);
      }
    };
  }

  createTokenLimiter({ maxTokensPerMonth, message, tier }) {
    return async (req, res, next) => {
      if (tier === 'enterprise') return next();
      if (!this.available) {
        return this.__fallback.createTokenLimiter({ maxTokensPerMonth, message, tier })(req, res, next);
      }
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth() + 1;
      const key = `hm:rl:tokens:${this.getKey(req)}:${year}-${month}`;
      const minScore = new Date(year, month - 1, 1).getTime();
      const maxScore = new Date(year, month, 1).getTime() - 1;
      const tokens = typeof req.tokenCost === 'number' ? req.tokenCost : 1;
      try {
        const ts = Date.now();
        await this.redis.zadd(key, ts, `${ts}:${tokens}`);
        await this.redis.zremrangebyscore(key, 0, minScore - 1);
        const usages = await this.redis.zrangebyscore(key, minScore, maxScore);
        let total = 0;
        for (const entry of usages) {
          const [, val] = entry.split(':');
          total += Number(val) || 0;
        }
        if (total > maxTokensPerMonth) return res.status(429).json({ error: message });
        await this.redis.expire(key, 86400 * 90);
        return next();
      } catch {
        return this.__fallback.createTokenLimiter({ maxTokensPerMonth, message, tier })(req, res, next);
      }
    };
  }

  createCostLimiter({ maxCostPerDay, message }) {
    return async (req, res, next) => {
      if (!this.available) {
        return this.__fallback.createCostLimiter({ maxCostPerDay, message })(req, res, next);
      }
      const dateStr = new Date().toISOString().slice(0, 10);
      const key = `hm:rl:cost:${this.getKey(req)}:${dateStr}`;
      const cost = typeof req.cost === 'number' ? req.cost : 1;
      try {
        const cnt = await this.redis.incrby(key, cost);
        if (cnt === cost) await this.redis.expire(key, 86400 * 3);
        if (cnt > maxCostPerDay) return res.status(429).json({ error: message });
        return next();
      } catch {
        return this.__fallback.createCostLimiter({ maxCostPerDay, message })(req, res, next);
      }
    };
  }

  getStats() {
    return { requests: 0, tokens: 0, costs: 0 };
  }

  cleanup() {
    // Redis handles expiry natively
  }
}

// --- Unified RateLimiter ---
class RateLimiter {
  constructor() {
    this.inMemory = new InMemoryStore();
    if (Redis) {
      this.redisStore = new RedisBackedStore();
      this.redisStore.__fallback = this.inMemory;
    }
    this.active = this.redisStore && this.redisStore.available ? this.redisStore : this.inMemory;
    if (this.redisStore) {
      setInterval(() => {
        this.active = this.redisStore.available ? this.redisStore : this.inMemory;
      }, 3000);
    }
  }

  getKey(req) { return this.active.getKey(req); }
  createLimiter(opts) { return this.active.createLimiter(opts); }
  createTokenLimiter(opts) { return this.active.createTokenLimiter(opts); }
  createCostLimiter(opts) { return this.active.createCostLimiter(opts); }
  getStats() { return this.active.getStats(); }
  cleanup() { return this.active.cleanup(); }
}

// ---- TIER LIMITS ----
const rateLimiter = new RateLimiter();

const burstLimiter = rateLimiter.createLimiter({
  windowMs: 60000,
  maxRequests: 30,
  message: 'Too many requests. Please wait and try again.'
});

const freeTokenLimiter = rateLimiter.createTokenLimiter({
  maxTokensPerMonth: 100000,
  message: 'Free plan monthly token limit exceeded. Upgrade for more usage.',
  tier: 'free'
});

const proTokenLimiter = rateLimiter.createTokenLimiter({
  maxTokensPerMonth: 2000000,
  message: 'Pro plan monthly token limit exceeded.',
  tier: 'pro'
});

const proPlusTokenLimiter = rateLimiter.createTokenLimiter({
  maxTokensPerMonth: 10000000,
  message: 'Pro Plus plan monthly token limit exceeded.',
  tier: 'pro-plus'
});

const enterpriseTokenLimiter = rateLimiter.createTokenLimiter({
  maxTokensPerMonth: 9007199254740991,
  message: '',
  tier: 'enterprise'
});

module.exports = {
  rateLimiter,
  burstLimiter,
  freeTokenLimiter,
  proTokenLimiter,
  proPlusTokenLimiter,
  enterpriseTokenLimiter
};