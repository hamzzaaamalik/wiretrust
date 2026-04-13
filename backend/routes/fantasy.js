const router = require("express").Router();

// Contest display names based on max participants
function contestLabel(maxP) {
  const max = Number(maxP);
  if (max <= 2) return "Head to Head";
  if (max <= 10) return "Mini League";
  if (max <= 20) return "Practice Match";
  if (max <= 50) return "Main Contest";
  if (max <= 100) return "Grand Contest";
  return "Mega Contest";
}

const FALLBACK_SPONSORS = [
  "WireFluid Foundation",
  "PSL Official",
  "CricBuzz Pakistan",
  "The Pindiz Fan Club",
  "WireTrust Protocol",
];

// Helper: load all sponsor branding from DB
async function getSponsorMap(db) {
  try {
    const { rows } = await db.query('SELECT contest_id, sponsor_name, sponsor_logo, banner_url FROM contest_sponsors');
    const map = {};
    for (const r of rows) map[r.contest_id] = { name: r.sponsor_name, logo: r.sponsor_logo, banner: r.banner_url };
    return map;
  } catch { return {}; }
}

// Helper: get match info from DB
async function getMatchInfo(db, matchId) {
  const { rows } = await db.query(
    "SELECT match_id, team1, team2, venue, start_time, status FROM matches WHERE match_id = $1",
    [Number(matchId)]
  );
  if (rows.length === 0) return null;
  const m = rows[0];
  return { matchId: m.match_id, team1: m.team1, team2: m.team2, venue: m.venue, startTime: m.start_time, status: m.status };
}

// Helper: get player name by id from DB
async function getPlayerName(db, playerId) {
  const { rows } = await db.query(
    "SELECT name FROM players WHERE player_id = $1",
    [Number(playerId)]
  );
  return rows.length > 0 ? rows[0].name : `Player #${playerId}`;
}

// Helper: batch-load player names for a list of IDs
async function getPlayerNames(db, playerIds) {
  const ids = playerIds.map(Number).filter(id => id > 0);
  if (ids.length === 0) return {};
  const { rows } = await db.query(
    "SELECT player_id, name FROM players WHERE player_id = ANY($1)",
    [ids]
  );
  const map = {};
  for (const r of rows) map[r.player_id] = r.name;
  return map;
}

// GET /contests/:matchId — all contests for a match (includes participant addresses)
router.get("/contests/:matchId", async (req, res) => {
  try {
    const { contracts, db } = req.app.locals;
    const matchId = req.params.matchId;
    const count = await contracts.fantasyModule.contestCount();
    const contests = [];
    const matchInfo = await getMatchInfo(db, matchId);
    const sponsorMap = await getSponsorMap(db);

    for (let i = 1; i <= Number(count); i++) {
      const contest = await contracts.fantasyModule.contests(i);
      if (contest.matchId.toString() === matchId) {
        const participants = await contracts.fantasyModule.getContestParticipants(i);
        const maxP = contest.maxParticipants.toString();
        const sp = sponsorMap[i];
        contests.push({
          contestId: contest.contestId.toString(),
          franchiseId: contest.franchiseId.toString(),
          matchId: contest.matchId.toString(),
          sponsorPool: contest.sponsorPool.toString(),
          maxParticipants: maxP,
          participantCount: participants.length,
          participants: participants.map(a => a.toLowerCase()),
          active: contest.active,
          finalized: contest.finalized,
          matchName: matchInfo ? `${matchInfo.team1} vs ${matchInfo.team2}` : `Match #${matchId}`,
          name: contestLabel(maxP),
          sponsor: sp?.name || FALLBACK_SPONSORS[(i - 1) % FALLBACK_SPONSORS.length],
          sponsorLogo: sp?.logo || null,
          bannerUrl: sp?.banner || null,
          startTime: matchInfo?.startTime || null,
        });
      }
    }

    res.json(contests);
  } catch (err) {
    console.error("Get contests failed:", err.message);
    res.status(500).json({ error: "Failed to get contests", details: err.message });
  }
});

