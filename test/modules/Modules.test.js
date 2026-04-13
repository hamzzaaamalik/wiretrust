const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("WireTrust Modules", function () {
  // ─── Shared deploy fixture ───────────────────────────────────────────

  async function deployFixture() {
    const [owner, oracle, franchiseAdmin, treasury, fan1, fan2, fan3, buyer] =
      await ethers.getSigners();

    // --- FranchiseRegistry ---
    const FranchiseRegistry = await ethers.getContractFactory(
      "FranchiseRegistry"
    );
    const franchiseRegistry = await FranchiseRegistry.deploy(treasury.address);

    // Register a franchise so modules can use franchiseId = 1
    await franchiseRegistry.registerFranchise(
      "Pindiz",
      "PSL",
      franchiseAdmin.address,
      treasury.address
    );
    const franchiseId = 1;

    // --- MatchOracle ---
    const MatchOracle = await ethers.getContractFactory("MatchOracle");
    const matchOracle = await MatchOracle.deploy();

    // Authorize oracle signer
    await matchOracle.authorizeOracle(oracle.address);

    // --- FantasyModule ---
    const FantasyModule = await ethers.getContractFactory("FantasyModule");
    const fantasyModule = await FantasyModule.deploy(
      await matchOracle.getAddress(),
      await franchiseRegistry.getAddress(),
      treasury.address
    );

    // --- PredictionModule ---
    const PredictionModule = await ethers.getContractFactory(
      "PredictionModule"
    );
    const predictionModule = await PredictionModule.deploy(
      await matchOracle.getAddress(),
      await franchiseRegistry.getAddress()
    );

    // --- WireTrustNFT ---
    const WireTrustNFT = await ethers.getContractFactory("WireTrustNFT");
    const wireTrustNFT = await WireTrustNFT.deploy(
      await franchiseRegistry.getAddress(),
      treasury.address
    );

    return {
      owner,
      oracle,
      franchiseAdmin,
      treasury,
      fan1,
      fan2,
      fan3,
      buyer,
      franchiseRegistry,
      matchOracle,
      fantasyModule,
      predictionModule,
      wireTrustNFT,
      franchiseId,
    };
  }

  // Helper: create a match in the future
  async function createFutureMatch(matchOracle, franchiseId, hoursAhead = 24) {
    const now = await time.latest();
    const startTime = now + hoursAhead * 3600;
    const tx = await matchOracle.createMatch(
      franchiseId,
      "TeamA",
      "TeamB",
      startTime
    );
    const receipt = await tx.wait();
    const matchCount = await matchOracle.matchCount();
    return { matchId: matchCount, startTime };
  }

  // Helper: generate 11 unique player IDs
  function playerIds(start = 1) {
    return Array.from({ length: 11 }, (_, i) => start + i);
  }

  // =====================================================================
  //  1. MatchOracle
  // =====================================================================

  describe("MatchOracle", function () {
    it("should create a match and return correct matchId", async function () {
      const { matchOracle, franchiseId } = await loadFixture(deployFixture);
      const now = await time.latest();
      const startTime = now + 86400;

      await expect(
        matchOracle.createMatch(franchiseId, "TeamA", "TeamB", startTime)
      )
        .to.emit(matchOracle, "MatchCreated")
        .withArgs(1, franchiseId, "TeamA", "TeamB", startTime);

      expect(await matchOracle.matchCount()).to.equal(1);

      const matchData = await matchOracle.getResult(1);
      expect(matchData.team1).to.equal("TeamA");
      expect(matchData.team2).to.equal("TeamB");
      expect(matchData.franchiseId).to.equal(franchiseId);
      expect(matchData.resultSubmitted).to.equal(false);
    });

    it("should only allow owner to create a match", async function () {
      const { matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      const now = await time.latest();
      await expect(
        matchOracle
          .connect(fan1)
          .createMatch(franchiseId, "A", "B", now + 86400)
      ).to.be.revertedWithCustomError(matchOracle, "OwnableUnauthorizedAccount");
    });

    it("should authorize and revoke oracle", async function () {
      const { matchOracle, fan1 } = await loadFixture(deployFixture);
      await matchOracle.authorizeOracle(fan1.address);
      expect(await matchOracle.authorizedOracles(fan1.address)).to.equal(true);
      await matchOracle.revokeOracle(fan1.address);
      expect(await matchOracle.authorizedOracles(fan1.address)).to.equal(false);
    });

    it("should reject authorizing zero address", async function () {
      const { matchOracle } = await loadFixture(deployFixture);
      await expect(
        matchOracle.authorizeOracle(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(matchOracle, "InvalidOracle");
    });

    it("should allow authorized oracle to submit result", async function () {
      const { matchOracle, oracle, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);

      await expect(
        matchOracle.connect(oracle).submitResult(matchId, "TeamA", false)
      )
        .to.emit(matchOracle, "MatchResultSubmitted")
        .withArgs(matchId, "TeamA", false);

      const result = await matchOracle.getResult(matchId);
      expect(result.resultSubmitted).to.equal(true);
      expect(result.winner).to.equal("TeamA");
      expect(result.abandoned).to.equal(false);
      expect(await matchOracle.isMatchSettled(matchId)).to.equal(true);
    });

    it("should reject result from non-oracle", async function () {
      const { matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);

      await expect(
        matchOracle.connect(fan1).submitResult(matchId, "TeamA", false)
      ).to.be.revertedWithCustomError(matchOracle, "NotAuthorizedOracle");
    });

    it("should reject duplicate result submission", async function () {
      const { matchOracle, oracle, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);

      await matchOracle.connect(oracle).submitResult(matchId, "TeamA", false);
      await expect(
        matchOracle.connect(oracle).submitResult(matchId, "TeamB", false)
      ).to.be.revertedWithCustomError(matchOracle, "ResultAlreadySubmitted");
    });

    it("should reject invalid result (abandoned with winner)", async function () {
      const { matchOracle, oracle, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);

      await expect(
        matchOracle.connect(oracle).submitResult(matchId, "TeamA", true)
      ).to.be.revertedWithCustomError(matchOracle, "InvalidResult");
    });

    it("should reject invalid result (not abandoned, no winner)", async function () {
      const { matchOracle, oracle, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);

      await expect(
        matchOracle.connect(oracle).submitResult(matchId, "", false)
      ).to.be.revertedWithCustomError(matchOracle, "InvalidResult");
    });

    it("should allow submitting an abandoned match with empty winner", async function () {
      const { matchOracle, oracle, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);

      await matchOracle.connect(oracle).submitResult(matchId, "", true);
      const result = await matchOracle.getResult(matchId);
      expect(result.abandoned).to.equal(true);
      expect(result.winner).to.equal("");
    });

    it("should reject result for invalid matchId", async function () {
      const { matchOracle, oracle } = await loadFixture(deployFixture);
      await expect(
        matchOracle.connect(oracle).submitResult(999, "TeamA", false)
      ).to.be.revertedWithCustomError(matchOracle, "InvalidMatch");
    });

    it("should submit and retrieve player stats", async function () {
      const { matchOracle, oracle, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);

      await expect(
        matchOracle
          .connect(oracle)
          .submitPlayerStats(matchId, 1, 75, 3, 650, 14500, true)
      )
        .to.emit(matchOracle, "PlayerStatsSubmitted")
        .withArgs(matchId, 1);

      const stats = await matchOracle.getPlayerStats(matchId, 1);
      expect(stats.runs).to.equal(75);
      expect(stats.wickets).to.equal(3);
      expect(stats.economyRate).to.equal(650);
      expect(stats.strikeRate).to.equal(14500);
      expect(stats.isMotm).to.equal(true);
    });

    it("should reject duplicate player stats submission", async function () {
      const { matchOracle, oracle, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);

      await matchOracle
        .connect(oracle)
        .submitPlayerStats(matchId, 1, 50, 0, 0, 15000, false);
      await expect(
        matchOracle
          .connect(oracle)
          .submitPlayerStats(matchId, 1, 60, 0, 0, 15000, false)
      ).to.be.revertedWithCustomError(matchOracle, "StatsAlreadySubmitted");
    });

    it("should reject player stats from non-oracle", async function () {
      const { matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);

      await expect(
        matchOracle
          .connect(fan1)
          .submitPlayerStats(matchId, 1, 50, 0, 0, 15000, false)
      ).to.be.revertedWithCustomError(matchOracle, "NotAuthorizedOracle");
    });
  });

  // =====================================================================
  //  2. FantasyModule
  // =====================================================================

  describe("FantasyModule", function () {
    it("should create a contest (owner)", async function () {
      const { fantasyModule, matchOracle, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);

      await expect(fantasyModule.createContest(franchiseId, matchId, 10))
        .to.emit(fantasyModule, "ContestCreated")
        .withArgs(1, franchiseId, matchId, 10);

      expect(await fantasyModule.contestCount()).to.equal(1);
    });

    it("should create a contest (franchise admin)", async function () {
      const { fantasyModule, matchOracle, franchiseAdmin, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);

      await expect(
        fantasyModule
          .connect(franchiseAdmin)
          .createContest(franchiseId, matchId, 5)
      )
        .to.emit(fantasyModule, "ContestCreated")
        .withArgs(1, franchiseId, matchId, 5);
    });

    it("should reject contest creation from non-admin/non-owner", async function () {
      const { fantasyModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);

      await expect(
        fantasyModule.connect(fan1).createContest(franchiseId, matchId, 10)
      ).to.be.revertedWithCustomError(fantasyModule, "NotFranchiseAdmin");
    });

    it("should fund a contest", async function () {
      const { fantasyModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);
      await fantasyModule.createContest(franchiseId, matchId, 10);

      const fundAmount = ethers.parseEther("1.0");
      await expect(
        fantasyModule.connect(fan1).fundContest(1, { value: fundAmount })
      )
        .to.emit(fantasyModule, "ContestFunded")
        .withArgs(1, fan1.address, fundAmount, fundAmount);
    });

    it("should reject funding with zero value", async function () {
      const { fantasyModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);
      await fantasyModule.createContest(franchiseId, matchId, 10);

      await expect(
        fantasyModule.connect(fan1).fundContest(1, { value: 0 })
      ).to.be.revertedWithCustomError(fantasyModule, "NoSponsorPool");
    });

    it("should reject funding a locked contest", async function () {
      const { fantasyModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);
      await fantasyModule.createContest(franchiseId, matchId, 10);
      await fantasyModule.lockContest(1);

      await expect(
        fantasyModule
          .connect(fan1)
          .fundContest(1, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(fantasyModule, "ContestAlreadyLocked");
    });

    it("should allow a fan to join a contest for FREE", async function () {
      const { fantasyModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);
      await fantasyModule.createContest(franchiseId, matchId, 10);

      const pids = playerIds(1);
      await expect(
        fantasyModule.connect(fan1).joinContest(1, pids, 1, 2, 95)
      )
        .to.emit(fantasyModule, "SquadJoined")
        .withArgs(1, fan1.address);

      const squad = await fantasyModule.getSquad(1, fan1.address);
      expect(squad.owner).to.equal(fan1.address);
      expect(squad.captainId).to.equal(1);
      expect(squad.viceCaptainId).to.equal(2);
      expect(squad.totalCredits).to.equal(95);
    });

    it("should reject duplicate join", async function () {
      const { fantasyModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);
      await fantasyModule.createContest(franchiseId, matchId, 10);

      const pids = playerIds(1);
      await fantasyModule.connect(fan1).joinContest(1, pids, 1, 2, 90);
      await expect(
        fantasyModule.connect(fan1).joinContest(1, pids, 1, 2, 90)
      ).to.be.revertedWithCustomError(fantasyModule, "AlreadyJoined");
    });

    it("should reject join when contest is full", async function () {
      const { fantasyModule, matchOracle, fan1, fan2, fan3, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);
      // max 2 participants
      await fantasyModule.createContest(franchiseId, matchId, 2);

      const pids = playerIds(1);
      await fantasyModule.connect(fan1).joinContest(1, pids, 1, 2, 90);
      await fantasyModule
        .connect(fan2)
        .joinContest(1, pids, 1, 2, 90);

      await expect(
        fantasyModule.connect(fan3).joinContest(1, pids, 1, 2, 90)
      ).to.be.revertedWithCustomError(fantasyModule, "ContestFull");
    });

    it("should reject captain not in squad", async function () {
      const { fantasyModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);
      await fantasyModule.createContest(franchiseId, matchId, 10);

      const pids = playerIds(1); // 1..11
      await expect(
        fantasyModule.connect(fan1).joinContest(1, pids, 99, 2, 90)
      ).to.be.revertedWithCustomError(fantasyModule, "CaptainNotInSquad");
    });

    it("should reject vice-captain not in squad", async function () {
      const { fantasyModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);
      await fantasyModule.createContest(franchiseId, matchId, 10);

      const pids = playerIds(1);
      await expect(
        fantasyModule.connect(fan1).joinContest(1, pids, 1, 99, 90)
      ).to.be.revertedWithCustomError(fantasyModule, "ViceCaptainNotInSquad");
    });

    it("should reject duplicate players in squad", async function () {
      const { fantasyModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);
      await fantasyModule.createContest(franchiseId, matchId, 10);

      const dupes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1]; // player 1 duplicated
      await expect(
        fantasyModule.connect(fan1).joinContest(1, dupes, 1, 2, 90)
      ).to.be.revertedWithCustomError(fantasyModule, "DuplicatePlayer");
    });

    it("should reject over credit budget", async function () {
      const { fantasyModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);
      await fantasyModule.createContest(franchiseId, matchId, 10);

      const pids = playerIds(1);
      await expect(
        fantasyModule.connect(fan1).joinContest(1, pids, 1, 2, 101)
      ).to.be.revertedWithCustomError(fantasyModule, "OverCreditBudget");
    });

    it("should reject join after lock", async function () {
      const { fantasyModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);
      await fantasyModule.createContest(franchiseId, matchId, 10);
      await fantasyModule.lockContest(1);

      const pids = playerIds(1);
      await expect(
        fantasyModule.connect(fan1).joinContest(1, pids, 1, 2, 90)
      ).to.be.revertedWithCustomError(fantasyModule, "ContestNotActive");
    });

    it("should lock a contest", async function () {
      const { fantasyModule, matchOracle, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);
      await fantasyModule.createContest(franchiseId, matchId, 10);

      await expect(fantasyModule.lockContest(1))
        .to.emit(fantasyModule, "ContestLocked")
        .withArgs(1);

      expect(await fantasyModule.contestLocked(1)).to.equal(true);
    });

    it("should reject updatePlayerScore before lock", async function () {
      const { fantasyModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);
      await fantasyModule.createContest(franchiseId, matchId, 10);

      await expect(
        fantasyModule.updatePlayerScore(1, 1, 50)
      ).to.be.revertedWithCustomError(fantasyModule, "ContestNotLocked");
    });

    it("should update player scores after lock", async function () {
      const { fantasyModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);
      await fantasyModule.createContest(franchiseId, matchId, 10);
      await fantasyModule.lockContest(1);

      await expect(fantasyModule.updatePlayerScore(1, 1, 50))
        .to.emit(fantasyModule, "PlayerScoreUpdated")
        .withArgs(1, 1, 50);

      expect(await fantasyModule.getPlayerScore(1, 1)).to.equal(50);
    });

    it("should finalize contest, apply captain/vc multipliers, distribute prize, and allow claim", async function () {
      const {
        fantasyModule,
        matchOracle,
        fan1,
        fan2,
        treasury,
        franchiseId,
      } = await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);

      // Create & fund contest
      await fantasyModule.createContest(franchiseId, matchId, 10);
      const pool = ethers.parseEther("10");
      await fantasyModule.fundContest(1, { value: pool });

      // fan1: captain=1, vc=2
      const pids1 = playerIds(1);
      await fantasyModule.connect(fan1).joinContest(1, pids1, 1, 2, 90);

      // fan2: captain=3, vc=4
      const pids2 = playerIds(1);
      await fantasyModule.connect(fan2).joinContest(1, pids2, 3, 4, 85);

      // Lock and set scores
      await fantasyModule.lockContest(1);

      // player 1: 50 pts, player 2: 40 pts, player 3: 30 pts, player 4: 20 pts
      // all others: 10 pts
      await fantasyModule.updatePlayerScore(1, 1, 50);
      await fantasyModule.updatePlayerScore(1, 2, 40);
      await fantasyModule.updatePlayerScore(1, 3, 30);
      await fantasyModule.updatePlayerScore(1, 4, 20);
      for (let i = 5; i <= 11; i++) {
        await fantasyModule.updatePlayerScore(1, i, 10);
      }

      // fan1 total: captain(1)=50*2=100, vc(2)=40*3/2=60, rest 3..11=30+20+10*7=120 => 280
      // fan2 total: captain(3)=30*2=60, vc(4)=20*3/2=30, player1=50, player2=40, rest 5..11=10*7=70 => 250
      // fan1 wins

      const treasuryBalBefore = await ethers.provider.getBalance(
        treasury.address
      );

      await expect(fantasyModule.finalizeContest(1))
        .to.emit(fantasyModule, "ContestFinalized");

      // 2% fee = 0.2 ETH
      const fee = (pool * 200n) / 10000n;
      const prize = pool - fee;

      const treasuryBalAfter = await ethers.provider.getBalance(
        treasury.address
      );
      expect(treasuryBalAfter - treasuryBalBefore).to.equal(fee);

      // Winner should be fan1
      expect(await fantasyModule.contestWinner(1)).to.equal(fan1.address);
      expect(await fantasyModule.pendingPrize(1)).to.equal(prize);

      // Claim prize
      const fan1BalBefore = await ethers.provider.getBalance(fan1.address);
      const claimTx = await fantasyModule.connect(fan1).claimPrize(1);
      const claimReceipt = await claimTx.wait();
      const gasUsed = claimReceipt.gasUsed * claimReceipt.gasPrice;
      const fan1BalAfter = await ethers.provider.getBalance(fan1.address);

      expect(fan1BalAfter - fan1BalBefore + gasUsed).to.equal(prize);
      expect(await fantasyModule.pendingPrize(1)).to.equal(0);
    });

    it("should reject claim from non-winner", async function () {
      const { fantasyModule, matchOracle, fan1, fan2, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);
      await fantasyModule.createContest(franchiseId, matchId, 10);
      await fantasyModule.fundContest(1, { value: ethers.parseEther("1") });

      const pids = playerIds(1);
      await fantasyModule.connect(fan1).joinContest(1, pids, 1, 2, 90);
      await fantasyModule.connect(fan2).joinContest(1, pids, 1, 2, 85);
      await fantasyModule.lockContest(1);
      await fantasyModule.updatePlayerScore(1, 1, 50);
      await fantasyModule.finalizeContest(1);

      await expect(
        fantasyModule.connect(fan2).claimPrize(1)
      ).to.be.revertedWithCustomError(fantasyModule, "NotContestWinner");
    });

    it("should reject double claim", async function () {
      const { fantasyModule, matchOracle, fan1, fan2, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);
      await fantasyModule.createContest(franchiseId, matchId, 10);
      await fantasyModule.fundContest(1, { value: ethers.parseEther("1") });

      const pids = playerIds(1);
      await fantasyModule.connect(fan1).joinContest(1, pids, 1, 2, 90);
      await fantasyModule.connect(fan2).joinContest(1, pids, 1, 2, 85);
      await fantasyModule.lockContest(1);
      await fantasyModule.updatePlayerScore(1, 1, 50);
      await fantasyModule.finalizeContest(1);

      await fantasyModule.connect(fan1).claimPrize(1);
      await expect(
        fantasyModule.connect(fan1).claimPrize(1)
      ).to.be.revertedWithCustomError(fantasyModule, "NoPrizeToClaim");
    });

    it("should finalize with no sponsor pool (points only)", async function () {
      const { fantasyModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);
      await fantasyModule.createContest(franchiseId, matchId, 10);

      const pids = playerIds(1);
      await fantasyModule.connect(fan1).joinContest(1, pids, 1, 2, 90);
      await fantasyModule.lockContest(1);

      await expect(fantasyModule.finalizeContest(1))
        .to.emit(fantasyModule, "ContestFinalized")
        .withArgs(1, fan1.address, 0);
    });

    it("should reject finalize with no participants", async function () {
      const { fantasyModule, matchOracle, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);
      await fantasyModule.createContest(franchiseId, matchId, 10);
      await fantasyModule.lockContest(1);

      await expect(
        fantasyModule.finalizeContest(1)
      ).to.be.revertedWithCustomError(fantasyModule, "NoParticipants");
    });

    it("should reject finalize with pool but only 1 participant", async function () {
      const { fantasyModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);
      await fantasyModule.createContest(franchiseId, matchId, 10);
      await fantasyModule.fundContest(1, { value: ethers.parseEther("1") });
      const pids = playerIds(1);
      await fantasyModule.connect(fan1).joinContest(1, pids, 1, 2, 90);
      await fantasyModule.lockContest(1);

      await expect(
        fantasyModule.finalizeContest(1)
      ).to.be.revertedWithCustomError(fantasyModule, "InsufficientParticipants");
    });

    it("should cancel contest and refund sponsor pool", async function () {
      const { fantasyModule, matchOracle, owner, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);
      await fantasyModule.createContest(franchiseId, matchId, 10);
      const fundAmt = ethers.parseEther("2");
      await fantasyModule.fundContest(1, { value: fundAmt });

      const balBefore = await ethers.provider.getBalance(owner.address);
      const tx = await fantasyModule.cancelContest(1);
      const receipt = await tx.wait();
      const gas = receipt.gasUsed * receipt.gasPrice;
      const balAfter = await ethers.provider.getBalance(owner.address);

      expect(balAfter - balBefore + gas).to.equal(fundAmt);
    });
  });

  // =====================================================================
  //  3. PredictionModule
  // =====================================================================

  describe("PredictionModule", function () {
    const MATCH_WINNER = ethers.encodeBytes32String("MATCH_WINNER");
    const TOP_SCORER = ethers.encodeBytes32String("TOP_SCORER");
    const TEAM_A_WIN = ethers.encodeBytes32String("TEAM_A_WIN");
    const TEAM_B_WIN = ethers.encodeBytes32String("TEAM_B_WIN");
    const PLAYER_X = ethers.encodeBytes32String("PLAYER_X");

    it("should set prediction types", async function () {
      const { predictionModule } = await loadFixture(deployFixture);
      await predictionModule.setPredictionType(MATCH_WINNER, true);
      expect(await predictionModule.validPredictionTypes(MATCH_WINNER)).to.equal(
        true
      );
    });

    it("should reject setPredictionType from non-owner", async function () {
      const { predictionModule, fan1 } = await loadFixture(deployFixture);
      await expect(
        predictionModule.connect(fan1).setPredictionType(MATCH_WINNER, true)
      ).to.be.revertedWithCustomError(predictionModule, "OwnableUnauthorizedAccount");
    });

    it("should create a prediction (FREE)", async function () {
      const { predictionModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      await predictionModule.setPredictionType(MATCH_WINNER, true);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);

      await expect(
        predictionModule
          .connect(fan1)
          .createPrediction(franchiseId, matchId, MATCH_WINNER, TEAM_A_WIN)
      )
        .to.emit(predictionModule, "PredictionCreated")
        .withArgs(1, matchId, fan1.address, MATCH_WINNER, TEAM_A_WIN);

      expect(await predictionModule.predictionCount()).to.equal(1);
    });

    it("should reject prediction for invalid matchId (0)", async function () {
      const { predictionModule, fan1, franchiseId } =
        await loadFixture(deployFixture);
      await predictionModule.setPredictionType(MATCH_WINNER, true);

      await expect(
        predictionModule
          .connect(fan1)
          .createPrediction(franchiseId, 0, MATCH_WINNER, TEAM_A_WIN)
      ).to.be.revertedWithCustomError(predictionModule, "InvalidMatchId");
    });

    it("should reject prediction for invalid prediction type", async function () {
      const { predictionModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);

      await expect(
        predictionModule
          .connect(fan1)
          .createPrediction(franchiseId, matchId, MATCH_WINNER, TEAM_A_WIN)
      ).to.be.revertedWithCustomError(predictionModule, "InvalidPredictionType");
    });

    it("should reject duplicate prediction (same match + type)", async function () {
      const { predictionModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      await predictionModule.setPredictionType(MATCH_WINNER, true);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);

      await predictionModule
        .connect(fan1)
        .createPrediction(franchiseId, matchId, MATCH_WINNER, TEAM_A_WIN);
      await expect(
        predictionModule
          .connect(fan1)
          .createPrediction(franchiseId, matchId, MATCH_WINNER, TEAM_B_WIN)
      ).to.be.revertedWithCustomError(predictionModule, "AlreadyPredicted");
    });

    it("should allow same user to predict different types for same match", async function () {
      const { predictionModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      await predictionModule.setPredictionType(MATCH_WINNER, true);
      await predictionModule.setPredictionType(TOP_SCORER, true);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);

      await predictionModule
        .connect(fan1)
        .createPrediction(franchiseId, matchId, MATCH_WINNER, TEAM_A_WIN);
      await predictionModule
        .connect(fan1)
        .createPrediction(franchiseId, matchId, TOP_SCORER, PLAYER_X);

      expect(await predictionModule.predictionCount()).to.equal(2);
    });

    it("should reject prediction after match has started", async function () {
      const { predictionModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      await predictionModule.setPredictionType(MATCH_WINNER, true);
      const { matchId, startTime } = await createFutureMatch(
        matchOracle,
        franchiseId,
        1
      ); // 1 hour ahead

      // Advance time past match start
      await time.increaseTo(startTime);

      await expect(
        predictionModule
          .connect(fan1)
          .createPrediction(franchiseId, matchId, MATCH_WINNER, TEAM_A_WIN)
      ).to.be.revertedWithCustomError(predictionModule, "MatchAlreadyStarted");
    });

    it("should resolve a correct prediction with BASE_POINTS", async function () {
      const { predictionModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      await predictionModule.setPredictionType(MATCH_WINNER, true);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);

      await predictionModule
        .connect(fan1)
        .createPrediction(franchiseId, matchId, MATCH_WINNER, TEAM_A_WIN);

      await expect(predictionModule.resolvePrediction(1, TEAM_A_WIN))
        .to.emit(predictionModule, "PredictionResolved")
        .withArgs(1, fan1.address, true, 150); // 100 base + 50 early bird (created well before start)

      const pred = await predictionModule.getPrediction(1);
      expect(pred.correct).to.equal(true);
      expect(pred.status).to.equal(1); // RESOLVED

      const stats = await predictionModule.getUserStats(fan1.address);
      expect(stats.totalCorrect).to.equal(1);
      expect(stats.currentStreak).to.equal(1);
    });

    it("should resolve an incorrect prediction with 0 points and reset streak", async function () {
      const { predictionModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      await predictionModule.setPredictionType(MATCH_WINNER, true);

      // First: correct prediction to build streak
      const { matchId: m1 } = await createFutureMatch(matchOracle, franchiseId);
      await predictionModule
        .connect(fan1)
        .createPrediction(franchiseId, m1, MATCH_WINNER, TEAM_A_WIN);
      await predictionModule.resolvePrediction(1, TEAM_A_WIN);

      let stats = await predictionModule.getUserStats(fan1.address);
      expect(stats.currentStreak).to.equal(1);

      // Second: incorrect prediction
      const { matchId: m2 } = await createFutureMatch(matchOracle, franchiseId);
      await predictionModule
        .connect(fan1)
        .createPrediction(franchiseId, m2, MATCH_WINNER, TEAM_A_WIN);
      await predictionModule.resolvePrediction(2, TEAM_B_WIN); // wrong

      const pred = await predictionModule.getPrediction(2);
      expect(pred.correct).to.equal(false);
      expect(pred.pointsEarned).to.equal(0);

      stats = await predictionModule.getUserStats(fan1.address);
      expect(stats.currentStreak).to.equal(0);
      expect(stats.totalPredictions).to.equal(2);
    });

    it("should reject resolving an already resolved prediction", async function () {
      const { predictionModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      await predictionModule.setPredictionType(MATCH_WINNER, true);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);
      await predictionModule
        .connect(fan1)
        .createPrediction(franchiseId, matchId, MATCH_WINNER, TEAM_A_WIN);

      await predictionModule.resolvePrediction(1, TEAM_A_WIN);
      await expect(
        predictionModule.resolvePrediction(1, TEAM_A_WIN)
      ).to.be.revertedWithCustomError(predictionModule, "AlreadyResolved");
    });

    it("should track streak bonus correctly across multiple correct predictions", async function () {
      const { predictionModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      await predictionModule.setPredictionType(MATCH_WINNER, true);

      // Create and resolve 3 correct predictions in sequence
      // All created well before match start so they get early bird bonus
      for (let i = 0; i < 3; i++) {
        const { matchId } = await createFutureMatch(
          matchOracle,
          franchiseId,
          24
        );
        await predictionModule
          .connect(fan1)
          .createPrediction(franchiseId, matchId, MATCH_WINNER, TEAM_A_WIN);
        await predictionModule.resolvePrediction(i + 1, TEAM_A_WIN);
      }

      const stats = await predictionModule.getUserStats(fan1.address);
      expect(stats.currentStreak).to.equal(3);
      expect(stats.totalCorrect).to.equal(3);

      // Points breakdown:
      // pred1: 100 base + 0 streak (streak=0 before resolve) + 50 early = 150
      // pred2: 100 base + 25 streak (streak=1) + 50 early = 175
      // pred3: 100 base + 50 streak (streak=2) + 50 early = 200
      expect(stats.totalPoints).to.equal(150n + 175n + 200n);
    });

    it("should cap streak bonus at MAX_STREAK_BONUS (200)", async function () {
      const { predictionModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      await predictionModule.setPredictionType(MATCH_WINNER, true);

      // Build a streak of 10 (streak bonus = 10*25 = 250, capped at 200)
      for (let i = 0; i < 10; i++) {
        const { matchId } = await createFutureMatch(
          matchOracle,
          franchiseId,
          24
        );
        await predictionModule
          .connect(fan1)
          .createPrediction(franchiseId, matchId, MATCH_WINNER, TEAM_A_WIN);
        await predictionModule.resolvePrediction(i + 1, TEAM_A_WIN);
      }

      const stats = await predictionModule.getUserStats(fan1.address);
      expect(stats.currentStreak).to.equal(10);

      // The 9th prediction (streak=8 before): min(8*25,200)=200 bonus
      // The 10th prediction (streak=9 before): min(9*25,200)=200 bonus (capped)
      // Check that the 10th prediction got 100+200+50=350
      const pred10 = await predictionModule.getPrediction(10);
      expect(pred10.pointsEarned).to.equal(350);
    });

    it("should award early bird bonus when predicting > 1 hour before start", async function () {
      const { predictionModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      await predictionModule.setPredictionType(MATCH_WINNER, true);

      // Match 24 hours ahead = clearly early bird
      const { matchId } = await createFutureMatch(
        matchOracle,
        franchiseId,
        24
      );
      await predictionModule
        .connect(fan1)
        .createPrediction(franchiseId, matchId, MATCH_WINNER, TEAM_A_WIN);
      await predictionModule.resolvePrediction(1, TEAM_A_WIN);

      const pred = await predictionModule.getPrediction(1);
      // base(100) + streak(0) + earlyBird(50) = 150
      expect(pred.pointsEarned).to.equal(150);
    });

    it("should NOT award early bird bonus when predicting within 1 hour of start", async function () {
      const { predictionModule, matchOracle, fan1, franchiseId } =
        await loadFixture(deployFixture);
      await predictionModule.setPredictionType(MATCH_WINNER, true);

      // Match 2 hours ahead
      const { matchId, startTime } = await createFutureMatch(
        matchOracle,
        franchiseId,
        2
      );

      // Advance time to within 30 minutes of match start
      await time.increaseTo(startTime - 1800);

      await predictionModule
        .connect(fan1)
        .createPrediction(franchiseId, matchId, MATCH_WINNER, TEAM_A_WIN);
      await predictionModule.resolvePrediction(1, TEAM_A_WIN);

      const pred = await predictionModule.getPrediction(1);
      // base(100) + streak(0) + no early bird = 100
      expect(pred.pointsEarned).to.equal(100);
    });

    it("should batch resolve match predictions", async function () {
      const { predictionModule, matchOracle, fan1, fan2, franchiseId } =
        await loadFixture(deployFixture);
      await predictionModule.setPredictionType(MATCH_WINNER, true);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);

      await predictionModule
        .connect(fan1)
        .createPrediction(franchiseId, matchId, MATCH_WINNER, TEAM_A_WIN);
      await predictionModule
        .connect(fan2)
        .createPrediction(franchiseId, matchId, MATCH_WINNER, TEAM_B_WIN);

      await predictionModule.resolveAllMatchPredictions(
        matchId,
        MATCH_WINNER,
        TEAM_A_WIN
      );

      const pred1 = await predictionModule.getPrediction(1);
      const pred2 = await predictionModule.getPrediction(2);
      expect(pred1.correct).to.equal(true);
      expect(pred1.status).to.equal(1); // RESOLVED
      expect(pred2.correct).to.equal(false);
      expect(pred2.status).to.equal(1); // RESOLVED
    });

    it("should cancel match predictions", async function () {
      const { predictionModule, matchOracle, fan1, fan2, franchiseId } =
        await loadFixture(deployFixture);
      await predictionModule.setPredictionType(MATCH_WINNER, true);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);

      await predictionModule
        .connect(fan1)
        .createPrediction(franchiseId, matchId, MATCH_WINNER, TEAM_A_WIN);
      await predictionModule
        .connect(fan2)
        .createPrediction(franchiseId, matchId, MATCH_WINNER, TEAM_B_WIN);

      await expect(predictionModule.cancelMatchPredictions(matchId))
        .to.emit(predictionModule, "MatchPredictionsCancelled")
        .withArgs(matchId);

      const pred1 = await predictionModule.getPrediction(1);
      const pred2 = await predictionModule.getPrediction(2);
      expect(pred1.status).to.equal(2); // CANCELLED
      expect(pred2.status).to.equal(2); // CANCELLED

      // After cancellation, user can predict again for the same match+type
      expect(
        await predictionModule.hasPredicted(
          fan1.address,
          matchId,
          MATCH_WINNER
        )
      ).to.equal(false);
    });

    it("should reject prediction for inactive franchise", async function () {
      const {
        predictionModule,
        matchOracle,
        franchiseRegistry,
        fan1,
        franchiseId,
      } = await loadFixture(deployFixture);
      await predictionModule.setPredictionType(MATCH_WINNER, true);
      const { matchId } = await createFutureMatch(matchOracle, franchiseId);

      // Deactivate franchise
      await franchiseRegistry.deactivateFranchise(franchiseId);

      await expect(
        predictionModule
          .connect(fan1)
          .createPrediction(franchiseId, matchId, MATCH_WINNER, TEAM_A_WIN)
      ).to.be.revertedWithCustomError(predictionModule, "FranchiseNotActive");
    });
  });

  // =====================================================================
  //  4. WireTrustNFT
  // =====================================================================

  describe("WireTrustNFT", function () {
    // Helper to mint a TICKET
    async function mintTicket(nft, to, franchiseId, facePrice, hoursAhead = 24) {
      const now = await time.latest();
      const eventTs = now + hoursAhead * 3600;
      const tx = await nft.mint(
        to,
        franchiseId,
        0, // TICKET
        "Match Ticket",
        "General admission",
        "ipfs://ticket",
        facePrice,
        eventTs
      );
      const receipt = await tx.wait();
      const tokenId = await nft.tokenCount();
      return { tokenId, eventTs };
    }

    describe("Minting", function () {
      it("should mint a TICKET", async function () {
        const { wireTrustNFT, fan1, franchiseId } =
          await loadFixture(deployFixture);
        const facePrice = ethers.parseEther("0.1");
        const { tokenId } = await mintTicket(
          wireTrustNFT,
          fan1.address,
          franchiseId,
          facePrice
        );

        expect(await wireTrustNFT.ownerOf(tokenId)).to.equal(fan1.address);
        const meta = await wireTrustNFT.getFullMetadata(tokenId);
        expect(meta.category).to.equal(0); // TICKET
        expect(meta.facePrice).to.equal(facePrice);
        expect(meta.maxResalePrice).to.equal(
          (facePrice * 110n) / 100n
        );
        expect(meta.maxTransfers).to.equal(1);
        expect(meta.soulbound).to.equal(false);
      });

      it("should mint an EXPERIENCE", async function () {
        const { wireTrustNFT, fan1, franchiseId } =
          await loadFixture(deployFixture);
        const now = await time.latest();
        const facePrice = ethers.parseEther("0.5");

        await wireTrustNFT.mint(
          fan1.address,
          franchiseId,
          1, // EXPERIENCE
          "VIP Meet",
          "Meet the players",
          "ipfs://vip",
          facePrice,
          now + 86400
        );

        const meta = await wireTrustNFT.getFullMetadata(1);
        expect(meta.category).to.equal(1);
        expect(meta.maxTransfers).to.equal(1);
        expect(meta.maxResalePrice).to.equal((facePrice * 110n) / 100n);
      });

      it("should mint a COLLECTIBLE (unlimited transfers, no resale cap)", async function () {
        const { wireTrustNFT, fan1, franchiseId } =
          await loadFixture(deployFixture);

        await wireTrustNFT.mint(
          fan1.address,
          franchiseId,
          2, // COLLECTIBLE
          "Rare Card",
          "Limited edition",
          "ipfs://card",
          ethers.parseEther("0.05"),
          0
        );

        const meta = await wireTrustNFT.getFullMetadata(1);
        expect(meta.category).to.equal(2);
        expect(meta.maxTransfers).to.equal(255); // UNLIMITED_TRANSFERS = type(uint8).max
        expect(meta.maxResalePrice).to.equal(0);
        expect(meta.soulbound).to.equal(false);
      });

      it("should mint a BADGE (soulbound, onlyOwner)", async function () {
        const { wireTrustNFT, fan1, franchiseId } =
          await loadFixture(deployFixture);

        await wireTrustNFT.mint(
          fan1.address,
          franchiseId,
          3, // BADGE
          "Top Predictor",
          "Season 1 badge",
          "ipfs://badge",
          0,
          0
        );

        const meta = await wireTrustNFT.getFullMetadata(1);
        expect(meta.category).to.equal(3);
        expect(meta.soulbound).to.equal(true);
        expect(meta.maxTransfers).to.equal(0);
      });

      it("should reject BADGE mint from non-owner", async function () {
        const { wireTrustNFT, franchiseAdmin, fan1, franchiseId } =
          await loadFixture(deployFixture);

        await expect(
          wireTrustNFT.connect(franchiseAdmin).mint(
            fan1.address,
            franchiseId,
            3, // BADGE
            "Badge",
            "desc",
            "uri",
            0,
            0
          )
        ).to.be.revertedWithCustomError(wireTrustNFT, "OnlyProtocolMintsBadges");
      });

      it("should mint MERCHANDISE (unlimited transfers, no resale cap)", async function () {
        const { wireTrustNFT, fan1, franchiseId } =
          await loadFixture(deployFixture);

        await wireTrustNFT.mint(
          fan1.address,
          franchiseId,
          4, // MERCHANDISE
          "Jersey",
          "Official jersey",
          "ipfs://jersey",
          ethers.parseEther("0.2"),
          0
        );

        const meta = await wireTrustNFT.getFullMetadata(1);
        expect(meta.category).to.equal(4);
        expect(meta.maxTransfers).to.equal(255);
        expect(meta.soulbound).to.equal(false);
      });

      it("should reject TICKET mint with past eventTimestamp", async function () {
        const { wireTrustNFT, fan1, franchiseId } =
          await loadFixture(deployFixture);
        const now = await time.latest();

        await expect(
          wireTrustNFT.mint(
            fan1.address,
            franchiseId,
            0,
            "Ticket",
            "desc",
            "uri",
            ethers.parseEther("0.1"),
            now - 100
          )
        ).to.be.revertedWithCustomError(wireTrustNFT, "EventMustBeInFuture");
      });

      it("should allow franchise admin to mint non-BADGE NFTs", async function () {
        const { wireTrustNFT, franchiseAdmin, fan1, franchiseId } =
          await loadFixture(deployFixture);
        const now = await time.latest();

        await wireTrustNFT.connect(franchiseAdmin).mint(
          fan1.address,
          franchiseId,
          0, // TICKET
          "Admin Ticket",
          "desc",
          "uri",
          ethers.parseEther("0.1"),
          now + 86400
        );

        expect(await wireTrustNFT.ownerOf(1)).to.equal(fan1.address);
      });

      it("should reject non-admin/non-owner minting non-BADGE NFTs", async function () {
        const { wireTrustNFT, fan1, fan2, franchiseId } =
          await loadFixture(deployFixture);
        const now = await time.latest();

        await expect(
          wireTrustNFT.connect(fan1).mint(
            fan2.address,
            franchiseId,
            0,
            "Ticket",
            "desc",
            "uri",
            ethers.parseEther("0.1"),
            now + 86400
          )
        ).to.be.revertedWithCustomError(wireTrustNFT, "NotFranchiseAdmin");
      });
    });

    describe("Soulbound enforcement", function () {
      it("should prevent transferring a BADGE (soulbound)", async function () {
        const { wireTrustNFT, fan1, fan2, franchiseId } =
          await loadFixture(deployFixture);

        await wireTrustNFT.mint(
          fan1.address,
          franchiseId,
          3, // BADGE
          "Badge",
          "desc",
          "uri",
          0,
          0
        );

        const price = ethers.parseEther("0.01");
        await expect(
          wireTrustNFT.connect(fan1).listForSale(1, price)
        ).to.be.revertedWithCustomError(wireTrustNFT, "SoulboundToken");
      });

      it("should prevent safeTransferFrom on BADGE", async function () {
        const { wireTrustNFT, fan1, fan2, franchiseId } =
          await loadFixture(deployFixture);

        await wireTrustNFT.mint(
          fan1.address,
          franchiseId,
          3,
          "Badge",
          "desc",
          "uri",
          0,
          0
        );

        await expect(
          wireTrustNFT
            .connect(fan1)
            ["safeTransferFrom(address,address,uint256)"](
              fan1.address,
              fan2.address,
              1
            )
        ).to.be.revertedWithCustomError(wireTrustNFT, "SoulboundToken");
      });
    });

    describe("Transfer with price cap", function () {
      it("should transfer a TICKET within resale cap", async function () {
        const { wireTrustNFT, fan1, fan2, treasury, franchiseId } =
          await loadFixture(deployFixture);
        const facePrice = ethers.parseEther("1");
        const { tokenId } = await mintTicket(
          wireTrustNFT,
          fan1.address,
          franchiseId,
          facePrice
        );

        const resalePrice = (facePrice * 110n) / 100n; // exactly at cap
        const fee = (resalePrice * 250n) / 10000n; // 2.5%

        const treasuryBefore = await ethers.provider.getBalance(
          treasury.address
        );

        // Seller lists, buyer purchases
        await wireTrustNFT.connect(fan1).listForSale(tokenId, resalePrice);
        await wireTrustNFT.connect(fan2).buyToken(tokenId, { value: resalePrice });

        expect(await wireTrustNFT.ownerOf(tokenId)).to.equal(fan2.address);

        const treasuryAfter = await ethers.provider.getBalance(
          treasury.address
        );
        expect(treasuryAfter - treasuryBefore).to.equal(fee);
      });

      it("should reject transfer exceeding resale price cap", async function () {
        const { wireTrustNFT, fan1, fan2, franchiseId } =
          await loadFixture(deployFixture);
        const facePrice = ethers.parseEther("1");
        const { tokenId } = await mintTicket(
          wireTrustNFT,
          fan1.address,
          franchiseId,
          facePrice
        );

        const tooHigh = (facePrice * 111n) / 100n; // above 110% cap

        await expect(
          wireTrustNFT
            .connect(fan1)
            .listForSale(tokenId, tooHigh)
        ).to.be.revertedWithCustomError(
          wireTrustNFT,
          "ExceedsResalePriceCap"
        );
      });

      it("should reject transfer when max transfers reached", async function () {
        const { wireTrustNFT, fan1, fan2, fan3, franchiseId } =
          await loadFixture(deployFixture);
        const facePrice = ethers.parseEther("1");
        const { tokenId } = await mintTicket(
          wireTrustNFT,
          fan1.address,
          franchiseId,
          facePrice
        );

        const price = facePrice; // within cap

        // First transfer (maxTransfers=1 for TICKET)
        await wireTrustNFT.connect(fan1).listForSale(tokenId, price);
        await wireTrustNFT.connect(fan2).buyToken(tokenId, { value: price });

        // Second transfer should fail
        await wireTrustNFT.connect(fan2).listForSale(tokenId, price);
        await expect(
          wireTrustNFT
            .connect(fan3)
            .buyToken(tokenId, { value: price })
        ).to.be.revertedWithCustomError(wireTrustNFT, "MaxTransfersReached");
      });

      it("should reject transfer by non-owner", async function () {
        const { wireTrustNFT, fan1, fan2, franchiseId } =
          await loadFixture(deployFixture);
        const facePrice = ethers.parseEther("1");
        const { tokenId } = await mintTicket(
          wireTrustNFT,
          fan1.address,
          franchiseId,
          facePrice
        );

        await expect(
          wireTrustNFT
            .connect(fan2)
            .listForSale(tokenId, facePrice)
        ).to.be.revertedWithCustomError(wireTrustNFT, "NotTokenOwner");
      });

      it("should reject transfer with incorrect payment", async function () {
        const { wireTrustNFT, fan1, fan2, franchiseId } =
          await loadFixture(deployFixture);
        const facePrice = ethers.parseEther("1");
        const { tokenId } = await mintTicket(
          wireTrustNFT,
          fan1.address,
          franchiseId,
          facePrice
        );

        await wireTrustNFT.connect(fan1).listForSale(tokenId, facePrice);
        await expect(
          wireTrustNFT
            .connect(fan2)
            .buyToken(tokenId, {
              value: ethers.parseEther("0.5"),
            })
        ).to.be.revertedWithCustomError(wireTrustNFT, "IncorrectPayment");
      });

      it("should require buyToken for TICKET/EXPERIENCE (block raw transfer)", async function () {
        const { wireTrustNFT, fan1, fan2, franchiseId } =
          await loadFixture(deployFixture);
        const facePrice = ethers.parseEther("1");
        const { tokenId } = await mintTicket(
          wireTrustNFT,
          fan1.address,
          franchiseId,
          facePrice
        );

        await expect(
          wireTrustNFT
            .connect(fan1)
            ["safeTransferFrom(address,address,uint256)"](
              fan1.address,
              fan2.address,
              tokenId
            )
        ).to.be.revertedWithCustomError(wireTrustNFT, "UseTransferWithPrice");
      });

      it("should allow free transfer of COLLECTIBLE via safeTransferFrom", async function () {
        const { wireTrustNFT, fan1, fan2, franchiseId } =
          await loadFixture(deployFixture);

        await wireTrustNFT.mint(
          fan1.address,
          franchiseId,
          2, // COLLECTIBLE
          "Card",
          "desc",
          "uri",
          0,
          0
        );

        // Collectibles don't require transferWithPrice
        await wireTrustNFT
          .connect(fan1)
          ["safeTransferFrom(address,address,uint256)"](
            fan1.address,
            fan2.address,
            1
          );

        expect(await wireTrustNFT.ownerOf(1)).to.equal(fan2.address);
      });
    });

    describe("Verify at venue", function () {
      it("should mark token as USED", async function () {
        const { wireTrustNFT, fan1, franchiseId } =
          await loadFixture(deployFixture);
        const facePrice = ethers.parseEther("0.1");
        const { tokenId } = await mintTicket(
          wireTrustNFT,
          fan1.address,
          franchiseId,
          facePrice
        );

        await expect(wireTrustNFT.verifyAtVenue(tokenId))
          .to.emit(wireTrustNFT, "NFTVerified")
          .withArgs(tokenId, (await ethers.getSigners())[0].address);

        const meta = await wireTrustNFT.getFullMetadata(tokenId);
        expect(meta.status).to.equal(1); // USED
      });

      it("should allow franchise admin to verify", async function () {
        const { wireTrustNFT, franchiseAdmin, fan1, franchiseId } =
          await loadFixture(deployFixture);
        const facePrice = ethers.parseEther("0.1");
        const { tokenId } = await mintTicket(
          wireTrustNFT,
          fan1.address,
          franchiseId,
          facePrice
        );

        await wireTrustNFT.connect(franchiseAdmin).verifyAtVenue(tokenId);
        const meta = await wireTrustNFT.getFullMetadata(tokenId);
        expect(meta.status).to.equal(1);
      });

      it("should reject verify from non-admin", async function () {
        const { wireTrustNFT, fan1, fan2, franchiseId } =
          await loadFixture(deployFixture);
        const facePrice = ethers.parseEther("0.1");
        const { tokenId } = await mintTicket(
          wireTrustNFT,
          fan1.address,
          franchiseId,
          facePrice
        );

        await expect(
          wireTrustNFT.connect(fan2).verifyAtVenue(tokenId)
        ).to.be.revertedWithCustomError(wireTrustNFT, "NotFranchiseAdmin");
      });

      it("should reject verifying an already used token", async function () {
        const { wireTrustNFT, fan1, franchiseId } =
          await loadFixture(deployFixture);
        const facePrice = ethers.parseEther("0.1");
        const { tokenId } = await mintTicket(
          wireTrustNFT,
          fan1.address,
          franchiseId,
          facePrice
        );

        await wireTrustNFT.verifyAtVenue(tokenId);
        await expect(
          wireTrustNFT.verifyAtVenue(tokenId)
        ).to.be.revertedWithCustomError(wireTrustNFT, "TokenNotValid");
      });

      it("should reject transfer of USED token", async function () {
        const { wireTrustNFT, fan1, fan2, franchiseId } =
          await loadFixture(deployFixture);
        const facePrice = ethers.parseEther("0.1");
        const { tokenId } = await mintTicket(
          wireTrustNFT,
          fan1.address,
          franchiseId,
          facePrice
        );

        await wireTrustNFT.verifyAtVenue(tokenId);

        await expect(
          wireTrustNFT.connect(fan1).listForSale(tokenId, facePrice)
        ).to.be.revertedWithCustomError(wireTrustNFT, "TokenNotValid");
      });
    });

    describe("Burn expired", function () {
      it("should burn an expired token", async function () {
        const { wireTrustNFT, fan1, franchiseId } =
          await loadFixture(deployFixture);
        const facePrice = ethers.parseEther("0.1");
        const { tokenId, eventTs } = await mintTicket(
          wireTrustNFT,
          fan1.address,
          franchiseId,
          facePrice,
          1 // 1 hour ahead
        );

        // Advance time past event
        await time.increaseTo(eventTs + 1);

        await expect(wireTrustNFT.burnExpired(tokenId))
          .to.emit(wireTrustNFT, "NFTBurned")
          .withArgs(tokenId, "expired");

        const meta = await wireTrustNFT.getFullMetadata(tokenId);
        expect(meta.status).to.equal(2); // EXPIRED

        // Token should no longer have an owner (burned)
        await expect(wireTrustNFT.ownerOf(tokenId)).to.be.reverted;
      });

      it("should reject burn before event time", async function () {
        const { wireTrustNFT, fan1, franchiseId } =
          await loadFixture(deployFixture);
        const facePrice = ethers.parseEther("0.1");
        const { tokenId } = await mintTicket(
          wireTrustNFT,
          fan1.address,
          franchiseId,
          facePrice
        );

        await expect(
          wireTrustNFT.burnExpired(tokenId)
        ).to.be.revertedWithCustomError(wireTrustNFT, "NotYetExpired");
      });

      it("should reject burn for token with no expiry", async function () {
        const { wireTrustNFT, fan1, franchiseId } =
          await loadFixture(deployFixture);

        // COLLECTIBLE has no event timestamp
        await wireTrustNFT.mint(
          fan1.address,
          franchiseId,
          2,
          "Card",
          "desc",
          "uri",
          0,
          0
        );

        await expect(
          wireTrustNFT.burnExpired(1)
        ).to.be.revertedWithCustomError(wireTrustNFT, "NoExpirySet");
      });

      it("should reject burn for already used token", async function () {
        const { wireTrustNFT, fan1, franchiseId } =
          await loadFixture(deployFixture);
        const facePrice = ethers.parseEther("0.1");
        const { tokenId, eventTs } = await mintTicket(
          wireTrustNFT,
          fan1.address,
          franchiseId,
          facePrice,
          1
        );

        // Verify at venue first
        await wireTrustNFT.verifyAtVenue(tokenId);

        // Advance time past event
        await time.increaseTo(eventTs + 1);

        await expect(
          wireTrustNFT.burnExpired(tokenId)
        ).to.be.revertedWithCustomError(wireTrustNFT, "AlreadyBurnedOrUsed");
      });

      it("should reject transfer of expired (but not yet burned) token", async function () {
        const { wireTrustNFT, fan1, fan2, franchiseId } =
          await loadFixture(deployFixture);
        const facePrice = ethers.parseEther("0.1");
        const { tokenId, eventTs } = await mintTicket(
          wireTrustNFT,
          fan1.address,
          franchiseId,
          facePrice,
          1
        );

        // List before time advances
        await wireTrustNFT.connect(fan1).listForSale(tokenId, facePrice);

        // Advance past event
        await time.increaseTo(eventTs + 1);

        await expect(
          wireTrustNFT
            .connect(fan2)
            .buyToken(tokenId, { value: facePrice })
        ).to.be.revertedWithCustomError(wireTrustNFT, "TokenExpired");
      });

      it("anyone can call burnExpired", async function () {
        const { wireTrustNFT, fan1, fan2, franchiseId } =
          await loadFixture(deployFixture);
        const facePrice = ethers.parseEther("0.1");
        const { tokenId, eventTs } = await mintTicket(
          wireTrustNFT,
          fan1.address,
          franchiseId,
          facePrice,
          1
        );

        await time.increaseTo(eventTs + 1);

        // fan2 (not the owner) can burn
        await wireTrustNFT.connect(fan2).burnExpired(tokenId);
        const meta = await wireTrustNFT.getFullMetadata(tokenId);
        expect(meta.status).to.equal(2); // EXPIRED
      });
    });
  });
});
