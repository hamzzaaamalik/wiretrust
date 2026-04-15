const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

/**
 * Rate limiting middleware — three tiers based on endpoint sensitivity.
 *
 * Strict:   Wallet creation, faucet, challenge claims (5 req / 15 min)
 * Moderate: Mutations — POST/PUT/DELETE on agents, predictions, fantasy (30 req / min)
 * Relaxed:  Read endpoints — matches, health, leaderboard (100 req / min)
 */

function makeKeyGenerator(req) {
  return req.headers["x-wallet-address"] || ipKeyGenerator(req);
}

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
  keyGenerator: makeKeyGenerator,
});

const moderateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
  keyGenerator: makeKeyGenerator,
});

const relaxedLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
  keyGenerator: makeKeyGenerator,
});

module.exports = { strictLimiter, moderateLimiter, relaxedLimiter };
