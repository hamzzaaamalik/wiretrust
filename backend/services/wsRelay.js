const { ethers } = require("ethers");

// Known on-chain events that this relay broadcasts
const KNOWN_EVENTS = new Set([
  "AgentExecuted", "AgentViolation",
  "ContestFinalized", "SquadJoined",
  "PredictionResolved", "StreakAchieved",
  "NFTMinted",
]);

/**
 * Broadcasts a JSON message to every connected WebSocket client.
 * Validates event name and data shape before sending.
 *
 * @param {import("ws").WebSocketServer} wss
 * @param {string} event
 * @param {object} data
 * @param {string} [txHash]
 */
function broadcast(wss, event, data, txHash) {
  // Validate event name and data shape
  if (!KNOWN_EVENTS.has(event)) {
    console.warn(`wsRelay: skipping unknown event "${event}"`);
    return;
  }
  if (typeof data !== "object" || data === null) {
    console.warn(`wsRelay: skipping invalid data for event "${event}"`);
    return;
  }

  const message = JSON.stringify({
    event,
    data,
    timestamp: Date.now(),
    txHash: txHash || null,
  });

  wss.clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  });
}

/**
 * Extracts named args from an ethers v6 event log, filtering out positional indices.
 *
 * @param {import("ethers").EventLog} log
 * @param {import("ethers").Interface} iface
 * @returns {object}
 */
function parseEventArgs(log, iface) {
  try {
    const parsed = iface.parseLog({ topics: log.topics, data: log.data });
    if (!parsed) return {};

    const result = {};
    parsed.fragment.inputs.forEach((input, i) => {
      const val = parsed.args[i];
      // Convert BigInt values to strings for JSON serialisation
      result[input.name] = typeof val === "bigint" ? val.toString() : val;
    });
    return result;
  } catch {
    return {};
  }
}

/**
 * Sets up on-chain event listeners and relays them to all connected WS clients.
 *
 * @param {import("ws").WebSocketServer} wss
 * @param {import("ethers").JsonRpcProvider} provider
 * @param {object} contractAddresses - { executionGateway, fantasyModule, predictionModule, wireTrustNFT }
 * @param {object} abis              - { ExecutionGateway, FantasyModule, PredictionModule, WireTrustNFT }
 */
function setupWSRelay(wss, provider, contractAddresses, abis) {
  // --- ExecutionGateway events ---
  const gateway = new ethers.Contract(contractAddresses.executionGateway, abis.ExecutionGateway, provider);
  const gatewayIface = gateway.interface;

  gateway.on("AgentExecuted", (...args) => {
    try {
      const log = args[args.length - 1]; // last arg is the event log
      const data = parseEventArgs(log, gatewayIface);
      broadcast(wss, "AgentExecuted", data, log.log?.transactionHash || log.transactionHash);
    } catch (err) {
      console.error("wsRelay: AgentExecuted handler error:", err.message);
    }
  });

  gateway.on("AgentViolation", (...args) => {
    try {
      const log = args[args.length - 1];
      const data = parseEventArgs(log, gatewayIface);
      broadcast(wss, "AgentViolation", data, log.log?.transactionHash || log.transactionHash);
    } catch (err) {
      console.error("wsRelay: AgentViolation handler error:", err.message);
    }
  });

  // --- FantasyModule events ---
  const fantasy = new ethers.Contract(contractAddresses.fantasyModule, abis.FantasyModule, provider);
  const fantasyIface = fantasy.interface;

  fantasy.on("ContestFinalized", (...args) => {
    try {
      const log = args[args.length - 1];
      const data = parseEventArgs(log, fantasyIface);
      broadcast(wss, "ContestFinalized", data, log.log?.transactionHash || log.transactionHash);
    } catch (err) {
      console.error("wsRelay: ContestFinalized handler error:", err.message);
    }
  });

  fantasy.on("SquadJoined", (...args) => {
    try {
      const log = args[args.length - 1];
      const data = parseEventArgs(log, fantasyIface);
      broadcast(wss, "SquadJoined", data, log.log?.transactionHash || log.transactionHash);
    } catch (err) {
      console.error("wsRelay: SquadJoined handler error:", err.message);
    }
  });

  // --- PredictionModule events ---
  const prediction = new ethers.Contract(contractAddresses.predictionModule, abis.PredictionModule, provider);
  const predictionIface = prediction.interface;

  prediction.on("PredictionResolved", (...args) => {
    try {
      const log = args[args.length - 1];
      const data = parseEventArgs(log, predictionIface);
      broadcast(wss, "PredictionResolved", data, log.log?.transactionHash || log.transactionHash);
    } catch (err) {
      console.error("wsRelay: PredictionResolved handler error:", err.message);
    }
  });

  prediction.on("StreakAchieved", (...args) => {
    try {
      const log = args[args.length - 1];
      const data = parseEventArgs(log, predictionIface);
      broadcast(wss, "StreakAchieved", data, log.log?.transactionHash || log.transactionHash);
    } catch (err) {
      console.error("wsRelay: StreakAchieved handler error:", err.message);
    }
  });

  // --- WireTrustNFT events ---
  const nft = new ethers.Contract(contractAddresses.wireTrustNFT, abis.WireTrustNFT, provider);
  const nftIface = nft.interface;

  nft.on("NFTMinted", (...args) => {
    try {
      const log = args[args.length - 1];
      const data = parseEventArgs(log, nftIface);
      broadcast(wss, "NFTMinted", data, log.log?.transactionHash || log.transactionHash);
    } catch (err) {
      console.error("wsRelay: NFTMinted handler error:", err.message);
    }
  });

  // --- Connection logging ---
  wss.on("connection", (ws, req) => {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    console.log(`WS client connected (${ip}), total: ${wss.clients.size}`);

    ws.on("close", () => {
      console.log(`WS client disconnected (${ip}), total: ${wss.clients.size}`);
    });

    ws.on("error", (err) => {
      console.error(`WS client error (${ip}):`, err.message);
    });
  });

  // --- Provider error handling ---
  provider.on("error", (err) => {
    console.error("Provider error in wsRelay:", err.message);
  });

  console.log("wsRelay: event listeners attached to on-chain contracts");

  // Return cleanup function to remove all event listeners
  return function teardown() {
    gateway.removeAllListeners();
    fantasy.removeAllListeners();
    prediction.removeAllListeners();
    nft.removeAllListeners();
    provider.removeListener("error", () => {});
    console.log("wsRelay: event listeners removed");
  };
}

module.exports = { setupWSRelay };
