const router = require("express").Router();

// ── Check if user already claimed a challenge (blockchain-based) ──
async function hasClaimedOnChain(contracts, address, rewardName) {
  try {
    const tokenIds = await contracts.wireTrustNFT.getTokensByOwner(address);
    for (const id of tokenIds) {
      const meta = await contracts.wireTrustNFT.getFullMetadata(id);
      if (meta.name === rewardName) return true;
    }
  } catch (err) { /* non-critical: skip on failure */ }
  return false;
}

// Count total mints of a specific reward name across all tokens
async function countClaimsOnChain(contracts, rewardName) {
  try {
    const total = await contracts.wireTrustNFT.tokenCount();
    let count = 0;
    for (let i = 1; i <= Number(total); i++) {
      try {
        const meta = await contracts.wireTrustNFT.getFullMetadata(i);
        if (meta.name === rewardName) count++;
      } catch (err) { /* non-critical: skip on failure */ }
    }
    return count;
  } catch (err) { /* non-critical: skip on failure */ }
  return 0;
}

// ── Progress checkers ─────────────────────────────────────────
async function getUserProgress(contracts, address, conditionType) {
  const addr = address.toLowerCase();

  switch (conditionType) {
    case "PREDICTIONS_MADE": {
      const stats = await contracts.predictionModule.getUserStats(addr);
      return Number(stats.totalPredictions ?? stats[2] ?? 0);
    }
    case "PREDICTION_STREAK": {
      const stats = await contracts.predictionModule.getUserStats(addr);
      return Number(stats.currentStreak ?? stats[3] ?? 0);
    }
    case "PREDICTION_POINTS": {
      const stats = await contracts.predictionModule.getUserStats(addr);
      return Number(stats.totalPoints ?? stats[0] ?? 0);
    }
    case "CORRECT_PREDICTIONS": {
      const stats = await contracts.predictionModule.getUserStats(addr);
      return Number(stats.totalCorrect ?? stats[1] ?? 0);
    }
    case "FANTASY_JOINS": {
      const count = await contracts.fantasyModule.contestCount();
      let joins = 0;
      for (let i = 1; i <= Number(count); i++) {
        const participants = await contracts.fantasyModule.getContestParticipants(i);
        if (participants.some((a) => a.toLowerCase() === addr)) joins++;
      }
      return joins;
    }
    case "AGENT_CREATED": {
      const ids = await contracts.agentRegistry.getAgentsByOwner(addr);
      return ids.length;
    }
    case "REPUTATION_SCORE": {
      const ids = await contracts.agentRegistry.getAgentsByOwner(addr);
      let best = 0;
      for (const id of ids) {
        const score = await contracts.reputationStore.getScore(id);
        if (Number(score) > best) best = Number(score);
      }
      return best;
    }
    case "NFTS_EARNED": {
      const tokens = await contracts.wireTrustNFT.getTokensByOwner(addr);
      return tokens.length;
    }
    default:
      return 0;
  }
}

// ── GET /challenges/:franchiseId ─────────────────────────────
router.get("/:franchiseId", async (req, res) => {
  try {
    const { contracts, db } = req.app.locals;
    const franchiseId = Number(req.params.franchiseId);
    const address = req.query.address?.toLowerCase() || null;

    const { rows: challenges } = await db.query(
      "SELECT * FROM challenges WHERE franchise_id = $1 AND active = true",
      [franchiseId]
    );

    const result = [];

    for (const ch of challenges) {
      let current = 0;
      let unlocked = false;
      let alreadyClaimed = false;

      if (address) {
        try {
          current = await getUserProgress(contracts, address, ch.condition_type);
        } catch {
          current = 0;
        }
        unlocked = current >= ch.condition_target;
        alreadyClaimed = await hasClaimedOnChain(contracts, address, ch.reward_name);
      }

      const totalClaimed = await countClaimsOnChain(contracts, ch.reward_name);
      const soldOut = ch.max_claims > 0 && totalClaimed >= ch.max_claims;
      const expired = ch.expires_at && Date.now() > new Date(ch.expires_at).getTime();

      result.push({
        id: ch.id,
        name: ch.name,
        description: ch.description,
        category: ch.category,
        condition: {
          type: ch.condition_type,
          target: ch.condition_target,
        },
        reward: {
          name: ch.reward_name,
          description: ch.reward_description,
          category: ch.category,
        },
        maxClaims: ch.max_claims,
        totalClaimed,
        progress: {
          current,
          target: ch.condition_target,
          percentage: Math.min(
            Math.round((current / ch.condition_target) * 100),
            100
          ),
          unlocked,
        },
        alreadyClaimed,
        soldOut,
        expired: !!expired,
        claimable: unlocked && !alreadyClaimed && !soldOut && !expired,
      });
    }

    res.json(result);
  } catch (err) {
    console.error("Get challenges failed:", err.message);
    res.status(500).json({ error: "Failed to get challenges", details: err.message });
  }
});

// ── POST /challenges/claim ───────────────────────────────────
router.post("/claim", async (req, res) => {
  try {
    const { contracts, signer, db } = req.app.locals;
    const { challengeId, address } = req.body;

    if (!challengeId || !address) {
      return res.status(400).json({ error: "challengeId and address required" });
    }
    if (!signer) {
      return res.status(500).json({ error: "Server signer not available" });
    }

    const addr = address.toLowerCase();

    // Load challenge from DB
    const { rows } = await db.query(
      "SELECT * FROM challenges WHERE id = $1 AND active = true",
      [challengeId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Challenge not found" });
    }
    const challenge = rows[0];

    // Check already claimed (blockchain-verified)
    const alreadyClaimed = await hasClaimedOnChain(contracts, addr, challenge.reward_name);
    if (alreadyClaimed) {
      return res.status(400).json({ error: "Already claimed this reward" });
    }

    // Check sold out (blockchain-verified)
    const totalClaimed = await countClaimsOnChain(contracts, challenge.reward_name);
    if (challenge.max_claims > 0 && totalClaimed >= challenge.max_claims) {
      return res.status(400).json({ error: "All rewards have been claimed" });
    }

    // Check expired
    if (challenge.expires_at && Date.now() > new Date(challenge.expires_at).getTime()) {
      return res.status(400).json({ error: "Challenge has expired" });
    }

    // Verify progress on-chain
    const current = await getUserProgress(contracts, addr, challenge.condition_type);
    if (current < challenge.condition_target) {
      return res.status(400).json({
        error: "Target not met",
        current,
        target: challenge.condition_target,
      });
    }

    // Mint the reward NFT using deployer wallet
    const tx = await contracts.wireTrustNFT.mint(
      addr,
      challenge.franchise_id,
      challenge.reward_category,
      challenge.reward_name,
      challenge.reward_description,
      challenge.reward_metadata_uri || "",
      challenge.reward_face_price || 0,
      challenge.reward_event_timestamp || 0
    );
    const receipt = await tx.wait();

    // Record claim in DB
    await db.query(
      `INSERT INTO challenge_claims (challenge_id, address, tx_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (challenge_id, address) DO NOTHING`,
      [challengeId, addr, receipt.hash]
    );

    console.log(`Challenge "${challenge.name}" claimed by ${addr} — tx: ${receipt.hash}`);

    res.json({
      success: true,
      challengeId,
      rewardName: challenge.reward_name,
      category: challenge.category,
      txHash: receipt.hash,
    });
  } catch (err) {
    console.error("Claim challenge failed:", err.message);
    res.status(500).json({ error: "Failed to claim reward", details: err.message });
  }
});

module.exports = router;
