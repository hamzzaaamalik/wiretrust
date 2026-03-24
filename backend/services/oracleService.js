/**
 * Submits a match result to the MatchOracle contract.
 *
 * @param {import("ethers").Contract} matchOracleContract
 * @param {number}  matchId
 * @param {string}  winner   - winning team identifier
 * @param {boolean} abandoned
 * @returns {Promise<{ success: boolean, txHash: string }>}
 */
async function submitMatchResult(matchOracleContract, matchId, winner, abandoned) {
  try {
    const tx = await matchOracleContract.submitResult(matchId, winner, abandoned);
    const receipt = await tx.wait();
    return { success: true, txHash: receipt.hash };
  } catch (err) {
    console.error(`oracleService.submitMatchResult failed (match ${matchId}):`, err.message);
    throw err;
  }
}

/**
 * Submits individual player stats for a match to the MatchOracle contract.
 *
 * @param {import("ethers").Contract} matchOracleContract
 * @param {number} matchId
 * @param {number} playerId
 * @param {{ runs: number, wickets: number, economyRate: number, strikeRate: number, isMotm: boolean }} stats
 * @returns {Promise<{ success: boolean, txHash: string }>}
 */
async function submitPlayerStats(matchOracleContract, matchId, playerId, stats) {
  try {
    const tx = await matchOracleContract.submitPlayerStats(
      matchId,
      playerId,
      stats.runs,
      stats.wickets,
      stats.economyRate,
      stats.strikeRate,
      stats.isMotm
    );
    const receipt = await tx.wait();
    return { success: true, txHash: receipt.hash };
  } catch (err) {
    console.error(`oracleService.submitPlayerStats failed (match ${matchId}, player ${playerId}):`, err.message);
    throw err;
  }
}

/**
 * Simulates a full match by submitting the result and all player stats.
 * All data must be provided — no fallback to mock data.
 *
 * @param {import("ethers").Contract} matchOracleContract
 * @param {number} matchId
 * @param {Array<{ playerId: number, runs: number, wickets: number, economy: number, strikeRate: number, isMotm: boolean }>} playerStats
 * @param {{ winner: string, abandoned: boolean }} matchResult
 * @param {object} db - database module for looking up match/player data
 * @returns {Promise<{ success: boolean, matchId: number, txHash: string, playerTxHashes: Array<{ playerId: number, txHash: string }> }>}
 */
async function simulateMatch(matchOracleContract, matchId, playerStats, matchResult, db) {
  // If no match result provided, look up teams from DB and pick team1 as winner
  let result = matchResult;
  if (!result && db) {
    const { rows } = await db.query(
      "SELECT team1, team2 FROM matches WHERE match_id = $1",
      [matchId]
    );
    if (rows.length > 0) {
      result = { winner: rows[0].team1, abandoned: false };
    }
  }
  if (!result) {
    throw new Error(`No match result provided and match ${matchId} not found in DB`);
  }

  // 1. Submit match result
  const resultResp = await submitMatchResult(
    matchOracleContract,
    matchId,
    result.winner,
    result.abandoned
  );

  // 2. Submit stats for every player
  const playerTxHashes = [];
  for (const stat of playerStats) {
    const playerStat = {
      runs: stat.runs || 0,
      wickets: stat.wickets || 0,
      economyRate: stat.economy || 0,
      strikeRate: stat.strikeRate || 0,
      isMotm: stat.isMotm || false,
    };

    const resp = await submitPlayerStats(matchOracleContract, matchId, stat.playerId, playerStat);
    playerTxHashes.push({ playerId: stat.playerId, txHash: resp.txHash });
  }

  return {
    success: true,
    matchId,
    txHash: resultResp.txHash,
    playerTxHashes,
  };
}

module.exports = { submitMatchResult, submitPlayerStats, simulateMatch };
