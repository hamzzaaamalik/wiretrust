// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IReputationStore.sol";

/// @title ReputationStore
/// @notice On-chain behavioral fingerprint for agents.
/// @dev The `attemptedViolations` field is the key differentiator —
///      even reverted violation attempts are logged permanently.
contract ReputationStore is IReputationStore, Ownable {
    // ──────────────────────────────────────────────────────────────────────
    //  Constants
    // ──────────────────────────────────────────────────────────────────────

    uint256 public constant NEUTRAL_SCORE = 50;
    uint256 public constant MAX_SCORE = 100;
    uint256 public constant VIOLATION_PENALTY_MULTIPLIER = 3;
    uint256 public constant MAX_VIOLATION_PENALTY = 30;
    uint256 public constant FAILURE_PENALTY_MULTIPLIER = 2;
    uint256 public constant MAX_FAILURE_PENALTY = 20;
    uint256 public constant RECENCY_WINDOW = 1 hours;
    uint256 public constant RECENCY_PENALTY = 10;
    uint256 public constant SAFE_THRESHOLD = 70;
    uint256 public constant RISKY_THRESHOLD = 40;
    uint256 public constant RISKY_VIOLATION_COUNT = 5;

    // ──────────────────────────────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────────────────────────────

    mapping(uint256 => BehaviorCheckpoint) private _checkpoints;
    address public gateway;

    // ──────────────────────────────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────────────────────────────

    modifier onlyGateway() {
        if (msg.sender != gateway) revert Unauthorized();
        _;
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ──────────────────────────────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────────────────────────────

    /// @notice Sets the gateway address. Can only be called once by the owner.
    /// @param _gateway The address of the ExecutionGateway contract.
    function setGateway(address _gateway) external onlyOwner {
        if (gateway != address(0)) revert GatewayAlreadySet();
        if (_gateway == address(0)) revert InvalidGateway();
        gateway = _gateway;
        emit GatewaySet(_gateway);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Recording (gateway-only)
    // ──────────────────────────────────────────────────────────────────────

    /// @notice Records a successful execution for an agent.
    /// @param agentId The unique identifier of the agent.
    /// @param gasUsed The amount of gas consumed by the execution.
    function recordSuccess(uint256 agentId, uint256 gasUsed) external onlyGateway {
        BehaviorCheckpoint storage checkpoint = _checkpoints[agentId];

        uint64 newSuccessCount;
        unchecked { newSuccessCount = checkpoint.successCount + 1; }
        checkpoint.successCount = newSuccessCount;

        uint48 ts = uint48(block.timestamp);
        checkpoint.lastSuccessTimestamp = ts;
        checkpoint.totalGasUsed += gasUsed;

        // Cache remaining fields needed for scoring to avoid redundant SLOADs
        uint64 failures = checkpoint.failureCount;
        uint64 violations = checkpoint.attemptedViolations;
        uint48 lastViolationTs = checkpoint.lastViolationTimestamp;

        _recalculateScore(agentId, checkpoint, newSuccessCount, failures, violations, lastViolationTs);
    }

    /// @notice Records a failed execution for an agent.
    /// @param agentId The unique identifier of the agent.
    /// @param gasUsed The amount of gas consumed by the execution.
    function recordFailure(uint256 agentId, uint256 gasUsed) external onlyGateway {
        BehaviorCheckpoint storage checkpoint = _checkpoints[agentId];

        uint64 newFailureCount;
        unchecked { newFailureCount = checkpoint.failureCount + 1; }
        checkpoint.failureCount = newFailureCount;

        checkpoint.totalGasUsed += gasUsed;

        // Cache remaining fields needed for scoring to avoid redundant SLOADs
        uint64 successes = checkpoint.successCount;
        uint64 violations = checkpoint.attemptedViolations;
        uint48 lastViolationTs = checkpoint.lastViolationTimestamp;

        _recalculateScore(agentId, checkpoint, successes, newFailureCount, violations, lastViolationTs);
    }

    /// @notice Records a policy violation attempt for an agent.
    /// @param agentId The unique identifier of the agent.
    /// @param gasUsed The amount of gas consumed by the execution.
    function recordViolation(uint256 agentId, uint256 gasUsed) external onlyGateway {
        BehaviorCheckpoint storage checkpoint = _checkpoints[agentId];

        uint64 newViolationCount;
        unchecked { newViolationCount = checkpoint.attemptedViolations + 1; }
        checkpoint.attemptedViolations = newViolationCount;

        uint48 ts = uint48(block.timestamp);
        checkpoint.lastViolationTimestamp = ts;
        checkpoint.totalGasUsed += gasUsed;

        // Cache remaining fields needed for scoring to avoid redundant SLOADs
        uint64 successes = checkpoint.successCount;
        uint64 failures = checkpoint.failureCount;

        _recalculateScore(agentId, checkpoint, successes, failures, newViolationCount, ts);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Views
    // ──────────────────────────────────────────────────────────────────────

    /// @notice Returns the current reputation score for an agent.
    /// @param agentId The unique identifier of the agent.
    /// @return The reputation score (0–100). Returns NEUTRAL_SCORE if no history.
    function getScore(uint256 agentId) external view returns (uint256) {
        BehaviorCheckpoint storage checkpoint = _checkpoints[agentId];
        uint256 total = uint256(checkpoint.successCount) + uint256(checkpoint.failureCount) + uint256(checkpoint.attemptedViolations);
        if (total == 0) return NEUTRAL_SCORE;
        return uint256(checkpoint.reputationScore);
    }

    /// @notice Returns the risk badge classification for an agent.
    /// @param agentId The unique identifier of the agent.
    /// @return The agent's current RiskBadge (SAFE, MEDIUM, or RISKY).
    function getRiskBadge(uint256 agentId) external view returns (RiskBadge) {
        BehaviorCheckpoint storage checkpoint = _checkpoints[agentId];
        uint256 total = uint256(checkpoint.successCount) + uint256(checkpoint.failureCount) + uint256(checkpoint.attemptedViolations);
        if (total == 0) return RiskBadge.MEDIUM;
        return _calculateBadge(uint256(checkpoint.reputationScore), uint256(checkpoint.attemptedViolations));
    }

    /// @notice Returns the full behavioral checkpoint for an agent.
    /// @param agentId The unique identifier of the agent.
    /// @return The BehaviorCheckpoint struct containing all tracked metrics.
    function getCheckpoint(uint256 agentId) external view returns (BehaviorCheckpoint memory) {
        return _checkpoints[agentId];
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Internal — Scoring
    // ──────────────────────────────────────────────────────────────────────

    /// @dev Recalculates the reputation score for an agent.
    ///
    /// Scoring formula:
    ///   base         = (successCount * 100) / totalInteractions
    ///   violationPen = min(attemptedViolations * 3, 30)
    ///   failurePen   = min(failureCount * 2, 20)
    ///   recencyPen   = 10 if a violation occurred within the last hour, else 0
    ///   score        = clamp(base - totalPenalty, 0, 100)
    ///
    /// Agents with zero interactions start at NEUTRAL_SCORE (50).
    /// @param agentId The agent identifier (used for the event).
    /// @param checkpoint Storage pointer for writing results.
    /// @param successes Cached success count.
    /// @param failures Cached failure count.
    /// @param violations Cached violation count.
    /// @param lastViolationTs Cached last-violation timestamp.
    function _recalculateScore(
        uint256 agentId,
        BehaviorCheckpoint storage checkpoint,
        uint64 successes,
        uint64 failures,
        uint64 violations,
        uint48 lastViolationTs
    ) internal {
        uint256 total = uint256(successes) + uint256(failures) + uint256(violations);

        uint256 score;
        if (total == 0) {
            score = NEUTRAL_SCORE;
        } else {
            uint256 base = (uint256(successes) * MAX_SCORE) / total;

            uint256 violationPenalty = uint256(violations) * VIOLATION_PENALTY_MULTIPLIER;
            if (violationPenalty > MAX_VIOLATION_PENALTY) violationPenalty = MAX_VIOLATION_PENALTY;

            uint256 failurePenalty = uint256(failures) * FAILURE_PENALTY_MULTIPLIER;
            if (failurePenalty > MAX_FAILURE_PENALTY) failurePenalty = MAX_FAILURE_PENALTY;

            uint256 recencyPenalty = 0;
            if (
                lastViolationTs > 0 &&
                block.timestamp - uint256(lastViolationTs) < RECENCY_WINDOW
            ) {
                recencyPenalty = RECENCY_PENALTY;
            }

            uint256 totalPenalty = violationPenalty + failurePenalty + recencyPenalty;
            score = base > totalPenalty ? base - totalPenalty : 0;
            if (score > MAX_SCORE) score = MAX_SCORE;
        }

        checkpoint.reputationScore = uint16(score);
        checkpoint.scoreLastUpdated = uint48(block.timestamp);

        emit ScoreUpdated(agentId, score, _calculateBadge(score, uint256(violations)));
    }

    /// @dev Determines the risk badge from a score and violation count.
    /// @param score The agent's reputation score.
    /// @param violations The agent's attempted violation count.
    /// @return The computed RiskBadge.
    function _calculateBadge(
        uint256 score,
        uint256 violations
    ) internal pure returns (RiskBadge) {
        if (score >= SAFE_THRESHOLD && violations == 0) {
            return RiskBadge.SAFE;
        }
        if (score < RISKY_THRESHOLD || violations > RISKY_VIOLATION_COUNT) {
            return RiskBadge.RISKY;
        }
        return RiskBadge.MEDIUM;
    }
}
