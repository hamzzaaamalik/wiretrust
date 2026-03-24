// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title IExecutionGateway
/// @notice Interface for the WireTrust execution gateway that routes all agent
///         actions, enforces policy constraints, collects protocol fees, and
///         records reputation outcomes.
interface IExecutionGateway {
    // ──────────────────────────────────────────────
    //  Custom Errors
    // ──────────────────────────────────────────────

    /// @notice Caller is not the registered owner of the agent.
    error NotAgentOwner();

    /// @notice The agent has been deactivated and cannot execute.
    error AgentNotActive();

    /// @notice The target address is on the forbidden list.
    /// @param target The address that was blocked.
    error ForbiddenTarget(address target);

    /// @notice The nonce has already been consumed for this agent.
    /// @param nonce The duplicate nonce hash.
    error NonceAlreadyUsed(bytes32 nonce);

    /// @notice ETH transfer to the protocol treasury failed.
    error FeeTransferFailed();

    /// @notice A zero address was supplied where a valid address is required.
    error InvalidAddress();

    /// @notice msg.value does not match the declared amount parameter.
    error ValueMismatch();

    /// @notice No ETH balance available to sweep.
    error NoBalance();

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    /// @notice Emitted after every execution attempt (success or failure).
    /// @param agentId  The unique identifier of the executing agent.
    /// @param action   The action selector that was attempted.
    /// @param success  Whether the external call succeeded.
    /// @param gasUsed  Gas consumed by the execution.
    /// @param timestamp Block timestamp of the execution.
    event AgentExecuted(
        uint256 indexed agentId,
        bytes32 action,
        bool success,
        uint256 gasUsed,
        uint256 timestamp
    );

    /// @notice Emitted when policy validation rejects an execution.
    /// @param agentId  The agent that violated policy.
    /// @param target   The intended call target.
    /// @param action   The action that was attempted.
    /// @param reason   Human-readable violation reason from the policy engine.
    /// @param timestamp Block timestamp of the violation.
    event AgentViolation(
        uint256 indexed agentId,
        address target,
        bytes32 action,
        string reason,
        uint256 timestamp
    );

    /// @notice Emitted when the forbidden-target list is updated.
    /// @param target    The address whose status changed.
    /// @param forbidden Whether the address is now forbidden.
    event ForbiddenTargetUpdated(address indexed target, bool forbidden);

    /// @notice Emitted when the protocol treasury address is changed.
    /// @param treasury The new treasury address.
    event ProtocolTreasuryUpdated(address indexed treasury);

    /// @notice Emitted when the owner sweeps stuck ETH from the contract.
    /// @param to     The address that received the swept ETH.
    /// @param amount The amount of ETH swept.
    event ETHSwept(address indexed to, uint256 amount);

    // ──────────────────────────────────────────────
    //  Core
    // ──────────────────────────────────────────────

    /// @notice Execute an action on behalf of an agent.
    ///
    /// Flow:
    ///   1. Verify msg.sender owns the agent.
    ///   2. Verify the agent is active.
    ///   3. Reject forbidden target addresses.
    ///   4. Consume the nonce (replay protection).
    ///   5. Validate the action against the policy engine.
    ///   6. On policy violation: record reputation penalty, emit event, return false.
    ///   7. Deduct protocol fee from msg.value (if any).
    ///   8. Forward the external call.
    ///   9. On call failure: record failure reputation, emit event, return false.
    ///  10. On success: update policy tracking, record success reputation, emit event.
    ///
    /// The nonce is consumed even on policy violation so that the same nonce
    /// cannot be replayed. Violations return false (rather than revert) so that
    /// reputation state changes are persisted on-chain.
    ///
    /// @param agentId Unique identifier of the agent performing the action.
    /// @param target  Address of the external contract to call.
    /// @param action  Selector / label identifying the type of action.
    /// @param data    Calldata to forward to `target`.
    /// @param amount  ETH value (in wei) to forward after fee deduction.
    /// @param nonce   Unique nonce for replay protection.
    /// @return success True if the external call succeeded, false otherwise.
    function execute(
        uint256 agentId,
        address target,
        bytes32 action,
        bytes calldata data,
        uint256 amount,
        bytes32 nonce
    ) external payable returns (bool success);

    /// @notice Close an agent's open position via the policy engine.
    /// @param agentId The agent whose position should be closed.
    function closeAgentPosition(uint256 agentId) external;

    /// @notice Add or remove an address from the forbidden-target list.
    /// @param target    The address to update.
    /// @param forbidden True to forbid, false to allow.
    function setForbiddenTarget(address target, bool forbidden) external;

    /// @notice Update the protocol treasury address.
    /// @param treasury The new treasury address (must not be zero).
    function setProtocolTreasury(address treasury) external;

    /// @notice Sweep any stuck ETH from the contract to a specified address.
    /// @param to The address to receive the swept ETH (must not be zero).
    function sweepETH(address to) external;
}
