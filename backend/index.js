require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { WebSocketServer } = require("ws");
const { ethers } = require("ethers");
const path = require("path");
const fs = require("fs");
const db = require("./db");

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});

const { strictLimiter, moderateLimiter, relaxedLimiter } = require("./middleware/rateLimiter");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());

// CORS — restrict to known frontend origins (configurable via CORS_ORIGINS env)
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"];
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.use(express.json());

// CSRF protection — require X-Requested-With header on all mutation requests.
// Browsers block cross-origin custom headers by default, preventing CSRF attacks.
app.use((req, res, next) => {
  if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
    if (!req.headers["x-requested-with"]) {
      return res.status(403).json({ error: "Missing X-Requested-With header" });
    }
  }
  next();
});

// ---------------------------------------------------------------------------
// Blockchain setup
// ---------------------------------------------------------------------------

const RPC_URL = process.env.WIREFLUID_RPC || process.env.RPC_URL || "https://evm.wirefluid.com";
const RPC_FALLBACK = process.env.WIREFLUID_RPC_FALLBACK || null;
const WIREFLUID_CHAIN_ID = 92533;

const networkConfig = { name: "wirefluid", chainId: WIREFLUID_CHAIN_ID };
let provider;
if (RPC_FALLBACK && RPC_FALLBACK !== RPC_URL) {
  // Two different RPCs: use FallbackProvider (auto-switches on failure)
  provider = new ethers.FallbackProvider([
    { provider: new ethers.JsonRpcProvider(RPC_URL, networkConfig), priority: 1, stallTimeout: 5000 },
    { provider: new ethers.JsonRpcProvider(RPC_FALLBACK, networkConfig), priority: 2, stallTimeout: 10000 },
  ], { quorum: 1 });
  console.log(`  RPC: primary ${RPC_URL} + fallback ${RPC_FALLBACK}`);
} else {
  provider = new ethers.JsonRpcProvider(RPC_URL, networkConfig);
}

const addressesPath = path.resolve(__dirname, "..", "deployed-addresses.json");
const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf-8"));

const artifactsDir = path.resolve(__dirname, "..", "artifacts", "contracts");

function loadABI(subpath) {
  const full = path.join(artifactsDir, subpath);
  const artifact = JSON.parse(fs.readFileSync(full, "utf-8"));
  return artifact.abi;
}

const abis = {
  FranchiseRegistry: loadABI("core/FranchiseRegistry.sol/FranchiseRegistry.json"),
  MatchOracle: loadABI("oracle/MatchOracle.sol/MatchOracle.json"),
  AgentRegistry: loadABI("core/AgentRegistry.sol/AgentRegistry.json"),
  ReputationStore: loadABI("core/ReputationStore.sol/ReputationStore.json"),
  PolicyEngine: loadABI("core/PolicyEngine.sol/PolicyEngine.json"),
  ExecutionGateway: loadABI("core/ExecutionGateway.sol/ExecutionGateway.json"),
  FantasyModule: loadABI("modules/FantasyModule.sol/FantasyModule.json"),
  PredictionModule: loadABI("modules/PredictionModule.sol/PredictionModule.json"),
  WireTrustNFT: loadABI("modules/WireTrustNFT.sol/WireTrustNFT.json"),
};

// TESTNET ONLY: Private key read from env for WireFluid testnet deployer.
// In production, use a hardware wallet, KMS, or vault-based signer.
let signer = null;
if (process.env.PRIVATE_KEY) {
  signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
} else {
  console.warn("PRIVATE_KEY not set — signer unavailable, read-only mode");
}

const signerOrProvider = signer || provider;

const contracts = {
  franchiseRegistry: new ethers.Contract(addresses.franchiseRegistry, abis.FranchiseRegistry, signerOrProvider),
  matchOracle: new ethers.Contract(addresses.matchOracle, abis.MatchOracle, signerOrProvider),
  agentRegistry: new ethers.Contract(addresses.agentRegistry, abis.AgentRegistry, signerOrProvider),
  reputationStore: new ethers.Contract(addresses.reputationStore, abis.ReputationStore, signerOrProvider),
  policyEngine: new ethers.Contract(addresses.policyEngine, abis.PolicyEngine, signerOrProvider),
  executionGateway: new ethers.Contract(addresses.executionGateway, abis.ExecutionGateway, signerOrProvider),
  fantasyModule: new ethers.Contract(addresses.fantasyModule, abis.FantasyModule, signerOrProvider),
  predictionModule: new ethers.Contract(addresses.predictionModule, abis.PredictionModule, signerOrProvider),
  wireTrustNFT: new ethers.Contract(addresses.wireTrustNFT, abis.WireTrustNFT, signerOrProvider),
};

