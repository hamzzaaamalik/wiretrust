// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title IFranchiseRegistry
/// @notice Interface for multi-tenant franchise onboarding and management
interface IFranchiseRegistry {
    // ══════════════════════════════════════════════
    //                CUSTOM ERRORS
    // ══════════════════════════════════════════════

    /// @notice Thrown when a zero address is provided where a valid address is required
    error InvalidAddress();

    /// @notice Thrown when the franchise ID is out of valid range
    /// @param franchiseId The invalid franchise ID provided
    /// @param maxFranchiseId The current maximum valid franchise ID
    error InvalidFranchiseId(uint256 franchiseId, uint256 maxFranchiseId);

    /// @notice Thrown when an admin wallet is already assigned to another franchise
    /// @param admin The admin address that is already registered
    error AdminAlreadyRegistered(address admin);

    // ══════════════════════════════════════════════
    //                   STRUCTS
    // ══════════════════════════════════════════════

    struct Franchise {
        uint256 franchiseId;
        string name;
        string league;
        address adminWallet;
        address treasuryWallet;
        bool active;
        uint256 registeredAt;
    }

    // ══════════════════════════════════════════════
    //                   EVENTS
    // ══════════════════════════════════════════════

    /// @notice Emitted when a new franchise is registered
    /// @param franchiseId The ID assigned to the franchise
    /// @param name The franchise display name
    /// @param league The league identifier
    /// @param adminWallet The franchise admin address
    event FranchiseRegistered(
        uint256 indexed franchiseId,
        string name,
        string league,
        address adminWallet
    );

    /// @notice Emitted when a franchise's details are updated
    /// @param franchiseId The ID of the updated franchise
    event FranchiseUpdated(uint256 indexed franchiseId);

    /// @notice Emitted when a franchise is deactivated
    /// @param franchiseId The ID of the deactivated franchise
    event FranchiseDeactivated(uint256 indexed franchiseId);

    /// @notice Emitted when the protocol treasury address is changed
    /// @param newTreasury The new treasury address
    event ProtocolTreasuryUpdated(address indexed newTreasury);

    // ══════════════════════════════════════════════
    //              WRITE FUNCTIONS
    // ══════════════════════════════════════════════

    /// @notice Registers a new franchise in the protocol
    /// @param name Franchise display name
    /// @param league League identifier (e.g., "PSL")
    /// @param adminWallet Franchise admin wallet address
    /// @param treasuryWallet Franchise revenue destination
    /// @return franchiseId The ID assigned to the new franchise
    function registerFranchise(
        string calldata name,
        string calldata league,
        address adminWallet,
        address treasuryWallet
    ) external returns (uint256 franchiseId);

    /// @notice Updates an existing franchise's details
    /// @param franchiseId The ID of the franchise to update
    /// @param name New franchise display name
    /// @param league New league identifier
    /// @param adminWallet New franchise admin wallet address
    /// @param treasuryWallet New franchise treasury wallet address
    function updateFranchise(
        uint256 franchiseId,
        string calldata name,
        string calldata league,
        address adminWallet,
        address treasuryWallet
    ) external;

    /// @notice Deactivates a franchise, preventing new activity
    /// @param franchiseId The ID of the franchise to deactivate
    function deactivateFranchise(uint256 franchiseId) external;

    /// @notice Updates the protocol-level treasury address
    /// @param treasury The new protocol treasury address
    function setProtocolTreasury(address treasury) external;

    // ══════════════════════════════════════════════
    //              VIEW FUNCTIONS
    // ══════════════════════════════════════════════

    /// @notice Retrieves full franchise data by ID
    /// @param franchiseId The franchise ID to look up
    /// @return franchise The franchise struct
    function getFranchise(uint256 franchiseId) external view returns (Franchise memory franchise);

    /// @notice Checks whether an address is the admin of an active franchise
    /// @param addr The address to check
    /// @return isAdmin True if the address admins an active franchise
    /// @return franchiseId The franchise ID the address admins (0 if none)
    function isFranchiseAdmin(address addr) external view returns (bool isAdmin, uint256 franchiseId);

    /// @notice Returns the protocol treasury address
    /// @return treasury The current protocol treasury address
    function getProtocolTreasury() external view returns (address treasury);

    /// @notice Returns the total number of registered franchises
    /// @return count The franchise count
    function franchiseCount() external view returns (uint256 count);
}