// GET /my-squads/:address — all squads the user has across ALL contests
router.get("/my-squads/:address", async (req, res) => {
  try {
    const { contracts, db } = req.app.locals;
    const userAddress = req.params.address.toLowerCase();
    const count = await contracts.fantasyModule.contestCount();
    const mySquads = [];

    for (let i = 1; i <= Number(count); i++) {
      const contest = await contracts.fantasyModule.contests(i);
      const participants = await contracts.fantasyModule.getContestParticipants(i);
      const isParticipant = participants.some(a => a.toLowerCase() === userAddress);

      if (isParticipant) {
        const squad = await contracts.fantasyModule.getSquad(i, userAddress);
        const matchInfo = await getMatchInfo(db, contest.matchId.toString());
        const maxP = contest.maxParticipants.toString();

        // Batch load player names
        const allIds = [...squad.playerIds.map(id => id.toString()), squad.captainId.toString(), squad.viceCaptainId.toString()];
        const nameMap = await getPlayerNames(db, allIds);

        mySquads.push({
          contestId: i.toString(),
          contestName: contestLabel(maxP),
          matchId: contest.matchId.toString(),
          matchName: matchInfo ? `${matchInfo.team1} vs ${matchInfo.team2}` : `Match #${contest.matchId}`,
          sponsorPool: contest.sponsorPool.toString(),
          finalized: contest.finalized,
          participantCount: participants.length,
          maxParticipants: maxP,
          squad: {
            owner: squad.owner,
            captainId: squad.captainId.toString(),
            captainName: nameMap[Number(squad.captainId)] || `Player #${squad.captainId}`,
            viceCaptainId: squad.viceCaptainId.toString(),
            viceCaptainName: nameMap[Number(squad.viceCaptainId)] || `Player #${squad.viceCaptainId}`,
            totalCredits: squad.totalCredits.toString(),
            submittedAt: squad.submittedAt.toString(),
            totalPoints: squad.totalPoints.toString(),
            playerIds: squad.playerIds.map(id => id.toString()),
            playerNames: squad.playerIds.map(id => nameMap[Number(id)] || `Player #${id}`),
          },
        });
      }
    }

    res.json(mySquads);
  } catch (err) {
    console.error("Get my squads failed:", err.message);
    res.status(500).json({ error: "Failed to get squads", details: err.message });
  }
});

// GET /leaderboard/:contestId — ranked participants for a contest
router.get("/leaderboard/:contestId", async (req, res) => {
  try {
    const { contracts, db } = req.app.locals;
    const contestId = req.params.contestId;

    const contest = await contracts.fantasyModule.contests(contestId);
    const matchInfo = await getMatchInfo(db, contest.matchId.toString());
    const participants = await contracts.fantasyModule.getContestParticipants(contestId);

    // Collect all player IDs for batch name lookup
    const allPlayerIds = new Set();
    const squads = [];
    for (const addr of participants) {
      const squad = await contracts.fantasyModule.getSquad(contestId, addr);
      squads.push({ addr, squad });
      allPlayerIds.add(Number(squad.captainId));
      allPlayerIds.add(Number(squad.viceCaptainId));
    }
    const nameMap = await getPlayerNames(db, [...allPlayerIds]);

    const entries = squads.map(({ addr, squad }) => ({
      address: addr,
      captainId: squad.captainId.toString(),
      captainName: nameMap[Number(squad.captainId)] || `Player #${squad.captainId}`,
      viceCaptainId: squad.viceCaptainId.toString(),
      viceCaptainName: nameMap[Number(squad.viceCaptainId)] || `Player #${squad.viceCaptainId}`,
      totalCredits: squad.totalCredits.toString(),
      submittedAt: squad.submittedAt.toString(),
      totalPoints: squad.totalPoints.toString(),
      playerCount: squad.playerIds.filter(id => id.toString() !== "0").length,
    }));

    entries.sort((a, b) => Number(b.totalPoints) - Number(a.totalPoints));

    res.json({
      contestId,
      contestName: contestLabel(contest.maxParticipants.toString()),
      matchName: matchInfo ? `${matchInfo.team1} vs ${matchInfo.team2}` : `Match #${contest.matchId}`,
      sponsorPool: contest.sponsorPool.toString(),
      finalized: contest.finalized,
      participantCount: entries.length,
      entries,
    });
  } catch (err) {
    console.error("Get leaderboard failed:", err.message);
    res.status(500).json({ error: "Failed to get leaderboard", details: err.message });
  }
});

