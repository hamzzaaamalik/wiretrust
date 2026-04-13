// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title IReputationStore
/// @notice Interface for on-chain behavioral reputation tracking of agents.
interface IReputationStore {
    // ──────────────────────────────────────────────────────────────────────
    //  Enums & Structs
    // ──────────────────────────────────────────────────────────────────────

    enum RiskBadge { SAFE, MEDIUM, RISKY }

    /// @dev Tightly packed into 3 storage slots (down from 8).
    ///
    /// Slot 1 (256 bits):
    ///   successCount        uint64   (bits   0–63)
    ///   failureCount        uint64   (bits  64–127)
    ///   attemptedViolations uint64   (bits 128–191)
    ///   reputationScore     uint16   (bits 192–207)  — max 100, fits uint16
    ///
    /// Slot 2 (256 bits):
    ///   lastViolationTimestamp uint48 (bits   0–47)
    ///   lastSuccessTimestamp   uint48 (bits  48–95)
    ///   scoreLastUpdated       uint48 (bits  96–143)
    ///
    /// Slot 3 (256 bits):
    ///   totalGasUsed         uint256
    struct BehaviorCheckpoint {
        uint64 successCount;           // slot 1
        uint64 failureCount;           // slot 1
        uint64 attemptedViolations;    // slot 1
        uint16 reputationScore;        // slot 1 (max 100, fits uint16)
        uint48 lastViolationTimestamp;  // slot 2
        uint48 lastSuccessTimestamp;    // slot 2
        uint48 scoreLastUpdated;       // slot 2
        uint256 totalGasUsed;          // slot 3
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Custom Errors
    // ──────────────────────────────────────────────────────────────────────

    error Unauthorized();
    error GatewayAlreadySet();
    error InvalidGateway();

    // ──────────────────────────────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────────────────────────────

    event GatewaySet(address indexed gateway);
    event ScoreUpdated(uint256 indexed agentId, uint256 newScore, RiskBadge badge);

    // ──────────────────────────────────────────────────────────────────────
    //  External Functions
    // ──────────────────────────────────────────────────────────────────────

    /// @notice Sets the gateway address. Can only be called once.
    /// @param gateway The address of the ExecutionGateway contract.
    function setGateway(address gateway) external;

    /// @notice Records a successful execution for an agent.
    /// @param agentId The unique identifier of the agent.
    /// @param gasUsed The amount of gas consumed by the execution.
    function recordSuccess(uint256 agentId, uint256 gasUsed) external;

    /// @notice Records a failed execution for an agent.
    /// @param agentId The unique identifier of the agent.
    /// @param gasUsed The amount of gas consumed by the execution.
    function recordFailure(uint256 agentId, uint256 gasUsed) external;

    /// @notice Records a policy violation attempt for an agent.
    /// @param agentId The unique identifier of the agent.
    /// @param gasUsed The amount of gas consumed by the execution.
    function recordViolation(uint256 agentId, uint256 gasUsed) external;

    /// @notice Returns the current reputation score for an agent.
    /// @param agentId The unique identifier of the agent.
    /// @return The reputation score (0–100). Returns NEUTRAL_SCORE if no history.
    function getScore(uint256 agentId) external view returns (uint256);

    /// @notice Returns the risk badge classification for an agent.
    /// @param agentId The unique identifier of the agent.
    /// @return The agent's current RiskBadge (SAFE, MEDIUM, or RISKY).
    function getRiskBadge(uint256 agentId) external view returns (RiskBadge);

    /// @notice Returns the full behavioral checkpoint for an agent.
    /// @param agentId The unique identifier of the agent.
    /// @return The BehaviorCheckpoint struct containing all tracked metrics.
    function getCheckpoint(uint256 agentId) external view returns (BehaviorCheckpoint memory);
}
