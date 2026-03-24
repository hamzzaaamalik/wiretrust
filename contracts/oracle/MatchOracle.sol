// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IMatchOracle.sol";

/// @title MatchOracle
/// @notice Thin settlement oracle — receives match results ONLY for settlement.
/// @dev Not a live data feed. Contracts function without oracle — oracle just triggers payouts.
///      Multi-oracle pattern: multiple authorized wallets can submit results.
contract MatchOracle is IMatchOracle, Ownable {
    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    mapping(uint256 => MatchData) private _matches;
    mapping(uint256 => mapping(uint256 => PlayerPerformance)) private _playerStats;
    mapping(uint256 => mapping(uint256 => bool)) private _statsSubmitted;
    mapping(address => bool) public authorizedOracles;
    uint256 public matchCount;

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    modifier onlyOracle() {
        if (!authorizedOracles[msg.sender]) revert NotAuthorizedOracle();
        _;
    }

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ──────────────────────────────────────────────
    //  Write Functions
    // ──────────────────────────────────────────────

    /// @inheritdoc IMatchOracle
    function authorizeOracle(address oracle) external onlyOwner {
        if (oracle == address(0)) revert InvalidOracle();
        authorizedOracles[oracle] = true;
        emit OracleAuthorized(oracle);
    }

    /// @inheritdoc IMatchOracle
    function revokeOracle(address oracle) external onlyOwner {
        authorizedOracles[oracle] = false;
        emit OracleRevoked(oracle);
    }

    /// @inheritdoc IMatchOracle
    function createMatch(
        uint256 franchiseId,
        string calldata team1,
        string calldata team2,
        uint256 startTime
    ) external onlyOwner returns (uint256) {
        uint256 id;
        unchecked {
            id = ++matchCount;
        }

        _matches[id] = MatchData({
            matchId: id,
            franchiseId: franchiseId,
            team1: team1,
            team2: team2,
            startTime: startTime,
            resultSubmitted: false,
            abandoned: false,
            winner: "",
            settledAt: 0
        });

        emit MatchCreated(id, franchiseId, team1, team2, startTime);
        return id;
    }

    /// @inheritdoc IMatchOracle
    function submitResult(
        uint256 matchId,
        string calldata winner,
        bool abandoned
    ) external onlyOracle {
        if (matchId == 0 || matchId > matchCount) revert InvalidMatch();
        MatchData storage matchData = _matches[matchId];
        if (matchData.resultSubmitted) revert ResultAlreadySubmitted();
        if (abandoned && bytes(winner).length > 0) revert InvalidResult();
        if (!abandoned && bytes(winner).length == 0) revert InvalidResult();

        matchData.resultSubmitted = true;
        matchData.abandoned = abandoned;
        matchData.winner = winner;
        matchData.settledAt = block.timestamp;

        emit MatchResultSubmitted(matchId, winner, abandoned);
    }

    /// @inheritdoc IMatchOracle
    function submitPlayerStats(
        uint256 matchId,
        uint256 playerId,
        uint256 runs,
        uint256 wickets,
        uint256 economyRate,
        uint256 strikeRate,
        bool isMotm
    ) external onlyOracle {
        if (matchId == 0 || matchId > matchCount) revert InvalidMatch();
        if (_statsSubmitted[matchId][playerId]) revert StatsAlreadySubmitted();
        _statsSubmitted[matchId][playerId] = true;

        if (runs > type(uint64).max) revert ValueOverflow();
        if (wickets > type(uint64).max) revert ValueOverflow();
        if (economyRate > type(uint64).max) revert ValueOverflow();
        if (strikeRate > type(uint64).max) revert ValueOverflow();

        _playerStats[matchId][playerId] = PlayerPerformance({
            runs: uint64(runs),
            wickets: uint64(wickets),
            economyRate: uint64(economyRate),
            strikeRate: uint64(strikeRate),
            isMotm: isMotm
        });

        emit PlayerStatsSubmitted(matchId, playerId);
    }

    // ──────────────────────────────────────────────
    //  View Functions
    // ──────────────────────────────────────────────

    /// @inheritdoc IMatchOracle
    function getResult(uint256 matchId) external view returns (MatchData memory) {
        if (matchId == 0 || matchId > matchCount) revert InvalidMatch();
        return _matches[matchId];
    }

    /// @inheritdoc IMatchOracle
    function getPlayerStats(
        uint256 matchId,
        uint256 playerId
    ) external view returns (PlayerPerformance memory) {
        if (matchId == 0 || matchId > matchCount) revert InvalidMatch();
        return _playerStats[matchId][playerId];
    }

    /// @inheritdoc IMatchOracle
    function isMatchSettled(uint256 matchId) external view returns (bool) {
        if (matchId == 0 || matchId > matchCount) return false;
        return _matches[matchId].resultSubmitted;
    }
}
