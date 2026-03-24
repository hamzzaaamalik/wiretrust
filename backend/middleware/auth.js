/**
 * Auth middleware — validates wallet-based access control.
 *
 * Wallet address is sent via x-wallet-address header.
 * Write operations are signed client-side; this middleware
 * only gates API access to admin/franchise data.
 */

const DEPLOYER_ADDRESS = (process.env.PRIVATE_KEY
  ? (() => {
      const { ethers } = require('ethers');
      return new ethers.Wallet(process.env.PRIVATE_KEY).address.toLowerCase();
    })()
  : ''
);

/** Extract wallet address from request header */
function getWallet(req) {
  const addr = req.headers['x-wallet-address'] || req.query.wallet || '';
  return addr.toLowerCase();
}

/** Require any connected wallet */
function requireWallet(req, res, next) {
  const wallet = getWallet(req);
  if (!wallet || wallet.length !== 42) {
    return res.status(401).json({ error: 'Wallet address required (x-wallet-address header)' });
  }
  req.wallet = wallet;
  next();
}

/** Require super admin (deployer wallet) */
function requireSuperAdmin(req, res, next) {
  const wallet = getWallet(req);
  if (!wallet || wallet !== DEPLOYER_ADDRESS) {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  req.wallet = wallet;
  next();
}

/** Require franchise admin — checks FranchiseRegistry on-chain */
async function requireFranchiseAdmin(req, res, next) {
  const wallet = getWallet(req);
  if (!wallet || wallet.length !== 42) {
    return res.status(401).json({ error: 'Wallet address required' });
  }

  // Super admin can also access franchise routes — resolve their franchise ID
  if (wallet === DEPLOYER_ADDRESS) {
    req.wallet = wallet;
    req.isSuperAdmin = true;
    // Try to find if deployer is also a franchise admin
    try {
      const { contracts } = req.app.locals;
      const [isAdmin, franchiseId] = await contracts.franchiseRegistry.isFranchiseAdmin(wallet);
      if (isAdmin) req.franchiseId = Number(franchiseId);
      else req.franchiseId = 1; // default to franchise 1 for super admin
    } catch {
      req.franchiseId = 1;
    }
    return next();
  }

  try {
    const { contracts } = req.app.locals;
    const [isAdmin, franchiseId] = await contracts.franchiseRegistry.isFranchiseAdmin(wallet);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Franchise admin access required' });
    }
    req.wallet = wallet;
    req.franchiseId = Number(franchiseId);
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to verify franchise admin', details: err.message });
  }
}

module.exports = { getWallet, requireWallet, requireSuperAdmin, requireFranchiseAdmin, DEPLOYER_ADDRESS };
