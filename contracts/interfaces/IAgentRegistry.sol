// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title IAgentRegistry
/// @notice Interface for fan-agent identity and lifecycle management
interface IAgentRegistry {
    // ══════════════════════════════════════════════
    //                CUSTOM ERRORS
    // ══════════════════════════════════════════════

    /// @notice Thrown when a zero address is provided where a valid address is required
    error InvalidAddress();

    /// @notice Thrown when the agent ID is out of valid range
    /// @param agentId The invalid agent ID provided
    /// @param maxAgentId The current maximum valid agent ID
    error InvalidAgentId(uint256 agentId, uint256 maxAgentId);

    /// @notice Thrown when a required string parameter is empty
    error EmptyString();

    /// @notice Thrown when the referenced franchise is not active
    /// @param franchiseId The franchise ID that is not active
    error FranchiseNotActive(uint256 franchiseId);

    /// @notice Thrown when the caller is not the agent's owner
    /// @param caller The address that attempted the action
    /// @param owner The actual owner of the agent
    error NotAgentOwner(address caller, address owner);

    /// @notice Thrown when trying to deactivate an already inactive agent
    /// @param agentId The agent ID that is already inactive
    error AgentAlreadyInactive(uint256 agentId);

    /// @notice Thrown when trying to reactivate an already active agent
    /// @param agentId The agent ID that is already active
    error AgentAlreadyActive(uint256 agentId);

    // ══════════════════════════════════════════════
    //                   STRUCTS
    // ══════════════════════════════════════════════

    struct Agent {
        address owner;
        string name;
        string botType;
        uint256 franchiseId;
        uint256 createdAt;
        bool active;
    }

    // ══════════════════════════════════════════════
    //                   EVENTS
    // ══════════════════════════════════════════════

    /// @notice Emitted when a new agent is created
    /// @param agentId The ID assigned to the agent
    /// @param owner The owner address of the agent
    /// @param name The agent display name
    /// @param botType The agent bot type
    /// @param franchiseId The franchise the agent belongs to
    /// @param timestamp The creation timestamp
    event AgentCreated(
        uint256 indexed agentId,
        address indexed owner,
        string name,
        string botType,
        uint256 indexed franchiseId,
        uint256 timestamp
    );

    /// @notice Emitted when an agent is deactivated
    /// @param agentId The ID of the deactivated agent
    event AgentDeactivated(uint256 indexed agentId);

    /// @notice Emitted when an agent is reactivated
    /// @param agentId The ID of the reactivated agent
    event AgentReactivated(uint256 indexed agentId);

    // ══════════════════════════════════════════════
    //              WRITE FUNCTIONS
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
    ) external returns (uint256 agentId);

    /// @notice Deactivates an agent (only callable by agent owner)
    /// @param agentId The ID of the agent to deactivate
    function deactivateAgent(uint256 agentId) external;

    /// @notice Reactivates a previously deactivated agent (only callable by agent owner)
    /// @param agentId The ID of the agent to reactivate
    function reactivateAgent(uint256 agentId) external;

    // ══════════════════════════════════════════════
    //              VIEW FUNCTIONS
    // ══════════════════════════════════════════════

    /// @notice Retrieves full agent data by ID
    /// @param agentId The agent ID to look up
    /// @return agent The agent struct
    function getAgent(uint256 agentId) external view returns (Agent memory agent);

    /// @notice Lightweight view that returns only the owner and active status of an agent.
    ///         Avoids copying strings (name, botType) to memory, saving ~2,000-5,000 gas
    ///         compared to getAgent() when only ownership and status checks are needed.
    /// @param agentId The agent ID to look up
    /// @return owner The owner address of the agent
    /// @return active Whether the agent is currently active
    function getAgentOwnerAndStatus(uint256 agentId) external view returns (address owner, bool active);

    /// @notice Returns all agent IDs owned by an address
    /// @param addr The owner address to query
    /// @return agentIds Array of agent IDs owned by the address
    function getAgentsByOwner(address addr) external view returns (uint256[] memory agentIds);

    /// @notice Checks whether an agent exists and is active
    /// @param agentId The agent ID to check
    /// @return active True if the agent exists and is active
    function isActiveAgent(uint256 agentId) external view returns (bool active);

    /// @notice Returns the total number of registered agents
    /// @return count The agent count
    function agentCount() external view returns (uint256 count);
}