// ---------------------------------------------------------------------------
// Populate app.locals so route modules can access shared instances
// ---------------------------------------------------------------------------

app.locals.provider = provider;
app.locals.signer = signer;
app.locals.addresses = addresses;
app.locals.contracts = contracts;
app.locals.db = db;

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use("/api/auth", strictLimiter, require("./routes/auth"));
app.use("/api/franchise", relaxedLimiter, require("./routes/franchise"));
app.use("/api/agents", relaxedLimiter, require("./routes/agents"));
app.use("/api/agents/auto", moderateLimiter, require("./routes/agentAuto"));
app.use("/api/fantasy", moderateLimiter, require("./routes/fantasy"));
app.use("/api/predictions", moderateLimiter, require("./routes/predictions"));
app.use("/api/nfts", moderateLimiter, require("./routes/nfts"));
app.use("/api/challenges", moderateLimiter, require("./routes/challenges"));
app.use("/api/matches", relaxedLimiter, require("./routes/matches"));
app.use("/api/health", relaxedLimiter, require("./routes/health"));
app.use("/api/admin", moderateLimiter, require("./routes/admin"));
app.use("/api/franchise-portal", relaxedLimiter, require("./routes/franchise-portal"));

// 404 handler for unknown API routes
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler — catches unhandled errors from any route
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// ---------------------------------------------------------------------------
// HTTP + WebSocket server
// ---------------------------------------------------------------------------

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });
});

const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30_000);

function broadcast(event, data) {
  const message = JSON.stringify({ event, data, ts: Date.now() });
  wss.clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) ws.send(message);
  });
}

const { setupWSRelay } = require("./services/wsRelay");
const matchSync = require("./services/matchSync");
const agentRunner = require("./services/agentRunner");
// Set up event relay after contracts are initialized
if (addresses && Object.keys(contracts).length > 0) {
  setupWSRelay(wss, provider, addresses, abis);
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

function shutdown(signal) {
  console.log(`\n${signal} received — shutting down`);
  clearInterval(heartbeat);
  matchSync.stopCrons();
  wss.clients.forEach((ws) => ws.terminate());
  const shutdownTimeout = setTimeout(() => process.exit(1), 5000);
  server.close(() => {
    clearTimeout(shutdownTimeout);
    console.log("Server closed");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

server.listen(PORT, async () => {
  console.log(`WireTrust API server listening on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`RPC provider: ${RPC_URL} (chain ${WIREFLUID_CHAIN_ID})`);
  console.log(`Signer: ${signer ? signer.address : "none (read-only)"}`);
  await db.testConnection();

  // Start Sportmonks Cricket API sync crons
  if (process.env.SPORTMONKS_KEY) {
    matchSync.init(db, contracts, addresses);
    matchSync.startCrons();
  } else {
    console.log("  SPORTMONKS_KEY not set — match sync disabled");
  }

  // Resume previously running agents from DB
  agentRunner.resumeAgents(contracts, addresses, db).catch((err) =>
    console.warn("[startup] Agent resume failed:", err.message)
  );

  // Pre-train ML model in background on startup
  const mlEngine = require("./services/mlEngine");
  mlEngine.pretrainModel(db).then((result) => {
    if (result) console.log(`  ML model pre-trained: ${result.samples} samples, ${result.accuracy}% accuracy`);
    else console.log("  ML model: not enough data to train (need 10+ completed matches)");
  }).catch((err) => console.warn("[startup] ML pre-train failed:", err.message));
});

// ---------------------------------------------------------------------------
// Exports for use by route modules
// ---------------------------------------------------------------------------

module.exports = { app, server, wss, provider, signer, addresses, contracts, broadcast };