// GET /squad/:contestId/:address — single squad (keep for backward compat)
router.get("/squad/:contestId/:address", async (req, res) => {
  try {
    const { contracts, db } = req.app.locals;
    const { contestId, address } = req.params;
    const squad = await contracts.fantasyModule.getSquad(contestId, address);

    // Batch load player names
    const allIds = [...squad.playerIds.map(id => id.toString()), squad.captainId.toString(), squad.viceCaptainId.toString()];
    const nameMap = await getPlayerNames(db, allIds);

    res.json({
      address,
      contestId,
      owner: squad.owner,
      captainId: squad.captainId.toString(),
      captainName: nameMap[Number(squad.captainId)] || `Player #${squad.captainId}`,
      viceCaptainId: squad.viceCaptainId.toString(),
      viceCaptainName: nameMap[Number(squad.viceCaptainId)] || `Player #${squad.viceCaptainId}`,
      totalCredits: squad.totalCredits.toString(),
      submittedAt: squad.submittedAt.toString(),
      totalPoints: squad.totalPoints.toString(),
      playerIds: squad.playerIds.map(id => id.toString()),
      playerNames: squad.playerIds.map(id => nameMap[Number(id)] || `Player #${id}`),
    });
  } catch (err) {
    console.error("Get squad failed:", err.message);
    res.status(500).json({ error: "Failed to get squad", details: err.message });
  }
});

// POST /create-contest — create a new fantasy contest (admin or franchise admin)
router.post("/create-contest", async (req, res) => {
  try {
    const { contracts } = req.app.locals;
    const { franchise_id, match_id, max_participants } = req.body;

    if (!franchise_id || !match_id) {
      return res.status(400).json({ error: "franchise_id and match_id required" });
    }

    const tx = await contracts.fantasyModule.createContest(
      franchise_id,
      match_id,
      max_participants || 0
    );
    const receipt = await tx.wait();

    // Parse ContestCreated event to get contestId
    let contestId = null;
    const iface = contracts.fantasyModule.interface;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === "ContestCreated") {
          contestId = parsed.args.contestId?.toString();
        }
      } catch (err) { /* non-critical: log parsing */ }
    }

    res.json({
      success: true,
      contestId: contestId || "unknown",
      txHash: receipt.hash,
    });
  } catch (err) {
    console.error("Create contest failed:", err.message);
    res.status(500).json({ error: "Failed to create contest", details: err.message });
  }
});

// POST /fund-contest — fund a contest prize pool (sponsor or franchise admin)
router.post("/fund-contest", async (req, res) => {
  try {
    const { contracts } = req.app.locals;
    const { contest_id, amount_wire } = req.body;

    if (!contest_id || !amount_wire) {
      return res.status(400).json({ error: "contest_id and amount_wire required" });
    }

    const { ethers } = require("ethers");
    const amountWei = ethers.parseEther(String(amount_wire));

    const tx = await contracts.fantasyModule.fundContest(contest_id, {
      value: amountWei,
    });
    const receipt = await tx.wait();

    res.json({
      success: true,
      contestId: contest_id,
      funded: amount_wire + " WIRE",
      txHash: receipt.hash,
    });
  } catch (err) {
    console.error("Fund contest failed:", err.message);
    res.status(500).json({ error: "Failed to fund contest", details: err.message });
  }
});

// GET /all-contests — list all contests across all matches
router.get("/all-contests", async (req, res) => {
  try {
    const { contracts, db } = req.app.locals;
    const count = await contracts.fantasyModule.contestCount();
    const contests = [];
    const sponsorMap = await getSponsorMap(db);

    for (let i = 1; i <= Number(count); i++) {
      try {
        const contest = await contracts.fantasyModule.contests(i);
        const participants = await contracts.fantasyModule.getContestParticipants(i);
        const matchInfo = await getMatchInfo(db, contest.matchId.toString());
        const maxP = contest.maxParticipants.toString();
        const sp = sponsorMap[i];

        contests.push({
          contestId: contest.contestId.toString(),
          franchiseId: contest.franchiseId.toString(),
          matchId: contest.matchId.toString(),
          sponsorPool: contest.sponsorPool.toString(),
          maxParticipants: maxP,
          participantCount: participants.length,
          active: contest.active,
          finalized: contest.finalized,
          matchName: matchInfo ? `${matchInfo.team1} vs ${matchInfo.team2}` : `Match #${contest.matchId}`,
          name: contestLabel(maxP),
          sponsor: sp?.name || FALLBACK_SPONSORS[(i - 1) % FALLBACK_SPONSORS.length],
          sponsorLogo: sp?.logo || null,
          bannerUrl: sp?.banner || null,
          startTime: matchInfo?.startTime || null,
        });
      } catch (err) { /* non-critical: log parsing */ }
    }

    res.json(contests);
  } catch (err) {
    res.status(500).json({ error: "Failed to get contests", details: err.message });
  }
});

module.exports = router;
