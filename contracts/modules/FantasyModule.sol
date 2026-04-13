// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../interfaces/IMatchOracle.sol";
import "../interfaces/IFranchiseRegistry.sol";

/// @title FantasyModule
/// @notice Free-to-play on-chain fantasy cricket — franchise-scoped contests.
///         Prize pools are funded by sponsors/franchises, NOT by fan entry fees.
///         Halal-compliant: no gambling, no staking on outcomes.
/// @dev Oracle reference stored for future auto-scoring integration.
///      Currently, scores are set via updatePlayerScore (owner/backend).
///      Fans can join/play without oracle — oracle only needed for settlement.
contract FantasyModule is Ownable, ReentrancyGuard, Pausable {
    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    error ContestNotActive();
    error ContestFull(uint256 max);
    error ContestAlreadyLocked();
    error OverCreditBudget(uint256 provided, uint256 max);
    error AlreadyJoined();
    error CaptainNotInSquad();
    error ViceCaptainNotInSquad();
    error DuplicatePlayer();
    error NoParticipants();
    error TransferFailed();
    error NotFranchiseAdmin();
    error ZeroAddress();
    error NoSponsorPool();
    error ContestNotLocked();
    error InsufficientParticipants();
    error NotContestWinner();
    error NoPrizeToClaim();
    error ZeroPlayerId();

    // ──────────────────────────────────────────────
    //  Structs
    // ──────────────────────────────────────────────

    struct Contest {
        uint256 contestId;
        uint256 franchiseId;
        uint256 matchId;
        uint256 sponsorPool;
        uint256 maxParticipants;
        bool active;
        bool finalized;
    }

    struct Squad {
        address owner;
        uint256 captainId;
        uint256 viceCaptainId;
        uint256 totalCredits;
        uint256 submittedAt;
        uint256 totalPoints;
        uint256[11] playerIds;
    }

    // ──────────────────────────────────────────────
    //  Constants
    // ──────────────────────────────────────────────

    uint256 public constant SQUAD_SIZE = 11;
    uint256 public constant MAX_CREDITS = 100;
    uint256 public constant ABSOLUTE_MAX_PARTICIPANTS = 200;
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant CAPTAIN_MULTIPLIER = 2;
    uint256 public constant VICE_CAPTAIN_NUMERATOR = 3;
    uint256 public constant VICE_CAPTAIN_DENOMINATOR = 2;
    uint256 public constant PROTOCOL_FEE_BPS = 200;

    // ──────────────────────────────────────────────
    //  Immutables
    // ──────────────────────────────────────────────

    IMatchOracle public immutable oracle;
    IFranchiseRegistry public immutable franchiseRegistry;
    address public immutable protocolTreasury;

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    mapping(uint256 => Contest) public contests;
    mapping(uint256 => mapping(address => Squad)) public squads;
    mapping(uint256 => address[]) public contestParticipants;
    mapping(uint256 => mapping(uint256 => uint256)) public playerScores;
    mapping(uint256 => bool) public contestLocked;
    mapping(uint256 => address) public contestWinner;
    mapping(uint256 => uint256) public pendingPrize;
    uint256 public contestCount;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    /// @notice Emitted when a new fantasy contest is created.
    event ContestCreated(uint256 indexed contestId, uint256 indexed franchiseId, uint256 matchId, uint256 maxParticipants);

    /// @notice Emitted when a sponsor or franchise admin funds a contest's prize pool.
    event ContestFunded(uint256 indexed contestId, address indexed sponsor, uint256 amount, uint256 totalPool);

    /// @notice Emitted when a user joins a contest with their squad (FREE).
    event SquadJoined(uint256 indexed contestId, address indexed owner);

    /// @notice Emitted when a contest is locked (squads become immutable).
    event ContestLocked(uint256 indexed contestId);

    /// @notice Emitted when a player's fantasy score is updated.
    event PlayerScoreUpdated(uint256 indexed contestId, uint256 indexed playerId, uint256 points);

    /// @notice Emitted when a contest is finalized and sponsor prizes distributed.
    event ContestFinalized(uint256 indexed contestId, address indexed winner, uint256 prize);

    /// @notice Emitted when a contest is cancelled and the sponsor pool is refunded.
    event ContestCancelled(uint256 indexed contestId, uint256 refundedPool);

    /// @notice Emitted when a winner claims their prize from a finalized contest.
    event PrizeClaimed(uint256 indexed contestId, address indexed winner, uint256 amount);

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /// @notice Deploys the FantasyModule with required external dependencies.
    /// @param _oracle Address of the match oracle contract.
    /// @param _franchiseRegistry Address of the franchise registry contract.
    /// @param _protocolTreasury Address that receives protocol fees.
    constructor(
        address _oracle,
        address _franchiseRegistry,
        address _protocolTreasury
    ) Ownable(msg.sender) {
        if (_oracle == address(0)) revert ZeroAddress();
        if (_franchiseRegistry == address(0)) revert ZeroAddress();
        if (_protocolTreasury == address(0)) revert ZeroAddress();

        oracle = IMatchOracle(_oracle);
        franchiseRegistry = IFranchiseRegistry(_franchiseRegistry);
        protocolTreasury = _protocolTreasury;
    }

    // ──────────────────────────────────────────────
    //  Write Functions
    // ──────────────────────────────────────────────

    /// @notice Creates a new free-to-play fantasy contest scoped to a franchise and match.
    /// @param franchiseId The franchise hosting this contest.
    /// @param matchId The oracle match this contest is based on.
    /// @param maxParticipants Maximum number of participants (0 = unlimited).
    /// @return contestId The identifier assigned to the new contest.
    function createContest(
        uint256 franchiseId,
        uint256 matchId,
        uint256 maxParticipants
    ) external returns (uint256) {
        (bool isAdmin, uint256 adminFranchise) = franchiseRegistry.isFranchiseAdmin(msg.sender);
        if (!(isAdmin && adminFranchise == franchiseId) && msg.sender != owner()) {
            revert NotFranchiseAdmin();
        }

        // Enforce protocol-level cap to prevent gas limit issues in finalizeContest
        if (maxParticipants > ABSOLUTE_MAX_PARTICIPANTS) {
            revert ContestFull(ABSOLUTE_MAX_PARTICIPANTS);
        }

        uint256 id;
        unchecked {
            id = ++contestCount;
        }

        contests[id] = Contest({
            contestId: id,
            franchiseId: franchiseId,
            matchId: matchId,
            sponsorPool: 0,
            maxParticipants: maxParticipants,
            active: true,
            finalized: false
        });

        emit ContestCreated(id, franchiseId, matchId, maxParticipants);
        return id;
    }

    /// @notice Funds a contest's prize pool. Can be called by franchise admin or any sponsor.
    ///         Additive — multiple calls accumulate the pool. Must be called before contest is locked.
    /// @param contestId The contest to fund.
    function fundContest(uint256 contestId) external payable nonReentrant whenNotPaused {
        Contest storage contest = contests[contestId];
        if (!contest.active || contest.finalized) revert ContestNotActive();
        if (contestLocked[contestId]) revert ContestAlreadyLocked();
        if (msg.value == 0) revert NoSponsorPool();

        contest.sponsorPool += msg.value;

        emit ContestFunded(contestId, msg.sender, msg.value, contest.sponsorPool);
    }

    /// @notice Joins a contest by submitting a squad. FREE — no payment required.
    /// @param contestId The contest to join.
    /// @param playerIds Array of 11 player identifiers forming the squad.
    /// @param captainId The player designated as captain (2x points).
    /// @param viceCaptainId The player designated as vice-captain (1.5x points).
    /// @param totalCredits Total fantasy credits consumed by the squad.
    function joinContest(
        uint256 contestId,
        uint256[11] calldata playerIds,
        uint256 captainId,
        uint256 viceCaptainId,
        uint256 totalCredits
    ) external whenNotPaused {
        Contest storage contest = contests[contestId];
        if (!contest.active || contest.finalized) revert ContestNotActive();
        if (contestLocked[contestId]) revert ContestNotActive();
        if (totalCredits > MAX_CREDITS) revert OverCreditBudget(totalCredits, MAX_CREDITS);
        if (squads[contestId][msg.sender].owner != address(0)) revert AlreadyJoined();

        uint256 currentCount = contestParticipants[contestId].length;
        // Enforce protocol-level absolute cap to prevent gas limit issues in finalizeContest
        if (currentCount >= ABSOLUTE_MAX_PARTICIPANTS) {
            revert ContestFull(ABSOLUTE_MAX_PARTICIPANTS);
        }
        uint256 maxP = contest.maxParticipants;
        if (maxP > 0 && currentCount >= maxP) {
            revert ContestFull(maxP);
        }

        bool captainFound;
        bool viceCaptainFound;
        for (uint256 i; i < SQUAD_SIZE;) {
            if (playerIds[i] == 0) revert ZeroPlayerId();
            if (playerIds[i] == captainId) captainFound = true;
            if (playerIds[i] == viceCaptainId) viceCaptainFound = true;

            for (uint256 j = i + 1; j < SQUAD_SIZE;) {
                if (playerIds[i] == playerIds[j]) revert DuplicatePlayer();
                unchecked { ++j; }
            }
            unchecked { ++i; }
        }
        if (!captainFound) revert CaptainNotInSquad();
        if (!viceCaptainFound) revert ViceCaptainNotInSquad();

        squads[contestId][msg.sender] = Squad({
            owner: msg.sender,
            captainId: captainId,
            viceCaptainId: viceCaptainId,
            totalCredits: totalCredits,
            submittedAt: block.timestamp,
            totalPoints: 0,
            playerIds: playerIds
        });

        contestParticipants[contestId].push(msg.sender);

        emit SquadJoined(contestId, msg.sender);
    }

    /// @notice Locks all squads in a contest, preventing further joins or modifications.
    /// @param contestId The contest to lock.
    function lockContest(uint256 contestId) external {
        Contest storage contest = contests[contestId];
        if (!contest.active) revert ContestNotActive();

        (bool isAdmin, uint256 adminFranchise) = franchiseRegistry.isFranchiseAdmin(msg.sender);
        if (!(isAdmin && adminFranchise == contest.franchiseId) && msg.sender != owner()) {
            revert NotFranchiseAdmin();
        }

        contestLocked[contestId] = true;

        emit ContestLocked(contestId);
    }

    /// @notice Updates the fantasy points for a specific player within a contest.
    /// @param contestId The contest to update scores for.
    /// @param playerId The player whose score is being set.
    /// @param points The fantasy points awarded to this player.
    function updatePlayerScore(
        uint256 contestId,
        uint256 playerId,
        uint256 points
    ) external onlyOwner {
        Contest storage contest = contests[contestId];
        if (!contest.active || contest.finalized) revert ContestNotActive();
        if (!contestLocked[contestId]) revert ContestNotLocked();

        playerScores[contestId][playerId] = points;
        emit PlayerScoreUpdated(contestId, playerId, points);
    }

    /// @notice Finalizes a contest: computes squad totals, determines the winner,
    ///         and distributes the sponsor-funded prize pool.
    /// @dev If sponsorPool is zero, contest is finalized as points-only (no prize transfer).
    ///      Caches captainId, viceCaptainId, and playerIds[j] per participant to reduce SLOADs.
    /// @param contestId The contest to finalize.
    function finalizeContest(uint256 contestId) external onlyOwner nonReentrant {
        Contest storage contest = contests[contestId];
        if (!contest.active || contest.finalized) revert ContestNotActive();

        address[] memory participants = contestParticipants[contestId];
        if (participants.length == 0) revert NoParticipants();

        uint256 pool = contest.sponsorPool;
        if (pool > 0 && participants.length < 2) revert InsufficientParticipants();

        address topScorer = participants[0];
        uint256 topPoints;

        for (uint256 i; i < participants.length;) {
            Squad storage squad = squads[contestId][participants[i]];
            uint256 total;

            uint256 capId = squad.captainId;
            uint256 viceCapId = squad.viceCaptainId;

            for (uint256 j; j < SQUAD_SIZE;) {
                uint256 pid = squad.playerIds[j];
                uint256 pts = playerScores[contestId][pid];
                if (pid == capId) {
                    pts = pts * CAPTAIN_MULTIPLIER;
                } else if (pid == viceCapId) {
                    pts = (pts * VICE_CAPTAIN_NUMERATOR) / VICE_CAPTAIN_DENOMINATOR;
                }
                unchecked {
                    total += pts;
                    ++j;
                }
            }

            squad.totalPoints = total;

            if (total > topPoints) {
                topPoints = total;
                topScorer = participants[i];
            }
            unchecked { ++i; }
        }

        contest.finalized = true;
        contest.active = false;

        if (pool > 0) {
            uint256 fee = (pool * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
            uint256 prize;
            unchecked {
                prize = pool - fee;
            }

            if (fee > 0) {
                (bool feeSent,) = protocolTreasury.call{value: fee}("");
                if (!feeSent) revert TransferFailed();
            }

            contestWinner[contestId] = topScorer;
            pendingPrize[contestId] = prize;

            emit ContestFinalized(contestId, topScorer, prize);
        } else {
            emit ContestFinalized(contestId, topScorer, 0);
        }
    }

    /// @notice Pause all contest operations. Emergency use only.
    function pause() external onlyOwner { _pause(); }

    /// @notice Unpause contest operations.
    function unpause() external onlyOwner { _unpause(); }

    /// @notice Cancels an active contest and refunds the sponsor pool to the caller.
    ///         Only the franchise admin or contract owner may cancel.
    /// @param contestId The contest to cancel.
    function cancelContest(uint256 contestId) external nonReentrant {
        Contest storage contest = contests[contestId];
        if (!contest.active || contest.finalized) revert ContestNotActive();

        (bool isAdmin, uint256 adminFranchise) = franchiseRegistry.isFranchiseAdmin(msg.sender);
        if (!(isAdmin && adminFranchise == contest.franchiseId) && msg.sender != owner()) {
            revert NotFranchiseAdmin();
        }

        contest.active = false;
        contest.finalized = true;

        uint256 pool = contest.sponsorPool;
        if (pool > 0) {
            contest.sponsorPool = 0;
            (bool sent,) = msg.sender.call{value: pool}("");
            if (!sent) revert TransferFailed();
        }

        emit ContestCancelled(contestId, pool);
    }

    /// @notice Allows the winner of a finalized contest to claim their prize (pull pattern).
    /// @param contestId The contest to claim the prize from.
    function claimPrize(uint256 contestId) external nonReentrant {
        if (contestWinner[contestId] != msg.sender) revert NotContestWinner();
        uint256 prize = pendingPrize[contestId];
        if (prize == 0) revert NoPrizeToClaim();
        pendingPrize[contestId] = 0;
        (bool sent,) = msg.sender.call{value: prize}("");
        if (!sent) revert TransferFailed();
        emit PrizeClaimed(contestId, msg.sender, prize);
    }

    // ──────────────────────────────────────────────
    //  View Functions
    // ──────────────────────────────────────────────

    /// @notice Returns the list of participant addresses for a contest.
    /// @param contestId The contest to query.
    /// @return participants Array of addresses that joined the contest.
    function getContestParticipants(uint256 contestId) external view returns (address[] memory participants) {
        return contestParticipants[contestId];
    }

    /// @notice Returns the squad submitted by a specific participant.
    /// @param contestId The contest to query.
    /// @param participant The address of the squad owner.
    /// @return squad The participant's squad struct.
    function getSquad(uint256 contestId, address participant) external view returns (Squad memory squad) {
        return squads[contestId][participant];
    }

    /// @notice Returns the fantasy points assigned to a player in a contest.
    /// @param contestId The contest to query.
    /// @param playerId The player to query.
    /// @return points The fantasy points for that player.
    function getPlayerScore(uint256 contestId, uint256 playerId) external view returns (uint256 points) {
        return playerScores[contestId][playerId];
    }
}
