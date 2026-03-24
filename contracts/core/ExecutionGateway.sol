// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IExecutionGateway.sol";
import "../interfaces/IAgentRegistry.sol";
import "../interfaces/IPolicyEngine.sol";
import "../interfaces/IReputationStore.sol";

/// @title ExecutionGateway
/// @notice Core routing contract for WireTrust. Every agent action flows through
///         execute(), which enforces ownership, activation status, target
///         restrictions, nonce uniqueness, policy compliance, fee collection,
///         and reputation bookkeeping in a single atomic transaction.
contract ExecutionGateway is IExecutionGateway, Ownable, ReentrancyGuard {
    // ──────────────────────────────────────────────
    //  Constants
    // ──────────────────────────────────────────────

    /// @notice Protocol fee in basis points (1 % = 100 bps).
    uint256 public constant PROTOCOL_FEE_BPS = 100;

    /// @notice Basis-point denominator used for fee arithmetic.
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // ──────────────────────────────────────────────
    //  Immutables
    // ──────────────────────────────────────────────

    /// @notice Reference to the on-chain agent registry.
    IAgentRegistry public immutable agentRegistry;

    /// @notice Reference to the policy engine that validates executions.
    IPolicyEngine public immutable policyEngine;

    /// @notice Reference to the reputation store that tracks agent outcomes.
    IReputationStore public immutable reputationStore;

    // ──────────────────────────────────────────────
    //  Mutable State
    // ──────────────────────────────────────────────

    /// @notice Address that receives protocol fees.
    address public protocolTreasury;

    /// @notice Tracks consumed nonce hashes for replay protection.
    mapping(bytes32 => bool) public executedHashes;

    /// @notice Addresses that agents are not permitted to call.
    mapping(address => bool) public forbiddenTargets;

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /// @notice Deploy the gateway with references to all core contracts.
    /// @param _registry        Address of the AgentRegistry contract.
    /// @param _policyEngine    Address of the PolicyEngine contract.
    /// @param _reputationStore Address of the ReputationStore contract.
    /// @param _protocolTreasury Address that receives protocol fees.
    constructor(
        address _registry,
        address _policyEngine,
        address _reputationStore,
        address _protocolTreasury
    ) Ownable(msg.sender) {
        if (_registry == address(0)) revert InvalidAddress();
        if (_policyEngine == address(0)) revert InvalidAddress();
        if (_reputationStore == address(0)) revert InvalidAddress();
        if (_protocolTreasury == address(0)) revert InvalidAddress();

        agentRegistry = IAgentRegistry(_registry);
        policyEngine = IPolicyEngine(_policyEngine);
        reputationStore = IReputationStore(_reputationStore);
        protocolTreasury = _protocolTreasury;

        forbiddenTargets[_registry] = true;
        forbiddenTargets[_policyEngine] = true;
        forbiddenTargets[_reputationStore] = true;
        forbiddenTargets[address(this)] = true;
    }

    // ──────────────────────────────────────────────
    //  Core Execution
    // ──────────────────────────────────────────────

    /// @inheritdoc IExecutionGateway
    ///
    /// @dev Execution pipeline (all steps are sequential and atomic):
    ///
    ///  Ownership   — msg.sender must be the agent's registered owner.
    ///  Active      — the agent must not be deactivated.
    ///  Forbidden   — target must not appear in the forbidden-target set.
    ///  Nonce       — keccak256(agentId, nonce) must not have been consumed.
    ///  Policy      — policyEngine.validateExecution must approve the action.
    ///  Fee         — PROTOCOL_FEE_BPS is deducted from msg.value (if any).
    ///  Call        — remaining value is forwarded to target with calldata.
    ///  Reputation  — outcome (success / failure / violation) is recorded.
    ///
    ///  Design notes:
    ///   - The nonce is consumed *before* policy validation so that a rejected
    ///     action cannot be replayed with the same nonce.
    ///   - Policy violations return false instead of reverting. This ensures
    ///     that the nonce consumption and reputation penalty are persisted
    ///     on-chain, providing a tamper-proof audit trail.
    function execute(
        uint256 agentId,
        address target,
        bytes32 action,
        bytes calldata data,
        uint256 amount,
        bytes32 nonce
    ) external payable nonReentrant returns (bool) {
        uint256 gasStart = gasleft();

        if (msg.value != amount) revert ValueMismatch();

        // Gas optimization: use getAgentOwnerAndStatus instead of getAgent
        // to avoid copying strings (name, botType) to memory (~2,000-5,000 gas saved)
        (address agentOwner, bool agentActive) = agentRegistry.getAgentOwnerAndStatus(agentId);
        if (agentOwner != msg.sender) revert NotAgentOwner();
        if (!agentActive) revert AgentNotActive();
        if (forbiddenTargets[target]) revert ForbiddenTarget(target);

        // Gas optimization: inline assembly for nonce hash (~50-100 gas saved)
        bytes32 nonceHash;
        assembly {
            mstore(0x00, agentId)
            mstore(0x20, nonce)
            nonceHash := keccak256(0x00, 0x40)
        }
        if (executedHashes[nonceHash]) revert NonceAlreadyUsed(nonceHash);

        (bool valid, string memory reason) = policyEngine.validateExecution(
            agentId, target, action, amount
        );

        executedHashes[nonceHash] = true;

        if (!valid) {
            uint256 gasUsedViolation = gasStart - gasleft();
            reputationStore.recordViolation(agentId, gasUsedViolation);
            emit AgentViolation(agentId, target, action, reason, block.timestamp);
            // Refund ETH on violation
            if (msg.value > 0) {
                (bool refunded,) = msg.sender.call{value: msg.value}("");
                if (!refunded) revert FeeTransferFailed();
            }
            return false;
        }

        uint256 forwardAmount = amount;
        if (amount > 0) {
            forwardAmount = _collectFee(amount);
        }

        (bool callSuccess, ) = target.call{value: forwardAmount}(data);

        uint256 gasUsed = gasStart - gasleft();

        if (!callSuccess) {
            reputationStore.recordFailure(agentId, gasUsed);
            emit AgentExecuted(agentId, action, false, gasUsed, block.timestamp);
            // Refund remaining ETH on call failure
            if (forwardAmount > 0) {
                (bool refunded, ) = msg.sender.call{value: forwardAmount}("");
                refunded; // silence unused-variable warning — refund is best-effort
                // Don't revert if refund fails — fee already collected, just emit
            }
            return false;
        }

        policyEngine.updateAfterExecution(agentId, amount);
        reputationStore.recordSuccess(agentId, gasUsed);

        emit AgentExecuted(agentId, action, true, gasUsed, block.timestamp);
        return true;
    }

    // ──────────────────────────────────────────────
    //  Agent Actions
    // ──────────────────────────────────────────────

    /// @inheritdoc IExecutionGateway
    function closeAgentPosition(uint256 agentId) external {
        // Gas optimization: use getAgentOwnerAndStatus instead of getAgent
        (address agentOwner, ) = agentRegistry.getAgentOwnerAndStatus(agentId);
        if (agentOwner != msg.sender) revert NotAgentOwner();
        policyEngine.closePosition(agentId);
    }

    // ──────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────

    /// @inheritdoc IExecutionGateway
    function setForbiddenTarget(address target, bool forbidden) external onlyOwner {
        forbiddenTargets[target] = forbidden;
        emit ForbiddenTargetUpdated(target, forbidden);
    }

    /// @inheritdoc IExecutionGateway
    function setProtocolTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert InvalidAddress();
        protocolTreasury = _treasury;
        emit ProtocolTreasuryUpdated(_treasury);
    }

    /// @inheritdoc IExecutionGateway
    function sweepETH(address to) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        uint256 balance = address(this).balance;
        if (balance == 0) revert NoBalance();
        (bool sent,) = to.call{value: balance}("");
        if (!sent) revert FeeTransferFailed();
        emit ETHSwept(to, balance);
    }

    // ──────────────────────────────────────────────
    //  Internal
    // ──────────────────────────────────────────────

    /// @notice Deduct the protocol fee from an ETH amount and send it to the treasury.
    /// @param amount The gross ETH amount before fees.
    /// @return netAmount The amount remaining after fee deduction.
    function _collectFee(uint256 amount) internal returns (uint256 netAmount) {
        // Gas optimization: unchecked fee arithmetic (safe because BPS values are constants
        // and amount * 100 cannot realistically overflow uint256)
        uint256 fee;
        unchecked {
            fee = (amount * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        }
        if (fee > 0) {
            // Gas optimization: cache protocolTreasury to avoid a second SLOAD
            address treasury = protocolTreasury;
            (bool sent, ) = treasury.call{value: fee}("");
            if (!sent) revert FeeTransferFailed();
        }
        unchecked {
            return amount - fee;
        }
    }

    /// @notice Accept ETH deposits (e.g., refunds from failed calls).
    receive() external payable {}
}
