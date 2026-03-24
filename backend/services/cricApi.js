/**
 * Sportmonks Cricket API Service
 *
 * Base URL: https://cricket.sportmonks.com/api/v2.0/
 * Auth: api_token query parameter
 * Rate limit: 2000 calls/hour
 *
 * Key endpoints:
 *   /leagues              — list leagues (find PSL)
 *   /fixtures             — match list (filter by league, date, status)
 *   /fixtures/{id}        — match detail + scorecard
 *   /livescores           — live matches
 *   /teams/{id}/squad/{s} — squad roster by season
 *   /players/{id}         — player detail
 */

const SPORTMONKS_BASE = "https://cricket.sportmonks.com/api/v2.0";

function getApiToken() {
  const token = process.env.SPORTMONKS_KEY;
  if (!token) {
    console.warn("SPORTMONKS_KEY not set — cricket data sync disabled");
    return null;
  }
  return token;
}

/**
 * Generic fetch wrapper for Sportmonks API.
 */
async function smFetch(endpoint, params = {}) {
  const token = getApiToken();
  if (!token) return null;

  const url = new URL(`${SPORTMONKS_BASE}${endpoint}`);
  url.searchParams.set("api_token", token);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    if (res.status === 429) {
      console.error("Sportmonks rate limit exceeded — try again later");
      return null;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`Sportmonks ${endpoint} HTTP ${res.status}: ${text.slice(0, 200)}`);
      return null;
    }

    const json = await res.json();
    return json;
  } catch (err) {
    console.error(`Sportmonks ${endpoint} fetch failed:`, err.message);
    return null;
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Get all leagues. Use to find PSL league_id.
 */
async function getLeagues() {
  const data = await smFetch("/leagues");
  return data?.data || [];
}

/**
 * Get fixtures (matches) with optional filters.
 * @param {Object} filters — { league_id, status, starts_between, include }
 */
async function getFixtures(filters = {}) {
  const params = {};
  if (filters.league_id) params["filter[league_id]"] = filters.league_id;
  if (filters.status) params["filter[status]"] = filters.status;
  if (filters.starts_between) params["filter[starts_between]"] = filters.starts_between;
  if (filters.season_id) params["filter[season_id]"] = filters.season_id;
  // Include nested data: teams, venue, scoreboards
  params.include = filters.include || "localteam,visitorteam,venue";
  const data = await smFetch("/fixtures", params);
  return data?.data || [];
}

/**
 * Get a single fixture by ID with full detail.
 */
async function getFixtureById(fixtureId) {
  const data = await smFetch(`/fixtures/${fixtureId}`, {
    include: "localteam,visitorteam,venue,batting,bowling,scoreboards,lineup,tosswon,manofmatch",
  });
  return data?.data || null;
}

/**
 * Get live matches.
 */
async function getLivescores() {
  const data = await smFetch("/livescores", {
    include: "localteam,visitorteam,scoreboards",
  });
  return data?.data || [];
}

/**
 * Get squad/roster for a team in a specific season.
 * @param {number} teamId — Sportmonks team ID
 * @param {number} seasonId — Sportmonks season ID
 */
async function getSquad(teamId, seasonId) {
  const data = await smFetch(`/teams/${teamId}/squad/${seasonId}`, {
    include: "player",
  });
  return data?.data?.squad || data?.data || [];
}

/**
 * Get player detail by ID.
 */
async function getPlayer(playerId) {
  const data = await smFetch(`/players/${playerId}`);
  return data?.data || null;
}

/**
 * Get standings for a season.
 */
async function getStandings(seasonId) {
  const data = await smFetch(`/standings/season/${seasonId}`);
  return data?.data || [];
}

/**
 * Search for a league by name (e.g. "Pakistan Super League").
 */
async function findLeague(name) {
  const leagues = await getLeagues();
  const needle = name.toLowerCase();
  return leagues.find((l) =>
    l.name?.toLowerCase().includes(needle) || l.code?.toLowerCase().includes(needle)
  ) || null;
}

// ─── Data Mapping ──────────────────────────────────────────────────────────────

/**
 * Map Sportmonks position string to our DB role enum.
 */
function mapRole(position) {
  if (!position) return "ALL";
  const p = position.toLowerCase();
  if (p.includes("keeper") || p.includes("wicket")) return "WK";
  if (p.includes("bat")) return "BAT";
  if (p.includes("bowl")) return "BOWL";
  if (p.includes("all")) return "ALL";
  return "ALL";
}

/**
 * Map Sportmonks fixture status to our DB status enum.
 */
function mapMatchStatus(status) {
  if (!status) return "UPCOMING";
  const s = status.toLowerCase();
  if (s === "ns" || s === "not started" || s.includes("upcoming")) return "UPCOMING";
  if (s === "1st innings" || s === "2nd innings" || s === "innings break" || s.includes("live")) return "LIVE";
  if (s === "finished" || s === "won" || s === "drawn" || s === "tied" || s === "aban") return "COMPLETED";
  if (s === "cancelled" || s === "no result" || s === "abandoned") return "ABANDONED";
  return "UPCOMING";
}

/**
 * Assign fantasy credits based on player position and index in squad.
 */
function assignCredits(position, index) {
  const baseByRole = { BAT: 9, BOWL: 7.5, ALL: 8.5, WK: 8 };
  const role = mapRole(position);
  const base = baseByRole[role] || 7;
  const posBonus = Math.max(0, (11 - index) * 0.3);
  return Math.round((base + posBonus) * 2) / 2;
}

/**
 * Extract team names from a Sportmonks fixture object.
 */
function extractTeams(fixture) {
  return {
    team1: fixture.localteam?.name || fixture.localteam_id?.toString() || "Team 1",
    team2: fixture.visitorteam?.name || fixture.visitorteam_id?.toString() || "Team 2",
  };
}

/**
 * Determine winner from a Sportmonks fixture.
 */
function extractWinner(fixture) {
  if (!fixture.winner_team_id) return null;
  if (fixture.winner_team_id === fixture.localteam_id) {
    return fixture.localteam?.name || "Local Team";
  }
  if (fixture.winner_team_id === fixture.visitorteam_id) {
    return fixture.visitorteam?.name || "Visitor Team";
  }
  return null;
}

/**
 * Calculate fantasy points from Sportmonks batting/bowling data.
 *
 * Points formula:
 *   runs × 1 + fours × 1 + sixes × 2 + wickets × 25
 *   + catches × 8 + stumpings × 12 + runOuts × 6
 *   + 50 bonus: 20pts | 100 bonus: 50pts
 *   + 3-wicket bonus: 20pts | 5-wicket bonus: 50pts
 *   - duck penalty (bat/all/wk): -5pts
 */
function calculateFantasyPoints(batting = {}, bowling = {}) {
  let pts = 0;

  // Batting
  const runs = parseInt(batting.score) || parseInt(batting.runs) || 0;
  const fours = parseInt(batting.four_x) || parseInt(batting.fours) || 0;
  const sixes = parseInt(batting.six_x) || parseInt(batting.sixes) || 0;
  pts += runs + fours + sixes * 2;
  if (runs >= 100) pts += 50;
  else if (runs >= 50) pts += 20;
  if (runs === 0 && batting.is_out) pts -= 5;

  // Bowling
  const wickets = parseInt(bowling.wickets) || 0;
  pts += wickets * 25;
  if (wickets >= 5) pts += 50;
  else if (wickets >= 3) pts += 20;
  const overs = parseFloat(bowling.overs) || 0;
  if (overs >= 2) {
    const economy = parseFloat(bowling.rate) || parseFloat(bowling.economy) || 0;
    if (economy < 5) pts += 15;
    else if (economy < 7) pts += 5;
    else if (economy > 11) pts -= 10;
    else if (economy > 9) pts -= 5;
  }

  // Fielding
  const catches = parseInt(batting.catch_stump_player_id ? 1 : 0) || 0;
  pts += catches * 8;

  return pts;
}

// ─── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  getLeagues,
  getFixtures,
  getFixtureById,
  getLivescores,
  getSquad,
  getPlayer,
  getStandings,
  findLeague,
  mapRole,
  mapMatchStatus,
  assignCredits,
  extractTeams,
  extractWinner,
  calculateFantasyPoints,
};
