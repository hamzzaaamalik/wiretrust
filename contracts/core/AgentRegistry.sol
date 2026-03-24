// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IAgentRegistry.sol";
import "../interfaces/IFranchiseRegistry.sol";

/// @title AgentRegistry
/// @notice Bot identity and ownership, franchise-scoped.
/// @dev Every fan agent belongs to a franchise ecosystem.
///      Inherits Ownable for future protocol-level admin controls (e.g., emergency pause, migration).
contract AgentRegistry is IAgentRegistry, Ownable {
    // ══════════════════════════════════════════════
    //              STATE VARIABLES
    // ══════════════════════════════════════════════

    /// @notice Reference to the franchise registry for franchise validation
    IFranchiseRegistry public immutable franchiseRegistry;

    mapping(uint256 => Agent) private _agents;
    mapping(address => uint256[]) private _ownerAgents;
    uint256 public agentCount;

    // ══════════════════════════════════════════════
    //                CONSTRUCTOR
    // ══════════════════════════════════════════════

    constructor(address _franchiseRegistry) Ownable(msg.sender) {
        if (_franchiseRegistry == address(0)) revert InvalidAddress();
        franchiseRegistry = IFranchiseRegistry(_franchiseRegistry);
    }

    // ══════════════════════════════════════════════
    //            EXTERNAL WRITE FUNCTIONS
    // ══════════════════════════════════════════════

    /// @notice Creates a new fan agent scoped to a franchise
    /// @param name Agent display name
    /// @param botType Agent bot type identifier
    /// @param franchiseId The franchise to associate the agent with
    /// @return agentId The ID assigned to the new agent
    function createAgent(
        string calldata name,
        string calldata botType,
        uint256 franchiseId
    ) external returns (uint256 agentId) {
        if (bytes(name).length == 0) revert EmptyString();
        if (bytes(botType).length == 0) revert EmptyString();

        IFranchiseRegistry.Franchise memory franchise = franchiseRegistry.getFranchise(franchiseId);
        if (!franchise.active) revert FranchiseNotActive(franchiseId);

        unchecked {
            agentCount++;
        }
        agentId = agentCount;

        _agents[agentId] = Agent({
            owner: msg.sender,
            name: name,
            botType: botType,
            franchiseId: franchiseId,
            createdAt: block.timestamp,
            active: true
        });

        _ownerAgents[msg.sender].push(agentId);

        emit AgentCreated(agentId, msg.sender, name, botType, franchiseId, block.timestamp);
    }

    /// @notice Deactivates an agent (only callable by agent owner)
    /// @param agentId The ID of the agent to deactivate
    function deactivateAgent(uint256 agentId) external {
        _validateAgentId(agentId);
        Agent storage agent = _agents[agentId];
        if (agent.owner != msg.sender) revert NotAgentOwner(msg.sender, agent.owner);
        if (!agent.active) revert AgentAlreadyInactive(agentId);

        agent.active = false;
        emit AgentDeactivated(agentId);
    }

    /// @notice Reactivates a previously deactivated agent (only callable by agent owner)
    /// @param agentId The ID of the agent to reactivate
    function reactivateAgent(uint256 agentId) external {
        _validateAgentId(agentId);
        Agent storage agent = _agents[agentId];
        if (agent.owner != msg.sender) revert NotAgentOwner(msg.sender, agent.owner);
        if (agent.active) revert AgentAlreadyActive(agentId);

        IFranchiseRegistry.Franchise memory franchise = franchiseRegistry.getFranchise(agent.franchiseId);
        if (!franchise.active) revert FranchiseNotActive(agent.franchiseId);

        agent.active = true;
        emit AgentReactivated(agentId);
    }

    // ══════════════════════════════════════════════
    //            EXTERNAL VIEW FUNCTIONS
    // ══════════════════════════════════════════════

    /// @notice Retrieves full agent data by ID
    /// @param agentId The agent ID to look up
    /// @return agent The agent struct
    function getAgent(uint256 agentId) external view returns (Agent memory agent) {
        _validateAgentId(agentId);
        return _agents[agentId];
    }

    /// @notice Lightweight view that returns only the owner and active status of an agent.
    ///         Avoids copying strings (name, botType) to memory, saving ~2,000-5,000 gas
    ///         compared to getAgent() when only ownership and status checks are needed.
    /// @param agentId The agent ID to look up
    /// @return owner The owner address of the agent
    /// @return active Whether the agent is currently active
    function getAgentOwnerAndStatus(uint256 agentId) external view returns (address owner, bool active) {
        _validateAgentId(agentId);
        Agent storage agent = _agents[agentId];
        owner = agent.owner;
        active = agent.active;
    }

    /// @notice Returns all agent IDs owned by an address
    /// @param addr The owner address to query
    /// @return agentIds Array of agent IDs owned by the address
    function getAgentsByOwner(address addr) external view returns (uint256[] memory agentIds) {
        return _ownerAgents[addr];
    }

    /// @notice Checks whether an agent exists and is active
    /// @param agentId The agent ID to check
    /// @return active True if the agent exists and is active
    function isActiveAgent(uint256 agentId) external view returns (bool active) {
        if (agentId == 0 || agentId > agentCount) return false;
        return _agents[agentId].active;
    }

    // ══════════════════════════════════════════════
    //            INTERNAL FUNCTIONS
    // ══════════════════════════════════════════════

    /// @notice Validates that an agent ID is within the valid range
    /// @param agentId The agent ID to validate
    function _validateAgentId(uint256 agentId) internal view {
        if (agentId == 0 || agentId > agentCount) {
            revert InvalidAgentId(agentId, agentCount);
        }
    }
}
