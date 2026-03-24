// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IFranchiseRegistry.sol";

/// @title FranchiseRegistry
/// @notice Multi-tenant franchise onboarding. Any sports franchise registers here.
/// @dev Franchise-agnostic — PSL, IPL, any league can onboard.
contract FranchiseRegistry is IFranchiseRegistry, Ownable {
    // ══════════════════════════════════════════════
    //              STATE VARIABLES
    // ══════════════════════════════════════════════

    mapping(uint256 => Franchise) private _franchises;
    mapping(address => uint256) public adminToFranchise;
    uint256 public franchiseCount;
    address public protocolTreasury;

    // ══════════════════════════════════════════════
    //                CONSTRUCTOR
    // ══════════════════════════════════════════════

    constructor(address _protocolTreasury) Ownable(msg.sender) {
        if (_protocolTreasury == address(0)) revert InvalidAddress();
        protocolTreasury = _protocolTreasury;
    }

    // ══════════════════════════════════════════════
    //            EXTERNAL WRITE FUNCTIONS
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
    ) external onlyOwner returns (uint256 franchiseId) {
        if (adminWallet == address(0)) revert InvalidAddress();
        if (treasuryWallet == address(0)) revert InvalidAddress();
        if (adminToFranchise[adminWallet] != 0) revert AdminAlreadyRegistered(adminWallet);

        unchecked {
            franchiseCount++;
        }
        franchiseId = franchiseCount;

        _franchises[franchiseId] = Franchise({
            franchiseId: franchiseId,
            name: name,
            league: league,
            adminWallet: adminWallet,
            treasuryWallet: treasuryWallet,
            active: true,
            registeredAt: block.timestamp
        });

        adminToFranchise[adminWallet] = franchiseId;

        emit FranchiseRegistered(franchiseId, name, league, adminWallet);
    }

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
    ) external onlyOwner {
        _validateFranchiseId(franchiseId);

        Franchise storage franchise = _franchises[franchiseId];

        if (franchise.adminWallet != adminWallet) {
            if (adminWallet == address(0)) revert InvalidAddress();
            // Allow reassigning same admin to same franchise, but block if used elsewhere
            if (adminToFranchise[adminWallet] != 0 && adminToFranchise[adminWallet] != franchiseId) {
                revert AdminAlreadyRegistered(adminWallet);
            }
            delete adminToFranchise[franchise.adminWallet];
            adminToFranchise[adminWallet] = franchiseId;
        }

        if (treasuryWallet == address(0)) revert InvalidAddress();

        franchise.name = name;
        franchise.league = league;
        franchise.adminWallet = adminWallet;
        franchise.treasuryWallet = treasuryWallet;

        emit FranchiseUpdated(franchiseId);
    }

    /// @notice Deactivates a franchise, preventing new activity
    /// @param franchiseId The ID of the franchise to deactivate
    function deactivateFranchise(uint256 franchiseId) external onlyOwner {
        _validateFranchiseId(franchiseId);
        Franchise storage franchise = _franchises[franchiseId];
        delete adminToFranchise[franchise.adminWallet];
        franchise.active = false;
        emit FranchiseDeactivated(franchiseId);
    }

    /// @notice Updates the protocol-level treasury address
    /// @param treasury The new protocol treasury address
    function setProtocolTreasury(address treasury) external onlyOwner {
        if (treasury == address(0)) revert InvalidAddress();
        protocolTreasury = treasury;
        emit ProtocolTreasuryUpdated(treasury);
    }

    // ══════════════════════════════════════════════
    //            EXTERNAL VIEW FUNCTIONS
    // ══════════════════════════════════════════════

    /// @notice Retrieves full franchise data by ID
    /// @param franchiseId The franchise ID to look up
    /// @return franchise The franchise struct
    function getFranchise(uint256 franchiseId) external view returns (Franchise memory franchise) {
        _validateFranchiseId(franchiseId);
        return _franchises[franchiseId];
    }

    /// @notice Checks whether an address is the admin of an active franchise
    /// @param addr The address to check
    /// @return isAdmin True if the address admins an active franchise
    /// @return franchiseId The franchise ID the address admins (0 if none)
    function isFranchiseAdmin(address addr) external view returns (bool isAdmin, uint256 franchiseId) {
        franchiseId = adminToFranchise[addr];
        isAdmin = franchiseId > 0 && _franchises[franchiseId].active;
    }

    /// @notice Returns the protocol treasury address
    /// @return treasury The current protocol treasury address
    function getProtocolTreasury() external view returns (address treasury) {
        return protocolTreasury;
    }

    // ══════════════════════════════════════════════
    //            INTERNAL FUNCTIONS
    // ══════════════════════════════════════════════

    /// @notice Validates that a franchise ID is within the valid range
    /// @param franchiseId The franchise ID to validate
    function _validateFranchiseId(uint256 franchiseId) internal view {
        if (franchiseId == 0 || franchiseId > franchiseCount) {
            revert InvalidFranchiseId(franchiseId, franchiseCount);
        }
    }
}
