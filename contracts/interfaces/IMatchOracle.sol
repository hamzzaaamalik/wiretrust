// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title IMatchOracle
/// @notice Interface for the WireTrust match settlement oracle.
interface IMatchOracle {
    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    error NotAuthorizedOracle();
    error InvalidOracle();
    error InvalidMatch();
    error ResultAlreadySubmitted();
    error StatsAlreadySubmitted();
    error ValueOverflow();
    error InvalidResult();

    // ──────────────────────────────────────────────
    //  Structs
    // ──────────────────────────────────────────────

    struct MatchData {
        uint256 matchId;
        uint256 franchiseId;
        string team1;
        string team2;
        uint256 startTime;
        bool resultSubmitted;
        bool abandoned;
        string winner;
        uint256 settledAt;
    }

    /// @dev Packed into 2 storage slots (was 5).
    ///      Slot 1: runs | wickets | economyRate | strikeRate (4 × uint64 = 256 bits)
    ///      Slot 2: isMotm (bool)
    struct PlayerPerformance {
        uint64 runs;
        uint64 wickets;
        uint64 economyRate;
        uint64 strikeRate;
        bool isMotm;
    }

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    /// @notice Emitted when a new match is registered in the oracle.
    event MatchCreated(
        uint256 indexed matchId,
        uint256 indexed franchiseId,
        string team1,
        string team2,
        uint256 startTime
    );

    /// @notice Emitted when a match result is submitted.
    event MatchResultSubmitted(uint256 indexed matchId, string winner, bool abandoned);

    /// @notice Emitted when individual player statistics are recorded.
    event PlayerStatsSubmitted(uint256 indexed matchId, uint256 indexed playerId);

    /// @notice Emitted when an oracle address is authorized.
    event OracleAuthorized(address indexed oracle);

    /// @notice Emitted when an oracle address is revoked.
    event OracleRevoked(address indexed oracle);

    // ──────────────────────────────────────────────
    //  Write Functions
    // ──────────────────────────────────────────────

    /// @notice Creates a new match entry in the oracle.
    /// @param franchiseId The franchise that owns this match.
    /// @param team1 Name of the first team.
    /// @param team2 Name of the second team.
    /// @param startTime Unix timestamp when the match begins.
    /// @return matchId The identifier assigned to the new match.
    function createMatch(
        uint256 franchiseId,
        string calldata team1,
        string calldata team2,
        uint256 startTime
    ) external returns (uint256 matchId);

    /// @notice Submits the final result for a match.
    /// @param matchId The match to settle.
    /// @param winner Name of the winning team (empty if abandoned).
    /// @param abandoned Whether the match was abandoned.
    function submitResult(
        uint256 matchId,
        string calldata winner,
        bool abandoned
    ) external;

    /// @notice Submits individual player performance statistics for a match.
    /// @param matchId The match the player participated in.
    /// @param playerId The player whose stats are being recorded.
    /// @param runs Runs scored by the player.
    /// @param wickets Wickets taken by the player.
    /// @param economyRate Bowling economy rate (scaled).
    /// @param strikeRate Batting strike rate (scaled).
    /// @param isMotm Whether the player was Man of the Match.
    function submitPlayerStats(
        uint256 matchId,
        uint256 playerId,
        uint256 runs,
        uint256 wickets,
        uint256 economyRate,
        uint256 strikeRate,
        bool isMotm
    ) external;

    /// @notice Authorizes an address to submit oracle data.
    /// @param oracle The address to authorize.
    function authorizeOracle(address oracle) external;

    /// @notice Revokes oracle authorization from an address.
    /// @param oracle The address to revoke.
    function revokeOracle(address oracle) external;

    // ──────────────────────────────────────────────
    //  View Functions
    // ──────────────────────────────────────────────

    /// @notice Returns the full match data for a given match.
    /// @param matchId The match to query.
    /// @return data The match data struct.
    function getResult(uint256 matchId) external view returns (MatchData memory data);

    /// @notice Returns individual player statistics for a given match.
    /// @param matchId The match to query.
    /// @param playerId The player to query.
    /// @return performance The player's performance struct.
    function getPlayerStats(uint256 matchId, uint256 playerId) external view returns (PlayerPerformance memory performance);

    /// @notice Checks whether a match result has been submitted.
    /// @param matchId The match to query.
    /// @return settled True if the result has been submitted.
    function isMatchSettled(uint256 matchId) external view returns (bool settled);
}
