// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IPolicyEngine.sol";
import "../interfaces/IAgentRegistry.sol";

/// @title PolicyEngine
/// @notice Behavioral constraints for agents — 8 validation checks in strict order.
/// @dev Every agent has a policy. Every execution is validated against it.
///      Gas-optimized: Policy struct packed to 2 value slots, AgentTracking packed to 1 slot.
contract PolicyEngine is IPolicyEngine, Ownable {
    // ──────────────────────────────────────────────────────────────────────
    //  Constants
    // ──────────────────────────────────────────────────────────────────────

    uint256 public constant MAX_ALLOWED_CONTRACTS = 50;
    uint256 public constant MAX_ALLOWED_ACTIONS = 50;
    uint256 public constant MIN_EXPIRY_BUFFER = 60;

    // ──────────────────────────────────────────────────────────────────────
    //  Immutables
    // ──────────────────────────────────────────────────────────────────────

    IAgentRegistry public immutable agentRegistry;

    // ──────────────────────────────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────────────────────────────

    /// @notice The ExecutionGateway address. address(0) means not yet set.
    address public gateway;

    mapping(uint256 => Policy) private _policies;
    mapping(uint256 => AgentTracking) public agentTracking;

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

    constructor(address _agentRegistry) Ownable(msg.sender) {
        if (_agentRegistry == address(0)) revert InvalidRegistry();
        agentRegistry = IAgentRegistry(_agentRegistry);
    }

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
    //  Policy Management
    // ──────────────────────────────────────────────────────────────────────

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
    ) external {
        IAgentRegistry.Agent memory agent = agentRegistry.getAgent(agentId);
        if (agent.owner != msg.sender) revert NotAgentOwner();
        if (!agent.active) revert AgentNotActive();
        if (allowedContracts.length > MAX_ALLOWED_CONTRACTS) revert TooManyContracts();
        if (allowedActions.length > MAX_ALLOWED_ACTIONS) revert TooManyActions();
        if (expiry > 0 && expiry <= block.timestamp + MIN_EXPIRY_BUFFER) revert ExpiryTooSoon();

        // SafeCast bounds checks — prevent silent truncation
        if (maxAmountPerAction > type(uint128).max) revert ValueOverflow();
        if (maxAmountPerDay > type(uint128).max) revert ValueOverflow();
        if (frequencyLimit > type(uint32).max) revert ValueOverflow();
        if (expiry != 0 && expiry > type(uint48).max) revert ValueOverflow();
        if (maxActivePositions > type(uint32).max) revert ValueOverflow();

        _policies[agentId] = Policy({
            maxAmountPerAction: uint128(maxAmountPerAction),
            maxAmountPerDay: uint128(maxAmountPerDay),
            frequencyLimit: uint32(frequencyLimit),
            expiry: uint48(expiry),
            allowedContracts: allowedContracts,
            allowedActions: allowedActions,
            maxActivePositions: uint32(maxActivePositions),
            active: true
        });

        emit PolicySet(agentId);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Validation
    // ──────────────────────────────────────────────────────────────────────

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
    ) external view returns (bool valid, string memory reason) {
        Policy storage policy = _policies[agentId];

        // 1. Policy active
        if (!policy.active) return (false, "Policy paused");

        // 2. Expiry
        uint48 _expiry = policy.expiry;
        if (_expiry > 0 && block.timestamp >= _expiry) return (false, "Policy expired");

        // 3. Allowed contracts
        if (policy.allowedContracts.length > 0) {
            bool found = false;
            uint256 contractCount = policy.allowedContracts.length;
            for (uint256 i = 0; i < contractCount;) {
                if (policy.allowedContracts[i] == target) {
                    found = true;
                    break;
                }
                unchecked { ++i; }
            }
            if (!found) return (false, "Contract not in whitelist");
        }

        // 4. Allowed actions
        if (policy.allowedActions.length > 0) {
            bool found = false;
            uint256 actionCount = policy.allowedActions.length;
            for (uint256 i = 0; i < actionCount;) {
                if (policy.allowedActions[i] == action) {
                    found = true;
                    break;
                }
                unchecked { ++i; }
            }
            if (!found) return (false, "Action not allowed");
        }

        // 5. Per-action limit
        uint128 _maxPerAction = policy.maxAmountPerAction;
        if (_maxPerAction > 0 && amount > _maxPerAction) {
            return (false, "Exceeds per-action limit");
        }

        // Cache AgentTracking — single SLOAD for checks 6, 7, 8
        AgentTracking memory tracking = agentTracking[agentId];

        // 6. Daily limit
        uint128 _maxPerDay = policy.maxAmountPerDay;
        if (_maxPerDay > 0) {
            uint128 currentDaily = tracking.dailySpent;
            uint48 currentDay = uint48((block.timestamp / 1 days) * 1 days);
            if (tracking.dailyResetTime < currentDay) {
                currentDaily = 0;
            }
            if (uint256(currentDaily) + amount > _maxPerDay) {
                return (false, "Exceeds daily limit");
            }
        }

        // 7. Frequency limit
        uint32 _freqLimit = policy.frequencyLimit;
        if (_freqLimit > 0) {
            if (block.timestamp < uint256(tracking.lastExecution) + _freqLimit) {
                return (false, "Too soon");
            }
        }

        // 8. Max active positions
        uint32 _maxPositions = policy.maxActivePositions;
        if (_maxPositions > 0 && tracking.activePositions >= _maxPositions) {
            return (false, "Max positions reached");
        }

        return (true, "");
    }

    // ──────────────────────────────────────────────────────────────────────
    //  State Updates (gateway-only)
    // ──────────────────────────────────────────────────────────────────────

    /// @notice Updates tracking state after a successful execution.
    /// @dev Reads AgentTracking into memory, modifies, writes back in one SSTORE.
    /// @param agentId The unique identifier of the agent.
    /// @param amount The value that was executed.
    function updateAfterExecution(uint256 agentId, uint256 amount) external onlyGateway {
        // SafeCast bounds check — prevent silent truncation
        if (amount > type(uint128).max) revert ValueOverflow();

        // Single SLOAD
        AgentTracking memory tracking = agentTracking[agentId];

        uint48 currentDay = uint48((block.timestamp / 1 days) * 1 days);
        if (tracking.dailyResetTime < currentDay) {
            tracking.dailySpent = 0;
            tracking.dailyResetTime = currentDay;
        }

        tracking.dailySpent += uint128(amount);
        tracking.lastExecution = uint48(block.timestamp);
        tracking.activePositions++;

        // Single SSTORE
        agentTracking[agentId] = tracking;
    }

    /// @notice Decrements the active position count for an agent.
    /// @param agentId The unique identifier of the agent.
    function closePosition(uint256 agentId) external onlyGateway {
        AgentTracking memory tracking = agentTracking[agentId];
        if (tracking.activePositions == 0) revert NoActivePositions();
        unchecked { tracking.activePositions--; }
        agentTracking[agentId] = tracking;
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Views
    // ──────────────────────────────────────────────────────────────────────

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
    ) {
        Policy storage policy = _policies[agentId];
        return (
            policy.maxAmountPerAction,
            policy.maxAmountPerDay,
            policy.frequencyLimit,
            policy.expiry,
            policy.maxActivePositions,
            policy.active
        );
    }

    /// @notice Returns the list of whitelisted contract addresses for an agent's policy.
    /// @param agentId The unique identifier of the agent.
    /// @return The array of allowed contract addresses.
    function getPolicyContracts(uint256 agentId) external view returns (address[] memory) {
        return _policies[agentId].allowedContracts;
    }

    /// @notice Returns the list of whitelisted action identifiers for an agent's policy.
    /// @param agentId The unique identifier of the agent.
    /// @return The array of allowed action hashes.
    function getPolicyActions(uint256 agentId) external view returns (bytes32[] memory) {
        return _policies[agentId].allowedActions;
    }
}
