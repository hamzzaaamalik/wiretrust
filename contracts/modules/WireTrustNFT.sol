// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IFranchiseRegistry.sol";

/// @title WireTrustNFT
/// @notice ERC-721 contract for franchise-scoped tickets, experiences,
///         collectibles, badges, and merchandise. Enforces soulbound rules,
///         transfer caps, event expiry, and anti-scalping price caps at the
///         token-transfer level via the `_update` override.
contract WireTrustNFT is ERC721, Ownable, ReentrancyGuard {
    // -----------------------------------------------------------------------
    // Custom Errors
    // -----------------------------------------------------------------------

    error ZeroAddress();
    error NotFranchiseAdmin();
    error OnlyProtocolMintsBadges();
    error EventMustBeInFuture();
    error BatchTooLarge(uint256 provided, uint256 max);
    error NotTokenOwner();
    error IncorrectPayment(uint256 required, uint256 provided);
    error ExceedsResalePriceCap(uint256 price, uint256 max);
    error SoulboundToken();
    error TokenNotValid();
    error MaxTransfersReached();
    error TokenExpired();
    error NoExpirySet();
    error NotYetExpired();
    error AlreadyBurnedOrUsed();
    error TransferFailed();
    error UseTransferWithPrice();
    error InvalidEventTimestamp();

    // -----------------------------------------------------------------------
    // Enums & Structs
    // -----------------------------------------------------------------------

    enum NFTCategory { TICKET, EXPERIENCE, COLLECTIBLE, BADGE, MERCHANDISE }
    enum TokenStatus { VALID, USED, EXPIRED, CANCELLED }

    struct NFTMetadata {
        uint256 tokenId;
        uint256 franchiseId;
        string name;
        string description;
        string metadataURI;
        uint256 facePrice;
        uint256 maxResalePrice;
        uint256 eventTimestamp;
        uint256 mintedAt;
        NFTCategory category;      // uint8
        TokenStatus status;        // uint8
        uint8 maxTransfers;
        uint8 transferCount;
        bool soulbound;            // all 5 fields pack into 1 slot
    }

    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------

    uint256 public constant PROTOCOL_FEE_BPS = 250; // 2.5%
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_BATCH_SIZE = 100;
    uint256 public constant RESALE_CAP_PERCENT = 110;
    uint8 public constant UNLIMITED_TRANSFERS = type(uint8).max;

    // -----------------------------------------------------------------------
    // Immutable State
    // -----------------------------------------------------------------------

    IFranchiseRegistry public immutable franchiseRegistry;
    address public immutable protocolTreasury;

    // -----------------------------------------------------------------------
    // Mutable State
    // -----------------------------------------------------------------------

    mapping(uint256 => NFTMetadata) public nftData;
    uint256 public tokenCount;

    mapping(address => uint256[]) private _ownerTokens;
    mapping(uint256 => uint256) private _ownerTokenIndex;
    mapping(uint256 => mapping(uint256 => uint256[])) private _franchiseCategoryTokens;
    mapping(uint256 => bool) private _transferApproved;

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    event NFTMinted(uint256 indexed tokenId, uint256 indexed franchiseId, NFTCategory category, address to, uint256 facePrice);
    event NFTTransferred(uint256 indexed tokenId, address from, address to, uint256 price, uint8 transferCount);
    event NFTVerified(uint256 indexed tokenId, address verifiedBy);
    event NFTBurned(uint256 indexed tokenId, string reason);
    event NFTCancelled(uint256 indexed tokenId, uint256 indexed franchiseId);

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    constructor(
        address _franchiseRegistry,
        address _protocolTreasury
    ) ERC721("WireTrust NFT", "WTNFT") Ownable(msg.sender) {
        if (_franchiseRegistry == address(0)) revert ZeroAddress();
        if (_protocolTreasury == address(0)) revert ZeroAddress();

        franchiseRegistry = IFranchiseRegistry(_franchiseRegistry);
        protocolTreasury = _protocolTreasury;
    }

    // -----------------------------------------------------------------------
    // Internal — ERC-721 Transfer Hook
    // -----------------------------------------------------------------------

    /// @dev Overrides the ERC-721 `_update` hook so that ALL transfer paths
    ///      (transferFrom, safeTransferFrom, _transfer, etc.) are subject to
    ///      WireTrust business rules: soulbound checks, token validity,
    ///      max-transfer limits, and event-expiry enforcement. This single
    ///      chokepoint guarantees that no transfer can bypass these invariants.
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);

        // Enforce rules only on real transfers (not mint / burn)
        if (from != address(0) && to != address(0)) {
            // With packed struct, category/status/maxTransfers/transferCount/soulbound
            // are in a single slot — one SLOAD reads all five fields.
            NFTMetadata storage metadata = nftData[tokenId];
            if (metadata.soulbound) revert SoulboundToken();
            if (metadata.status != TokenStatus.VALID) revert TokenNotValid();
            if (metadata.category == NFTCategory.TICKET || metadata.category == NFTCategory.EXPERIENCE) {
                if (!_transferApproved[tokenId]) revert UseTransferWithPrice();
            }
            if (metadata.maxTransfers != UNLIMITED_TRANSFERS) {
                if (metadata.transferCount >= metadata.maxTransfers) revert MaxTransfersReached();
            }
            if (metadata.eventTimestamp > 0 && block.timestamp >= metadata.eventTimestamp) {
                revert TokenExpired();
            }
            // transferCount is bounded by maxTransfers check above; safe to use unchecked
            unchecked {
                metadata.transferCount++;
            }
        }

        // Track owner tokens — remove from previous owner (O(1) swap-and-pop)
        if (from != address(0)) {
            uint256[] storage fromTokens = _ownerTokens[from];
            uint256 idx = _ownerTokenIndex[tokenId];
            uint256 lastIdx;
            unchecked { lastIdx = fromTokens.length - 1; }
            if (idx != lastIdx) {
                uint256 lastTokenId = fromTokens[lastIdx];
                fromTokens[idx] = lastTokenId;
                _ownerTokenIndex[lastTokenId] = idx;
            }
            fromTokens.pop();
            delete _ownerTokenIndex[tokenId];
        }

        // Track owner tokens — add to new owner
        if (to != address(0)) {
            _ownerTokenIndex[tokenId] = _ownerTokens[to].length;
            _ownerTokens[to].push(tokenId);
        }

        return super._update(to, tokenId, auth);
    }

    // -----------------------------------------------------------------------
    // Internal — Category Rules
    // -----------------------------------------------------------------------

    /// @dev Returns default resale cap, max transfers, and soulbound flag for
    ///      each NFT category.
    /// @param category  The NFT category.
    /// @param facePrice The face price (used to compute resale cap).
    /// @return maxResale  Maximum allowed resale price (0 = no cap).
    /// @return maxTx      Maximum number of secondary transfers.
    /// @return isSoulbound Whether the token is non-transferable.
    function _categoryRules(
        NFTCategory category,
        uint256 facePrice
    ) internal pure returns (uint256 maxResale, uint8 maxTx, bool isSoulbound) {
        if (category == NFTCategory.TICKET) {
            return ((facePrice * RESALE_CAP_PERCENT) / 100, 1, false);
        } else if (category == NFTCategory.EXPERIENCE) {
            return ((facePrice * RESALE_CAP_PERCENT) / 100, 1, false);
        } else if (category == NFTCategory.COLLECTIBLE) {
            return (0, UNLIMITED_TRANSFERS, false);
        } else if (category == NFTCategory.BADGE) {
            return (0, 0, true);
        } else if (category == NFTCategory.MERCHANDISE) {
            return (0, UNLIMITED_TRANSFERS, false);
        }
        return (0, 0, false);
    }

    // -----------------------------------------------------------------------
    // External / Public — Mutative
    // -----------------------------------------------------------------------

    /// @notice Mint a single NFT to a recipient address.
    /// @param to           The address receiving the token.
    /// @param franchiseId  The franchise that issues this NFT.
    /// @param category     The NFT category (TICKET, EXPERIENCE, etc.).
    /// @param name         Human-readable token name.
    /// @param description  Token description.
    /// @param metadataURI  Off-chain metadata URI.
    /// @param facePrice    Original price in native token units (used for resale cap).
    /// @param eventTimestamp Unix timestamp of the associated event (0 if none).
    /// @return The newly assigned token ID.
    function mint(
        address to,
        uint256 franchiseId,
        NFTCategory category,
        string calldata name,
        string calldata description,
        string calldata metadataURI,
        uint256 facePrice,
        uint256 eventTimestamp
    ) external nonReentrant returns (uint256) {
        if (category != NFTCategory.BADGE) {
            (bool isAdmin, uint256 adminFranchise) = franchiseRegistry.isFranchiseAdmin(msg.sender);
            if (!(isAdmin && adminFranchise == franchiseId) && msg.sender != owner()) {
                revert NotFranchiseAdmin();
            }
        } else {
            if (msg.sender != owner()) revert OnlyProtocolMintsBadges();
        }

        if (category == NFTCategory.TICKET || category == NFTCategory.EXPERIENCE) {
            if (eventTimestamp <= block.timestamp) revert EventMustBeInFuture();
        }

        uint256 id;
        unchecked {
            id = ++tokenCount;
        }

        (uint256 maxResale, uint8 maxTx, bool isSoulbound) = _categoryRules(category, facePrice);

        nftData[id] = NFTMetadata({
            tokenId: id,
            franchiseId: franchiseId,
            name: name,
            description: description,
            metadataURI: metadataURI,
            facePrice: facePrice,
            maxResalePrice: maxResale,
            eventTimestamp: eventTimestamp,
            mintedAt: block.timestamp,
            category: category,
            status: TokenStatus.VALID,
            maxTransfers: maxTx,
            transferCount: 0,
            soulbound: isSoulbound
        });

        _safeMint(to, id);
        _franchiseCategoryTokens[franchiseId][uint256(category)].push(id);

        emit NFTMinted(id, franchiseId, category, to, facePrice);
        return id;
    }

    /// @notice Mint the same NFT template to multiple recipients in one transaction.
    /// @param recipients   Array of addresses to mint to (max `MAX_BATCH_SIZE`).
    /// @param franchiseId  The franchise that issues these NFTs.
    /// @param category     The NFT category.
    /// @param name         Human-readable token name.
    /// @param description  Token description.
    /// @param metadataURI  Off-chain metadata URI.
    /// @param facePrice    Original price in native token units.
    /// @param eventTimestamp Unix timestamp of the associated event (0 if none).
    /// @return ids Array of newly assigned token IDs.
    function mintBatch(
        address[] calldata recipients,
        uint256 franchiseId,
        NFTCategory category,
        string calldata name,
        string calldata description,
        string calldata metadataURI,
        uint256 facePrice,
        uint256 eventTimestamp
    ) external nonReentrant returns (uint256[] memory ids) {
        uint256 count = recipients.length;
        if (count > MAX_BATCH_SIZE) revert BatchTooLarge(count, MAX_BATCH_SIZE);

        if (category != NFTCategory.BADGE) {
            (bool isAdmin, uint256 adminFranchise) = franchiseRegistry.isFranchiseAdmin(msg.sender);
            if (!(isAdmin && adminFranchise == franchiseId) && msg.sender != owner()) {
                revert NotFranchiseAdmin();
            }
        } else {
            if (msg.sender != owner()) revert OnlyProtocolMintsBadges();
        }

        if (category == NFTCategory.TICKET || category == NFTCategory.EXPERIENCE) {
            if (eventTimestamp <= block.timestamp) revert EventMustBeInFuture();
        }

        (uint256 maxResale, uint8 maxTx, bool isSoulbound) = _categoryRules(category, facePrice);

        // Cache uint256(category) before the loop to avoid repeated conversion
        uint256 categoryUint = uint256(category);

        ids = new uint256[](count);
        uint256 currentId = tokenCount;

        for (uint256 i = 0; i < count; ) {
            unchecked { ++currentId; }
            uint256 id = currentId;

            nftData[id] = NFTMetadata({
                tokenId: id,
                franchiseId: franchiseId,
                name: name,
                description: description,
                metadataURI: metadataURI,
                facePrice: facePrice,
                maxResalePrice: maxResale,
                eventTimestamp: eventTimestamp,
                mintedAt: block.timestamp,
                category: category,
                status: TokenStatus.VALID,
                maxTransfers: maxTx,
                transferCount: 0,
                soulbound: isSoulbound
            });

            _safeMint(recipients[i], id);
            _franchiseCategoryTokens[franchiseId][categoryUint].push(id);

            ids[i] = id;
            emit NFTMinted(id, franchiseId, category, recipients[i], facePrice);

            unchecked { ++i; }
        }

        // Write tokenCount once after the loop instead of per iteration
        tokenCount = currentId;
    }

    /// @notice Transfer a token while collecting payment from the caller.
    ///         **Design note:** The current owner (seller) calls this function,
    ///         passing in `msg.value` equal to the agreed `price`. The NFT is
    ///         transferred to `to` (the buyer). The seller receives the proceeds
    ///         minus the protocol fee. This is an unusual flow compared to a
    ///         typical marketplace where a buyer calls and the seller lists; here
    ///         the seller initiates, so the buyer must have already sent funds to
    ///         the seller off-chain or through an escrow wrapper.
    /// @param tokenId The token to transfer.
    /// @param to      The recipient (buyer).
    /// @param price   The agreed sale price; must equal msg.value.
    function transferWithPrice(
        uint256 tokenId,
        address to,
        uint256 price
    ) external payable nonReentrant {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (msg.value != price) revert IncorrectPayment(price, msg.value);

        NFTMetadata storage metadata = nftData[tokenId];

        if (metadata.maxResalePrice > 0) {
            if (price > metadata.maxResalePrice) {
                revert ExceedsResalePriceCap(price, metadata.maxResalePrice);
            }
        }

        // _transfer calls _update which enforces soulbound, status,
        // maxTransfers, expiry, transferCount, and owner tracking.
        _transferApproved[tokenId] = true;
        _transfer(msg.sender, to, tokenId);
        delete _transferApproved[tokenId];

        uint256 fee = (price * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        if (fee > 0) {
            (bool feeSent, ) = protocolTreasury.call{value: fee}("");
            if (!feeSent) revert TransferFailed();
        }
        uint256 sellerProceeds = price - fee;
        if (sellerProceeds > 0) {
            (bool sellerSent, ) = payable(msg.sender).call{value: sellerProceeds}("");
            if (!sellerSent) revert TransferFailed();
        }

        emit NFTTransferred(tokenId, msg.sender, to, price, metadata.transferCount);
    }

    /// @notice Mark a token as USED at an event venue. Only the franchise admin
    ///         or protocol owner may call.
    /// @param tokenId The token to verify.
    function verifyAtVenue(uint256 tokenId) external {
        NFTMetadata storage metadata = nftData[tokenId];

        (bool isAdmin, uint256 adminFranchise) = franchiseRegistry.isFranchiseAdmin(msg.sender);
        if (!(isAdmin && adminFranchise == metadata.franchiseId) && msg.sender != owner()) {
            revert NotFranchiseAdmin();
        }
        if (metadata.status != TokenStatus.VALID) revert TokenNotValid();

        metadata.status = TokenStatus.USED;
        emit NFTVerified(tokenId, msg.sender);
    }

    /// @notice Burn a token whose event timestamp has passed. Anyone may call.
    /// @param tokenId The token to burn.
    function burnExpired(uint256 tokenId) external {
        NFTMetadata storage metadata = nftData[tokenId];
        if (metadata.eventTimestamp == 0) revert NoExpirySet();
        if (block.timestamp < metadata.eventTimestamp) revert NotYetExpired();
        if (metadata.status != TokenStatus.VALID) revert AlreadyBurnedOrUsed();

        metadata.status = TokenStatus.EXPIRED;
        _burn(tokenId);

        emit NFTBurned(tokenId, "expired");
    }

    /// @notice Cancel a token, preventing further transfers or use.
    ///         Only the franchise admin or protocol owner may call.
    /// @param tokenId The token to cancel.
    function cancelToken(uint256 tokenId) external {
        NFTMetadata storage metadata = nftData[tokenId];

        if (metadata.status != TokenStatus.VALID) revert TokenNotValid();

        (bool isAdmin, uint256 adminFranchise) = franchiseRegistry.isFranchiseAdmin(msg.sender);
        if (!(isAdmin && adminFranchise == metadata.franchiseId) && msg.sender != owner()) {
            revert NotFranchiseAdmin();
        }

        metadata.status = TokenStatus.CANCELLED;
        emit NFTCancelled(tokenId, metadata.franchiseId);
    }

    // -----------------------------------------------------------------------
    // External — View
    // -----------------------------------------------------------------------

    /// @notice Return all token IDs currently owned by an address.
    /// @param owner_ The address to query.
    /// @return Array of token IDs.
    function getTokensByOwner(address owner_) external view returns (uint256[] memory) {
        return _ownerTokens[owner_];
    }

    /// @notice Return all token IDs minted under a franchise + category pair.
    /// @param franchiseId The franchise to query.
    /// @param category    The NFT category to filter by.
    /// @return Array of token IDs.
    function getTokensByCategory(
        uint256 franchiseId,
        NFTCategory category
    ) external view returns (uint256[] memory) {
        return _franchiseCategoryTokens[franchiseId][uint256(category)];
    }

    /// @notice Return the full metadata struct for a token.
    /// @param tokenId The token to look up.
    /// @return The NFTMetadata struct.
    function getFullMetadata(uint256 tokenId) external view returns (NFTMetadata memory) {
        return nftData[tokenId];
    }

    /// @notice Check whether a token was minted by this contract and has not
    ///         been cancelled.
    /// @param tokenId The token to check.
    /// @return True if the token exists and is not cancelled.
    function isAuthentic(uint256 tokenId) external view returns (bool) {
        if (tokenId == 0 || tokenId > tokenCount) return false;
        return nftData[tokenId].status != TokenStatus.CANCELLED;
    }
}
