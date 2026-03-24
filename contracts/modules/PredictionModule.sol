// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IMatchOracle.sol";
import "../interfaces/IFranchiseRegistry.sol";

/// @title PredictionModule
/// @notice Points-only fan prediction engine — franchise-scoped, halal-compliant.
///         ZERO staking. ZERO money on outcomes. Fans earn prediction points,
///         streak bonuses, and on-chain reputation for correct predictions.
///         Points unlock badges (soulbound NFTs) and perks.
/// @dev No ReentrancyGuard needed — no ETH transfers anywhere in this contract.
contract PredictionModule is Ownable {
    // -----------------------------------------------------------------------
    // Custom Errors
    // -----------------------------------------------------------------------

    error ZeroAddress();
    error InvalidMatchId();
    error FranchiseNotActive();
    error AlreadyPredicted();
    error AlreadyResolved();
    error MatchAlreadyStarted();
    error InvalidPredictionType();
    error MatchPredictionsFull();

    // -----------------------------------------------------------------------
    // Enums & Structs
    // -----------------------------------------------------------------------

    enum PredictionStatus { OPEN, RESOLVED, CANCELLED }

    struct Prediction {
        uint256 predictionId;
        uint256 franchiseId;
        address predictor;
        PredictionStatus status;
        uint256 matchId;
        bytes32 predictionType;
        bytes32 predictedOutcome;
        bool correct;
        uint256 pointsEarned;
        uint256 createdAt;
    }

    struct UserStats {
        uint256 totalPoints;
        uint256 totalCorrect;
        uint256 totalPredictions;
        uint256 currentStreak;
    }

    // -----------------------------------------------------------------------
    // Constants
    // -----------------------------------------------------------------------

    uint256 public constant BASE_POINTS = 100;
    uint256 public constant STREAK_BONUS_PER = 25;
    uint256 public constant MAX_STREAK_BONUS = 200;
    uint256 public constant EARLY_BIRD_BONUS = 50;
    uint256 public constant EARLY_BIRD_WINDOW = 1 hours;
    uint256 public constant MAX_PREDICTIONS_PER_MATCH = 1000;
    uint256 public constant MAX_PREDICTION_TYPES = 10;

    // -----------------------------------------------------------------------
    // Immutable State
    // -----------------------------------------------------------------------

    IMatchOracle public immutable oracle;
    IFranchiseRegistry public immutable franchiseRegistry;

    // -----------------------------------------------------------------------
    // Mutable State
    // -----------------------------------------------------------------------

    mapping(uint256 => Prediction) public predictions;
    mapping(uint256 => uint256[]) public matchPredictions;
    mapping(address => uint256[]) public userPredictions;
    mapping(address => UserStats) public userStats;

    /// @notice Prevents duplicate predictions: user → matchId → predictionType → bool.
    mapping(address => mapping(uint256 => mapping(bytes32 => bool))) public hasPredicted;

    /// @notice Whitelist of valid prediction types.
    mapping(bytes32 => bool) public validPredictionTypes;

    uint256 public predictionCount;

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    event PredictionCreated(
        uint256 indexed predictionId,
        uint256 indexed matchId,
        address indexed predictor,
        bytes32 predictionType,
        bytes32 predictedOutcome
    );

    event PredictionResolved(
        uint256 indexed predictionId,
        address indexed predictor,
        bool correct,
        uint256 pointsEarned
    );

    event MatchPredictionsCancelled(uint256 indexed matchId);

    event PredictionCancelled(uint256 indexed predictionId);

    event StreakAchieved(address indexed predictor, uint256 streakLength);

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    /// @notice Deploys the PredictionModule with required external dependencies.
    /// @param _oracle Address of the match oracle contract.
    /// @param _franchiseRegistry Address of the franchise registry contract.
    constructor(
        address _oracle,
        address _franchiseRegistry
    ) Ownable(msg.sender) {
        if (_oracle == address(0)) revert ZeroAddress();
        if (_franchiseRegistry == address(0)) revert ZeroAddress();

        oracle = IMatchOracle(_oracle);
        franchiseRegistry = IFranchiseRegistry(_franchiseRegistry);
    }

    // -----------------------------------------------------------------------
    // External — Mutative
    // -----------------------------------------------------------------------

    /// @notice Create a new prediction for a match outcome. FREE — no staking.
    /// @param franchiseId The franchise this prediction belongs to (must be active).
    /// @param matchId The match being predicted on (must be > 0).
    /// @param predictionType Opaque type tag (e.g. "MATCH_WINNER", "TOP_SCORER").
    /// @param predictedOutcome The outcome the fan is predicting (e.g. "PINDIZ_WIN").
    /// @return The newly assigned prediction ID.
    function createPrediction(
        uint256 franchiseId,
        uint256 matchId,
        bytes32 predictionType,
        bytes32 predictedOutcome
    ) external returns (uint256) {
        if (matchId == 0) revert InvalidMatchId();

        IFranchiseRegistry.Franchise memory franchise = franchiseRegistry.getFranchise(franchiseId);
        if (!franchise.active) revert FranchiseNotActive();

        IMatchOracle.MatchData memory matchData = oracle.getResult(matchId);
        if (matchData.startTime > 0 && block.timestamp >= matchData.startTime) revert MatchAlreadyStarted();

        if (!validPredictionTypes[predictionType]) revert InvalidPredictionType();
        if (matchPredictions[matchId].length >= MAX_PREDICTIONS_PER_MATCH) revert MatchPredictionsFull();

        if (hasPredicted[msg.sender][matchId][predictionType]) revert AlreadyPredicted();

        uint256 id;
        unchecked {
            id = ++predictionCount;
        }

        predictions[id] = Prediction({
            predictionId: id,
            franchiseId: franchiseId,
            predictor: msg.sender,
            status: PredictionStatus.OPEN,
            matchId: matchId,
            predictionType: predictionType,
            predictedOutcome: predictedOutcome,
            correct: false,
            pointsEarned: 0,
            createdAt: block.timestamp
        });

        hasPredicted[msg.sender][matchId][predictionType] = true;
        matchPredictions[matchId].push(id);
        userPredictions[msg.sender].push(id);

        emit PredictionCreated(id, matchId, msg.sender, predictionType, predictedOutcome);
        return id;
    }

    /// @notice Resolve a single prediction against the actual outcome.
    /// @param predictionId The prediction to resolve.
    /// @param actualOutcome The outcome that actually occurred.
    function resolvePrediction(
        uint256 predictionId,
        bytes32 actualOutcome
    ) external onlyOwner {
        Prediction storage pred = predictions[predictionId];
        if (pred.status != PredictionStatus.OPEN) revert AlreadyResolved();

        _resolve(pred, actualOutcome);
    }

    /// @notice Batch-resolve all predictions for a match + type against the actual outcome.
    /// @dev Streak bonuses are calculated using live streak values, so resolution order within
    ///      a batch may affect bonus amounts. This is accepted behavior — the first correct
    ///      prediction resolved in a batch gets the pre-existing streak bonus, while subsequent
    ///      correct predictions by the same user (different type) benefit from the incremented streak.
    /// @param matchId The match whose predictions to resolve.
    /// @param predictionType The prediction type to filter by.
    /// @param actualOutcome The outcome that actually occurred.
    function resolveMatchPredictions(
        uint256 matchId,
        bytes32 predictionType,
        bytes32 actualOutcome
    ) external onlyOwner {
        uint256[] memory predIds = matchPredictions[matchId];
        uint256 length = predIds.length;

        for (uint256 i; i < length;) {
            Prediction storage pred = predictions[predIds[i]];
            if (pred.status == PredictionStatus.OPEN && pred.predictionType == predictionType) {
                _resolve(pred, actualOutcome);
            }
            unchecked { ++i; }
        }
    }

    /// @notice Cancel all open predictions for a match (e.g. abandoned match).
    ///         No points awarded, no streaks broken.
    /// @param matchId The match whose predictions to cancel.
    function cancelMatchPredictions(uint256 matchId) external onlyOwner {
        uint256[] memory predIds = matchPredictions[matchId];
        uint256 length = predIds.length;

        for (uint256 i; i < length;) {
            Prediction storage pred = predictions[predIds[i]];
            if (pred.status == PredictionStatus.OPEN) {
                pred.status = PredictionStatus.CANCELLED;
                // Reset hasPredicted so fan can predict again if match is rescheduled
                hasPredicted[pred.predictor][matchId][pred.predictionType] = false;
                emit PredictionCancelled(predIds[i]);
            }
            unchecked { ++i; }
        }

        emit MatchPredictionsCancelled(matchId);
    }

    // -----------------------------------------------------------------------
    // External — Admin
    // -----------------------------------------------------------------------

    /// @notice Add or remove a prediction type from the whitelist.
    /// @param predictionType The type tag to update (e.g. keccak256("MATCH_WINNER")).
    /// @param valid Whether the type should be accepted.
    function setPredictionType(bytes32 predictionType, bool valid) external onlyOwner {
        validPredictionTypes[predictionType] = valid;
    }

    // -----------------------------------------------------------------------
    // External — View
    // -----------------------------------------------------------------------

    /// @notice Return every prediction ID associated with a user.
    /// @param user The address to query.
    /// @return Array of prediction IDs.
    function getUserPredictions(address user) external view returns (uint256[] memory) {
        return userPredictions[user];
    }

    /// @notice Return aggregated stats for a user.
    /// @param user The address to query.
    /// @return stats The user's prediction stats.
    function getUserStats(address user) external view returns (UserStats memory stats) {
        return userStats[user];
    }

    /// @notice Return all prediction IDs for a match.
    /// @param matchId The match to query.
    /// @return Array of prediction IDs.
    function getMatchPredictions(uint256 matchId) external view returns (uint256[] memory) {
        return matchPredictions[matchId];
    }

    /// @notice Return full prediction data for a given prediction ID.
    /// @param predictionId The prediction to look up.
    /// @return The Prediction struct.
    function getPrediction(uint256 predictionId) external view returns (Prediction memory) {
        return predictions[predictionId];
    }

    // -----------------------------------------------------------------------
    // Internal
    // -----------------------------------------------------------------------

    /// @notice Resolves a single prediction: awards points if correct, resets streak if wrong.
    /// @dev Points formula: BASE_POINTS + min(streak * STREAK_BONUS_PER, MAX_STREAK_BONUS) + earlyBirdBonus.
    ///      Early bird bonus applies if prediction was created before match start minus EARLY_BIRD_WINDOW.
    /// @param pred Storage pointer to the prediction being resolved.
    /// @param actualOutcome The actual outcome to compare against.
    function _resolve(Prediction storage pred, bytes32 actualOutcome) internal {
        pred.status = PredictionStatus.RESOLVED;

        address predictor = pred.predictor;
        UserStats storage stats = userStats[predictor];

        if (pred.predictedOutcome == actualOutcome) {
            pred.correct = true;

            uint256 streak = stats.currentStreak;
            uint256 streakBonus = streak * STREAK_BONUS_PER;
            if (streakBonus > MAX_STREAK_BONUS) {
                streakBonus = MAX_STREAK_BONUS;
            }

            uint256 earlyBonus;
            IMatchOracle.MatchData memory matchData = oracle.getResult(pred.matchId);
            if (matchData.startTime > 0 && pred.createdAt + EARLY_BIRD_WINDOW <= matchData.startTime) {
                earlyBonus = EARLY_BIRD_BONUS;
            }

            uint256 points;
            unchecked {
                points = BASE_POINTS + streakBonus + earlyBonus;
                stats.totalPoints += points;
                stats.totalCorrect++;
                stats.currentStreak++;
            }

            pred.pointsEarned = points;

            uint256 newStreak = stats.currentStreak;
            if (newStreak == 3 || newStreak == 5 || newStreak == 10 || newStreak == 25) {
                emit StreakAchieved(predictor, newStreak);
            }
        } else {
            stats.currentStreak = 0;
        }

        unchecked {
            stats.totalPredictions++;
        }

        emit PredictionResolved(pred.predictionId, predictor, pred.correct, pred.pointsEarned);
    }
}
