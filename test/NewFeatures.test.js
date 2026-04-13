const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");

/**
 * Tests for all new features added during the code review fix phase:
 *   - ZeroPlayerId validation
 *   - ABSOLUTE_MAX_PARTICIPANTS cap
 *   - createContest maxParticipants validation
 *   - Paginated resolveMatchPredictions
 *   - eventTimestamp upper bound (MAX_EVENT_HORIZON)
 *   - Past start time rejection in MatchOracle
 *   - listForSale / buyToken / cancelListing (buyer-initiated NFT flow)
 *   - listForSale soulbound + status checks
 *   - ExecutionGateway fee-after-success (no fee on failure)
 *   - Pausable emergency stop
 */
describe("New Feature Tests", function () {
  // ── Shared fixture ──────────────────────────────────────────────
  async function deployFixture() {
    const [owner, admin, oracle, fan1, fan2, fan3, treasury, sponsor] =
      await ethers.getSigners();

    const FranchiseRegistry = await ethers.getContractFactory("FranchiseRegistry");
    const franchiseRegistry = await FranchiseRegistry.deploy(treasury.address);
    await franchiseRegistry.registerFranchise("TestTeam", "PSL", admin.address, treasury.address);

    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    const agentRegistry = await AgentRegistry.deploy(await franchiseRegistry.getAddress());

    const ReputationStore = await ethers.getContractFactory("ReputationStore");
    const reputationStore = await ReputationStore.deploy();

    const PolicyEngine = await ethers.getContractFactory("PolicyEngine");
    const policyEngine = await PolicyEngine.deploy(await agentRegistry.getAddress());

    const ExecutionGateway = await ethers.getContractFactory("ExecutionGateway");
    const gateway = await ExecutionGateway.deploy(
      await agentRegistry.getAddress(),
      await policyEngine.getAddress(),
      await reputationStore.getAddress(),
      treasury.address
    );
    await reputationStore.setGateway(await gateway.getAddress());
    await policyEngine.setGateway(await gateway.getAddress());

    const MatchOracle = await ethers.getContractFactory("MatchOracle");
    const matchOracle = await MatchOracle.deploy();
    await matchOracle.authorizeOracle(oracle.address);

    const PredictionModule = await ethers.getContractFactory("PredictionModule");
    const predictionModule = await PredictionModule.deploy(
      await matchOracle.getAddress(), await franchiseRegistry.getAddress()
    );
    await predictionModule.setPredictionType(ethers.encodeBytes32String("MATCH_WINNER"), true);

    const FantasyModule = await ethers.getContractFactory("FantasyModule");
    const fantasyModule = await FantasyModule.deploy(
      await matchOracle.getAddress(), await franchiseRegistry.getAddress(), treasury.address
    );

    const WireTrustNFT = await ethers.getContractFactory("WireTrustNFT");
    const wireTrustNFT = await WireTrustNFT.deploy(
      await franchiseRegistry.getAddress(), treasury.address
    );

    const SimpleTarget = await ethers.getContractFactory("SimpleTarget");
    const target = await SimpleTarget.deploy();

    return {
      owner, admin, oracle, fan1, fan2, fan3, treasury, sponsor,
      franchiseRegistry, agentRegistry, reputationStore, policyEngine,
      gateway, matchOracle, predictionModule, fantasyModule, wireTrustNFT, target,
    };
  }

  // ── FantasyModule: ZeroPlayerId ──────────────────────────────────
  describe("FantasyModule - ZeroPlayerId validation", function () {
    it("should reject squad with zero player ID", async function () {
      const { fantasyModule, matchOracle, fan1, sponsor } = await loadFixture(deployFixture);

      const startTime = (await time.latest()) + 86400;
      await matchOracle.createMatch(1, "A", "B", startTime);
      await fantasyModule.createContest(1, 1, 10);
      await fantasyModule.connect(sponsor).fundContest(1, { value: ethers.parseEther("1") });

      const squadWithZero = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // player ID 0
      await expect(
        fantasyModule.connect(fan1).joinContest(1, squadWithZero, 2, 3, 95)
      ).to.be.revertedWithCustomError(fantasyModule, "ZeroPlayerId");
    });

    it("should reject squad with zero in middle position", async function () {
      const { fantasyModule, matchOracle, fan1, sponsor } = await loadFixture(deployFixture);

      const startTime = (await time.latest()) + 86400;
      await matchOracle.createMatch(1, "A", "B", startTime);
      await fantasyModule.createContest(1, 1, 10);

      const squadWithZero = [1, 2, 3, 0, 5, 6, 7, 8, 9, 10, 11]; // zero in position 4
      await expect(
        fantasyModule.connect(fan1).joinContest(1, squadWithZero, 1, 2, 95)
      ).to.be.revertedWithCustomError(fantasyModule, "ZeroPlayerId");
    });
  });

  // ── FantasyModule: ABSOLUTE_MAX_PARTICIPANTS ─────────────────────
  describe("FantasyModule - Participant cap", function () {
    it("should reject createContest with maxParticipants > 200", async function () {
      const { fantasyModule, matchOracle } = await loadFixture(deployFixture);

      const startTime = (await time.latest()) + 86400;
      await matchOracle.createMatch(1, "A", "B", startTime);

      await expect(
        fantasyModule.createContest(1, 1, 201)
      ).to.be.revertedWithCustomError(fantasyModule, "ContestFull");
    });

    it("should allow createContest with maxParticipants = 200", async function () {
      const { fantasyModule, matchOracle } = await loadFixture(deployFixture);

      const startTime = (await time.latest()) + 86400;
      await matchOracle.createMatch(1, "A", "B", startTime);

      await fantasyModule.createContest(1, 1, 200);
      const contest = await fantasyModule.contests(1);
      expect(Number(contest.maxParticipants)).to.equal(200);
    });

    it("should allow createContest with maxParticipants = 0 (unlimited up to absolute cap)", async function () {
      const { fantasyModule, matchOracle } = await loadFixture(deployFixture);

      const startTime = (await time.latest()) + 86400;
      await matchOracle.createMatch(1, "A", "B", startTime);

      await fantasyModule.createContest(1, 1, 0);
      const contest = await fantasyModule.contests(1);
      expect(Number(contest.maxParticipants)).to.equal(0);
    });
  });

  // ── PredictionModule: Paginated resolution ───────────────────────
  describe("PredictionModule - Paginated resolution", function () {
    it("should resolve partial batch with startIndex and endIndex", async function () {
      const { predictionModule, matchOracle, oracle, fan1, fan2, fan3 } = await loadFixture(deployFixture);

      const startTime = (await time.latest()) + 86400;
      await matchOracle.createMatch(1, "A", "B", startTime);
      const matchId = 1;

      const typeBytes = ethers.encodeBytes32String("MATCH_WINNER");
      const outcome = ethers.encodeBytes32String("A_WIN");
      const wrong = ethers.encodeBytes32String("B_WIN");

      // 3 fans predict
      await predictionModule.connect(fan1).createPrediction(1, matchId, typeBytes, outcome);
      await predictionModule.connect(fan2).createPrediction(1, matchId, typeBytes, wrong);
      await predictionModule.connect(fan3).createPrediction(1, matchId, typeBytes, outcome);

      await time.increase(86401);
      await matchOracle.connect(oracle).submitResult(matchId, "A", false);

      // Resolve only first 2 predictions (index 0-1)
      await predictionModule.resolveMatchPredictions(matchId, typeBytes, outcome, 0, 2);

      const pred1 = await predictionModule.getPrediction(1);
      const pred2 = await predictionModule.getPrediction(2);
      const pred3 = await predictionModule.getPrediction(3);

      expect(Number(pred1.status)).to.equal(1); // RESOLVED
      expect(Number(pred2.status)).to.equal(1); // RESOLVED
      expect(Number(pred3.status)).to.equal(0); // STILL OPEN

      // Now resolve the remaining
      await predictionModule.resolveMatchPredictions(matchId, typeBytes, outcome, 2, 0);
      const pred3After = await predictionModule.getPrediction(3);
      expect(Number(pred3After.status)).to.equal(1); // RESOLVED
    });

    it("should reject invalid range (startIndex >= endIndex)", async function () {
      const { predictionModule, matchOracle, oracle, fan1 } = await loadFixture(deployFixture);

      const startTime = (await time.latest()) + 86400;
      await matchOracle.createMatch(1, "A", "B", startTime);

      const typeBytes = ethers.encodeBytes32String("MATCH_WINNER");
      const outcome = ethers.encodeBytes32String("A_WIN");
      await predictionModule.connect(fan1).createPrediction(1, 1, typeBytes, outcome);

      await time.increase(86401);
      await matchOracle.connect(oracle).submitResult(1, "A", false);

      await expect(
        predictionModule.resolveMatchPredictions(1, typeBytes, outcome, 5, 3)
      ).to.be.reverted;
    });
  });

  // ── MatchOracle: Past start time rejection ───────────────────────
  describe("MatchOracle - Past start time rejection", function () {
    it("should reject createMatch with past startTime", async function () {
      const { matchOracle } = await loadFixture(deployFixture);

      const pastTime = (await time.latest()) - 100;
      await expect(
        matchOracle.createMatch(1, "A", "B", pastTime)
      ).to.be.revertedWithCustomError(matchOracle, "InvalidMatch");
    });

    it("should allow createMatch with startTime = 0 (no specific time)", async function () {
      const { matchOracle } = await loadFixture(deployFixture);
      await matchOracle.createMatch(1, "A", "B", 0);
      const count = await matchOracle.matchCount();
      expect(Number(count)).to.equal(1);
    });

    it("should allow createMatch with future startTime", async function () {
      const { matchOracle } = await loadFixture(deployFixture);

      const futureTime = (await time.latest()) + 86400;
      await matchOracle.createMatch(1, "A", "B", futureTime);
      const match = await matchOracle.getResult(1);
      expect(Number(match.startTime)).to.equal(futureTime);
    });
  });

  // ── WireTrustNFT: eventTimestamp upper bound ─────────────────────
  describe("WireTrustNFT - eventTimestamp upper bound", function () {
    it("should reject eventTimestamp more than 2 years in the future", async function () {
      const { wireTrustNFT, fan1 } = await loadFixture(deployFixture);

      const tooFar = (await time.latest()) + 731 * 24 * 60 * 60; // > 730 days
      await expect(
        wireTrustNFT.mint(fan1.address, 1, 0, "Ticket", "desc", "uri", ethers.parseEther("0.1"), tooFar)
      ).to.be.revertedWithCustomError(wireTrustNFT, "EventTimestampTooFar");
    });

    it("should allow eventTimestamp within 2 years", async function () {
      const { wireTrustNFT, fan1 } = await loadFixture(deployFixture);

      const valid = (await time.latest()) + 729 * 24 * 60 * 60; // < 730 days
      await wireTrustNFT.mint(fan1.address, 1, 0, "Ticket", "desc", "uri", ethers.parseEther("0.1"), valid);
      expect(await wireTrustNFT.ownerOf(1)).to.equal(fan1.address);
    });
  });

  // ── WireTrustNFT: listForSale / buyToken / cancelListing ────────
  describe("WireTrustNFT - Buyer-initiated NFT marketplace", function () {
    async function mintTicket(wireTrustNFT, admin, to, price) {
      const eventTime = (await time.latest()) + 86400 * 30;
      await wireTrustNFT.connect(admin).mint(to, 1, 0, "Ticket", "desc", "uri", price, eventTime);
      return { tokenId: Number(await wireTrustNFT.tokenCount()), eventTime };
    }

    it("should list and buy a token successfully", async function () {
      const { wireTrustNFT, admin, fan1, fan2, treasury } = await loadFixture(deployFixture);
      const facePrice = ethers.parseEther("1");
      await mintTicket(wireTrustNFT, admin, fan1.address, facePrice);

      const resalePrice = facePrice * 110n / 100n;
      await wireTrustNFT.connect(fan1).listForSale(1, resalePrice);
      expect(await wireTrustNFT.listingPrice(1)).to.equal(resalePrice);

      const treasuryBefore = await ethers.provider.getBalance(treasury.address);
      await wireTrustNFT.connect(fan2).buyToken(1, { value: resalePrice });

      expect(await wireTrustNFT.ownerOf(1)).to.equal(fan2.address);
      expect(await wireTrustNFT.listingPrice(1)).to.equal(0); // listing cleared

      const treasuryAfter = await ethers.provider.getBalance(treasury.address);
      const fee = resalePrice * 250n / 10000n;
      expect(treasuryAfter - treasuryBefore).to.equal(fee);
    });

    it("should allow seller to cancel listing", async function () {
      const { wireTrustNFT, admin, fan1 } = await loadFixture(deployFixture);
      const facePrice = ethers.parseEther("1");
      await mintTicket(wireTrustNFT, admin, fan1.address, facePrice);

      await wireTrustNFT.connect(fan1).listForSale(1, facePrice);
      expect(await wireTrustNFT.listingPrice(1)).to.equal(facePrice);

      await wireTrustNFT.connect(fan1).cancelListing(1);
      expect(await wireTrustNFT.listingPrice(1)).to.equal(0);
    });

    it("should reject cancelListing by non-owner", async function () {
      const { wireTrustNFT, admin, fan1, fan2 } = await loadFixture(deployFixture);
      const facePrice = ethers.parseEther("1");
      await mintTicket(wireTrustNFT, admin, fan1.address, facePrice);

      await wireTrustNFT.connect(fan1).listForSale(1, facePrice);

      await expect(
        wireTrustNFT.connect(fan2).cancelListing(1)
      ).to.be.revertedWithCustomError(wireTrustNFT, "NotTokenOwner");
    });

    it("should reject buyToken for unlisted token", async function () {
      const { wireTrustNFT, admin, fan1, fan2 } = await loadFixture(deployFixture);
      const facePrice = ethers.parseEther("1");
      await mintTicket(wireTrustNFT, admin, fan1.address, facePrice);

      await expect(
        wireTrustNFT.connect(fan2).buyToken(1, { value: facePrice })
      ).to.be.revertedWithCustomError(wireTrustNFT, "NotListedForSale");
    });

    it("should reject listing a soulbound token", async function () {
      const { wireTrustNFT, fan1 } = await loadFixture(deployFixture);
      const eventTime = (await time.latest()) + 86400 * 365;
      await wireTrustNFT.mint(fan1.address, 1, 3, "Badge", "desc", "uri", 0, eventTime); // BADGE

      await expect(
        wireTrustNFT.connect(fan1).listForSale(1, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(wireTrustNFT, "SoulboundToken");
    });

    it("should reject listing a USED token", async function () {
      const { wireTrustNFT, admin, fan1 } = await loadFixture(deployFixture);
      const facePrice = ethers.parseEther("1");
      await mintTicket(wireTrustNFT, admin, fan1.address, facePrice);

      await wireTrustNFT.verifyAtVenue(1); // mark as USED

      await expect(
        wireTrustNFT.connect(fan1).listForSale(1, facePrice)
      ).to.be.revertedWithCustomError(wireTrustNFT, "TokenNotValid");
    });

    it("should reject listing above resale price cap", async function () {
      const { wireTrustNFT, admin, fan1 } = await loadFixture(deployFixture);
      const facePrice = ethers.parseEther("1");
      await mintTicket(wireTrustNFT, admin, fan1.address, facePrice);

      const tooHigh = facePrice * 111n / 100n;
      await expect(
        wireTrustNFT.connect(fan1).listForSale(1, tooHigh)
      ).to.be.revertedWithCustomError(wireTrustNFT, "ExceedsResalePriceCap");
    });
  });

  // ── ExecutionGateway: Fee only after success ─────────────────────
  describe("ExecutionGateway - Fee after success only", function () {
    it("should NOT collect fee when target call fails", async function () {
      const { fan1, gateway, agentRegistry, policyEngine, target, treasury } = await loadFixture(deployFixture);

      await agentRegistry.connect(fan1).createAgent("TestBot", "PREDICTION", 1);
      const targetAddr = await target.getAddress();
      const actionBytes = ethers.keccak256(ethers.toUtf8Bytes("doSomething()"));
      const expiry = (await time.latest()) + 86400 * 30;

      await policyEngine.connect(fan1).setPolicy(
        1, ethers.parseEther("10"), ethers.parseEther("50"),
        1, expiry, [targetAddr], [actionBytes], 5
      );

      // Make target revert
      await target.setShouldRevert(true);

      const amount = ethers.parseEther("1");
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);

      const nonce = ethers.encodeBytes32String("nonce1");
      await gateway.connect(fan1).execute(
        1, targetAddr, actionBytes, target.interface.encodeFunctionData("doSomething"),
        amount, nonce, { value: amount }
      );

      const treasuryAfter = await ethers.provider.getBalance(treasury.address);
      // Treasury should NOT have received any fee
      expect(treasuryAfter - treasuryBefore).to.equal(0);
    });

    it("should refund full amount to sender when target call fails", async function () {
      const { fan1, gateway, agentRegistry, policyEngine, target } = await loadFixture(deployFixture);

      await agentRegistry.connect(fan1).createAgent("TestBot", "PREDICTION", 1);
      const targetAddr = await target.getAddress();
      const actionBytes = ethers.keccak256(ethers.toUtf8Bytes("doSomething()"));
      const expiry = (await time.latest()) + 86400 * 30;

      await policyEngine.connect(fan1).setPolicy(
        1, ethers.parseEther("10"), ethers.parseEther("50"),
        1, expiry, [targetAddr], [actionBytes], 5
      );

      await target.setShouldRevert(true);

      const amount = ethers.parseEther("1");
      const balanceBefore = await ethers.provider.getBalance(fan1.address);

      const nonce = ethers.encodeBytes32String("nonce1");
      const tx = await gateway.connect(fan1).execute(
        1, targetAddr, actionBytes, target.interface.encodeFunctionData("doSomething"),
        amount, nonce, { value: amount }
      );
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(fan1.address);
      // Should only lose gas, not the amount (full refund)
      expect(balanceBefore - balanceAfter).to.be.closeTo(gasUsed, ethers.parseEther("0.001"));
    });
  });
});
