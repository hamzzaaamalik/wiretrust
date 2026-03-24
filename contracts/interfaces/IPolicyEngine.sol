// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title IPolicyEngine
/// @notice Interface for agent policy management and execution validation.
interface IPolicyEngine {
    // ──────────────────────────────────────────────────────────────────────
    //  Structs
    // ──────────────────────────────────────────────────────────────────────

    /// @notice Packed policy struct (2 value slots + 2 dynamic arrays).
    /// @dev Slot 1: maxAmountPerAction (128) + maxAmountPerDay (128) = 256 bits.
    ///      Slot 2: frequencyLimit (32) + expiry (48) + maxActivePositions (32) + active (8) = 120 bits.
    struct Policy {
        uint128 maxAmountPerAction;   // slot 1: 16 bytes (max ~340B ETH)
        uint128 maxAmountPerDay;      // slot 1: 32 bytes
        uint32 frequencyLimit;        // slot 2: 4 bytes (max ~136 years in seconds)
        uint48 expiry;                // slot 2: 10 bytes
        uint32 maxActivePositions;    // slot 2: 14 bytes
        bool active;                  // slot 2: 15 bytes
        address[] allowedContracts;   // slot 3
        bytes32[] allowedActions;     // slot 4
    }

    /// @notice Packed tracking struct — fits in a single 256-bit slot.
    /// @dev dailySpent (128) + dailyResetTime (48) + lastExecution (48) + activePositions (32) = 256 bits.
    struct AgentTracking {
        uint128 dailySpent;           // slot 1: 16 bytes (max ~340B ETH)
        uint48 dailyResetTime;        // slot 1: 22 bytes
        uint48 lastExecution;         // slot 1: 28 bytes
        uint32 activePositions;       // slot 1: 32 bytes (4B positions)
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Custom Errors
    // ──────────────────────────────────────────────────────────────────────

    error Unauthorized();
    error GatewayAlreadySet();
    error InvalidGateway();
    error InvalidRegistry();
    error NotAgentOwner();
    error AgentNotActive();
    error TooManyContracts();
    error TooManyActions();
    error ExpiryTooSoon();
    error NoActivePositions();
    error ValueOverflow();

    // ──────────────────────────────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────────────────────────────

    event PolicySet(uint256 indexed agentId);
    event GatewaySet(address gateway);

    // ──────────────────────────────────────────────────────────────────────
    //  External Functions
    // ──────────────────────────────────────────────────────────────────────

    /// @notice Sets the gateway address. Can only be called once.
    /// @param gateway The address of the ExecutionGateway contract.
    function setGateway(address gateway) external;

    /// @notice Configures a policy for an agent. Only callable by the agent's owner.
    /// @param agentId The unique identifier of the agent.
    /// @param maxAmountPerAction Maximum value allowed per single execution.
    /// @param maxAmountPerDay Maximum cumulative value allowed per day.
    /// @param frequencyLimit Minimum seconds between consecutive executions.
    /// @param expiry Unix timestamp after which the policy is no longer valid (0 = no expiry).
    /// @param allowedContracts List of whitelisted target contract addresses.
    /// @param allowedActions List of whitelisted action identifiers.
    /// @param maxActivePositions Maximum number of concurrent open positions.
    function setPolicy(
        uint256 agentId,
        uint256 maxAmountPerAction,
        uint256 maxAmountPerDay,
        uint256 frequencyLimit,
        uint256 expiry,
        address[] calldata allowedContracts,
        bytes32[] calldata allowedActions,
        uint256 maxActivePositions
    ) external;

    /// @notice Validates an execution against the agent's policy. 8 checks in strict order.
    /// @param agentId The unique identifier of the agent.
    /// @param target The target contract address for the execution.
    /// @param action The action identifier being executed.
    /// @param amount The value associated with the execution.
    /// @return valid True if all policy checks pass.
    /// @return reason Human-readable reason if validation fails; empty string on success.
    function validateExecution(
        uint256 agentId,
        address target,
        bytes32 action,
        uint256 amount
    ) external view returns (bool valid, string memory reason);

    /// @notice Updates tracking state after a successful execution.
    /// @param agentId The unique identifier of the agent.
    /// @param amount The value that was executed.
    function updateAfterExecution(uint256 agentId, uint256 amount) external;

    /// @notice Decrements the active position count for an agent.
    /// @param agentId The unique identifier of the agent.
    function closePosition(uint256 agentId) external;

    /// @notice Returns the core policy parameters for an agent.
    /// @param agentId The unique identifier of the agent.
    /// @return maxAmountPerAction Maximum value per single execution.
    /// @return maxAmountPerDay Maximum cumulative value per day.
    /// @return frequencyLimit Minimum seconds between executions.
    /// @return expiry Policy expiration timestamp.
    /// @return maxActivePositions Maximum concurrent open positions.
    /// @return active Whether the policy is currently active.
    function getPolicy(uint256 agentId) external view returns (
        uint256 maxAmountPerAction,
        uint256 maxAmountPerDay,
        uint256 frequencyLimit,
        uint256 expiry,
        uint256 maxActivePositions,
        bool active
    );

    /// @notice Returns the list of whitelisted contract addresses for an agent's policy.
    /// @param agentId The unique identifier of the agent.
    /// @return The array of allowed contract addresses.
    function getPolicyContracts(uint256 agentId) external view returns (address[] memory);

    /// @notice Returns the list of whitelisted action identifiers for an agent's policy.
    /// @param agentId The unique identifier of the agent.
    /// @return The array of allowed action hashes.
    function getPolicyActions(uint256 agentId) external view returns (bytes32[] memory);
}
