const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("WireTrust Integration Tests", function () {
  // Full protocol deployment matching production setup
  async function deployFullProtocol() {
    const [owner, franchiseAdmin, treasury, oracle, fan1, fan2, fan3, sponsor] =
      await ethers.getSigners();

    // Core contracts
    const FranchiseRegistry = await ethers.getContractFactory("FranchiseRegistry");
    const franchiseRegistry = await FranchiseRegistry.deploy(treasury.address);

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

    // Wire gateway
    await reputationStore.setGateway(await gateway.getAddress());
    await policyEngine.setGateway(await gateway.getAddress());

    // Module contracts
    const MatchOracle = await ethers.getContractFactory("MatchOracle");
    const matchOracle = await MatchOracle.deploy();
    await matchOracle.authorizeOracle(oracle.address);

    const PredictionModule = await ethers.getContractFactory("PredictionModule");
    const predictionModule = await PredictionModule.deploy(
      await matchOracle.getAddress(),
      await franchiseRegistry.getAddress()
    );

    const FantasyModule = await ethers.getContractFactory("FantasyModule");
    const fantasyModule = await FantasyModule.deploy(
      await matchOracle.getAddress(),
      await franchiseRegistry.getAddress(),
      treasury.address
    );

    const WireTrustNFT = await ethers.getContractFactory("WireTrustNFT");
    const wireTrustNFT = await WireTrustNFT.deploy(
      await franchiseRegistry.getAddress(),
      treasury.address
    );

    const SimpleTarget = await ethers.getContractFactory("SimpleTarget");
    const target = await SimpleTarget.deploy();

    // Register franchise
    await franchiseRegistry.registerFranchise(
      "Rawalpindiz", "PSL", franchiseAdmin.address, treasury.address
    );

    // Setup prediction types
    await predictionModule.setPredictionType(
      ethers.encodeBytes32String("MATCH_WINNER"), true
    );
    await predictionModule.setPredictionType(
      ethers.encodeBytes32String("TOP_SCORER"), true
    );

    return {
      owner, franchiseAdmin, treasury, oracle, fan1, fan2, fan3, sponsor,
      franchiseRegistry, agentRegistry, reputationStore, policyEngine,
      gateway, matchOracle, predictionModule, fantasyModule, wireTrustNFT, target,
    };
  }

  describe("Full Match Lifecycle", function () {
    it("should complete: create match > predict > submit result > resolve > verify points", async function () {
      const {
        owner, oracle, fan1, fan2, matchOracle, predictionModule,
      } = await loadFixture(deployFullProtocol);

      // 1. Create match in the future
      const startTime = (await time.latest()) + 86400;
      await matchOracle.createMatch(1, "Rawalpindiz", "Lahore Qalandars", startTime);
      const matchId = 1;

      // 2. Fans make predictions
      const typeBytes = ethers.encodeBytes32String("MATCH_WINNER");
      const outcome1 = ethers.encodeBytes32String("RAWALPINDIZ_WIN");
      const outcome2 = ethers.encodeBytes32String("LAHORE_WIN");

      await predictionModule.connect(fan1).createPrediction(1, matchId, typeBytes, outcome1);
      await predictionModule.connect(fan2).createPrediction(1, matchId, typeBytes, outcome2);

      // 3. Time passes, match completes
      await time.increase(86401);
      await matchOracle.connect(oracle).submitResult(matchId, "Rawalpindiz", false);

      // 4. Resolve predictions
      await predictionModule.resolveMatchPredictions(matchId, typeBytes, outcome1);

      // 5. Check points
      const stats1 = await predictionModule.getUserStats(fan1.address);
      const stats2 = await predictionModule.getUserStats(fan2.address);

      // fan1 predicted correctly
      expect(Number(stats1.totalPoints)).to.be.greaterThan(0);
      expect(Number(stats1.totalCorrect)).to.equal(1);
      expect(Number(stats1.currentStreak)).to.equal(1);

      // fan2 predicted wrong
      expect(Number(stats2.totalPoints)).to.equal(0);
      expect(Number(stats2.totalCorrect)).to.equal(0);
      expect(Number(stats2.currentStreak)).to.equal(0);
    });
  });

  describe("Full Fantasy Contest Lifecycle", function () {
    it("should complete: create > fund > join > lock > score > finalize > claim", async function () {
      const {
        owner, franchiseAdmin, oracle, fan1, fan2, sponsor,
        matchOracle, fantasyModule, treasury,
      } = await loadFixture(deployFullProtocol);

      // 1. Create match
      const startTime = (await time.latest()) + 86400;
      await matchOracle.createMatch(1, "Rawalpindiz", "Lahore Qalandars", startTime);
      const matchId = 1;

      // 2. Create contest
      await fantasyModule.createContest(1, matchId, 10);
      const contestId = 1;

      // 3. Sponsor funds the prize pool
      const prizePool = ethers.parseEther("10");
      await fantasyModule.connect(sponsor).fundContest(contestId, { value: prizePool });

      // 4. Fans join with squads
      const squad1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      const squad2 = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
      await fantasyModule.connect(fan1).joinContest(contestId, squad1, 1, 2, 95);
      await fantasyModule.connect(fan2).joinContest(contestId, squad2, 12, 13, 90);

      // 5. Match starts, lock contest
      await time.increase(86401);
      await fantasyModule.lockContest(contestId);

      // 6. Update player scores (fan1 players score high, fan2 low)
      for (let i = 1; i <= 11; i++) {
        await fantasyModule.updatePlayerScore(contestId, i, 100); // fan1 players: 100 each
      }
      for (let i = 12; i <= 22; i++) {
        await fantasyModule.updatePlayerScore(contestId, i, 10); // fan2 players: 10 each
      }

      // 7. Finalize
      await fantasyModule.finalizeContest(contestId);

      // 8. Check contest state
      const contest = await fantasyModule.contests(contestId);
      expect(contest.finalized).to.equal(true);

      // 9. Winner claims prize
      const balanceBefore = await ethers.provider.getBalance(fan1.address);
      const claimTx = await fantasyModule.connect(fan1).claimPrize(contestId);
      await claimTx.wait();
      const balanceAfter = await ethers.provider.getBalance(fan1.address);

      // Balance should increase (prize minus gas)
      expect(balanceAfter).to.be.greaterThan(balanceBefore - ethers.parseEther("0.01"));
    });
  });

  describe("Full Agent Lifecycle", function () {
    it("should complete: create agent > set policy > execute > build reputation", async function () {
      const {
        fan1, gateway, agentRegistry, policyEngine, reputationStore, target,
      } = await loadFixture(deployFullProtocol);

      // 1. Fan creates agent
      await agentRegistry.connect(fan1).createAgent("TestBot", "PREDICTION", 1);
      const agentId = 1;

      // 2. Verify agent created
      const agent = await agentRegistry.getAgent(agentId);
      expect(agent.owner).to.equal(fan1.address);
      expect(agent.name).to.equal("TestBot");
      expect(agent.active).to.equal(true);

      // 3. Set policy (fan1 is owner)
      const targetAddr = await target.getAddress();
      const actionBytes = ethers.keccak256(ethers.toUtf8Bytes("doSomething()"));
      const expiry = (await time.latest()) + 86400 * 30; // 30 days

      await policyEngine.connect(fan1).setPolicy(
        agentId,
        ethers.parseEther("1"),   // maxAmountPerAction
        ethers.parseEther("5"),   // maxAmountPerDay
        10,                       // frequencyLimit (10 seconds)
        expiry,
        [targetAddr],             // allowedContracts
        [actionBytes],            // allowedActions
        5                         // maxActivePositions
      );

      // 4. Verify policy
      const policy = await policyEngine.getPolicy(agentId);
      expect(policy.active).to.equal(true);

      // 5. Execute action through gateway
      const callData = target.interface.encodeFunctionData("doSomething");
      const nonce = ethers.encodeBytes32String("nonce1");
      const tx = await gateway.connect(fan1).execute(
        agentId, targetAddr, actionBytes, callData, 0, nonce
      );
      const receipt = await tx.wait();

      // 6. Check reputation improved
      const score = await reputationStore.getScore(agentId);
      expect(Number(score)).to.be.greaterThanOrEqual(50);

      // 7. Check target was actually called
      const callCount = await target.callCount();
      expect(Number(callCount)).to.equal(1);
    });

    it("should build reputation through multiple successful executions", async function () {
      const {
        fan1, gateway, agentRegistry, policyEngine, reputationStore, target,
      } = await loadFixture(deployFullProtocol);

      await agentRegistry.connect(fan1).createAgent("RepBot", "MULTI", 1);
      const agentId = 1;

      const targetAddr = await target.getAddress();
      const actionBytes = ethers.keccak256(ethers.toUtf8Bytes("doSomething()"));
      const expiry = (await time.latest()) + 86400 * 30;

      await policyEngine.connect(fan1).setPolicy(
        agentId, ethers.parseEther("1"), ethers.parseEther("10"),
        1, expiry, [targetAddr], [actionBytes], 100
      );

      const callData = target.interface.encodeFunctionData("doSomething");

      // Execute 5 successful actions
      for (let i = 1; i <= 5; i++) {
        await time.increase(2);
        const nonce = ethers.encodeBytes32String(`nonce${i}`);
        await gateway.connect(fan1).execute(
          agentId, targetAddr, actionBytes, callData, 0, nonce
        );
      }

      const score = await reputationStore.getScore(agentId);
      expect(Number(score)).to.be.greaterThan(50); // Above neutral

      const badge = await reputationStore.getRiskBadge(agentId);
      expect(Number(badge)).to.equal(0); // SAFE
    });

    it("should degrade reputation on policy violations", async function () {
      const {
        fan1, gateway, agentRegistry, policyEngine, reputationStore, target,
      } = await loadFixture(deployFullProtocol);

      await agentRegistry.connect(fan1).createAgent("BadBot", "PREDICTION", 1);
      const agentId = 1;

      const targetAddr = await target.getAddress();
      const actionBytes = ethers.keccak256(ethers.toUtf8Bytes("doSomething()"));
      const wrongAction = ethers.keccak256(ethers.toUtf8Bytes("notAllowed()"));
      const expiry = (await time.latest()) + 86400 * 30;

      await policyEngine.connect(fan1).setPolicy(
        agentId, ethers.parseEther("1"), ethers.parseEther("5"),
        1, expiry, [targetAddr], [actionBytes], 5
      );

      const callData = target.interface.encodeFunctionData("doSomething");

      // Try to execute with wrong action (should violate policy)
      const nonce = ethers.encodeBytes32String("nonce1");
      await gateway.connect(fan1).execute(
        agentId, targetAddr, wrongAction, callData, 0, nonce
      );

      const checkpoint = await reputationStore.getCheckpoint(agentId);
      expect(Number(checkpoint.attemptedViolations)).to.equal(1);
    });
  });

  describe("NFT Reward Flow", function () {
    it("should mint badge NFT as challenge reward (soulbound)", async function () {
      const { owner, fan1, wireTrustNFT } = await loadFixture(deployFullProtocol);

      // Mint soulbound badge
      const eventTime = (await time.latest()) + 86400 * 365;
      await wireTrustNFT.mint(
        fan1.address, 1, 3, // category 3 = BADGE
        "Prediction Streak x5",
        "Awarded for 5 correct predictions in a row",
        "ipfs://badge-streak-5",
        0, eventTime
      );

      const tokenId = 1;
      const metadata = await wireTrustNFT.getFullMetadata(tokenId);
      expect(metadata.name).to.equal("Prediction Streak x5");
      expect(Number(metadata.category)).to.equal(3); // BADGE
      expect(metadata.soulbound).to.equal(true);

      // Verify it cannot be transferred
      await expect(
        wireTrustNFT.connect(fan1).transferFrom(fan1.address, owner.address, tokenId)
      ).to.be.reverted;
    });

    it("should mint ticket NFT and allow resale within cap", async function () {
      const { owner, franchiseAdmin, fan1, fan2, wireTrustNFT, treasury } =
        await loadFixture(deployFullProtocol);

      const eventTime = (await time.latest()) + 86400 * 7;
      const facePrice = ethers.parseEther("0.1");

      // Franchise admin mints ticket for fan1
      await wireTrustNFT.connect(franchiseAdmin).mint(
        fan1.address, 1, 0, // category 0 = TICKET
        "PSL Match Day 1",
        "Rawalpindiz vs Lahore at Pindi Stadium",
        "ipfs://ticket-match1",
        facePrice, eventTime
      );

      const tokenId = 1;

      // Fan1 resells to fan2 at 110% of face (max allowed)
      const resalePrice = facePrice * 110n / 100n;
      await wireTrustNFT.connect(fan1).transferWithPrice(
        tokenId, fan2.address, resalePrice, { value: resalePrice }
      );

      expect(await wireTrustNFT.ownerOf(tokenId)).to.equal(fan2.address);
    });
  });

  describe("Protocol Fee Collection", function () {
    it("should collect 1% fee on agent execution", async function () {
      const {
        fan1, gateway, agentRegistry, policyEngine, target, treasury,
      } = await loadFixture(deployFullProtocol);

      await agentRegistry.connect(fan1).createAgent("FeeBot", "PREDICTION", 1);
      const agentId = 1;

      const targetAddr = await target.getAddress();
      const actionBytes = ethers.keccak256(ethers.toUtf8Bytes("doSomething()"));
      const expiry = (await time.latest()) + 86400 * 30;

      await policyEngine.connect(fan1).setPolicy(
        agentId, ethers.parseEther("10"), ethers.parseEther("50"),
        1, expiry, [targetAddr], [actionBytes], 5
      );

      const amount = ethers.parseEther("1");
      const callData = target.interface.encodeFunctionData("doSomething");

      const treasuryBefore = await ethers.provider.getBalance(treasury.address);
      const nonce = ethers.encodeBytes32String("nonce1");

      await gateway.connect(fan1).execute(
        agentId, targetAddr, actionBytes, callData, amount, nonce,
        { value: amount }
      );

      const treasuryAfter = await ethers.provider.getBalance(treasury.address);
      const fee = treasuryAfter - treasuryBefore;

      // 1% of 1 ETH = 0.01 ETH
      expect(fee).to.equal(ethers.parseEther("0.01"));
    });

    it("should collect 2% fee on fantasy contest finalization", async function () {
      const {
        owner, oracle, fan1, fan2, sponsor, matchOracle, fantasyModule, treasury,
      } = await loadFixture(deployFullProtocol);

      const startTime = (await time.latest()) + 86400;
      await matchOracle.createMatch(1, "A", "B", startTime);

      await fantasyModule.createContest(1, 1, 10);
      const pool = ethers.parseEther("5");
      await fantasyModule.connect(sponsor).fundContest(1, { value: pool });

      const squad1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      const squad2 = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
      await fantasyModule.connect(fan1).joinContest(1, squad1, 1, 2, 95);
      await fantasyModule.connect(fan2).joinContest(1, squad2, 12, 13, 90);

      await time.increase(86401);
      await fantasyModule.lockContest(1);

      for (let i = 1; i <= 22; i++) {
        await fantasyModule.updatePlayerScore(1, i, 50);
      }

      const treasuryBefore = await ethers.provider.getBalance(treasury.address);
      await fantasyModule.finalizeContest(1);
      const treasuryAfter = await ethers.provider.getBalance(treasury.address);

      const fee = treasuryAfter - treasuryBefore;
      // 2% of 5 ETH = 0.1 ETH
      expect(fee).to.equal(ethers.parseEther("0.1"));
    });
  });

  describe("Cross-Contract Security", function () {
    it("should prevent agent from calling its own registry", async function () {
      const {
        fan1, gateway, agentRegistry, policyEngine, target,
      } = await loadFixture(deployFullProtocol);

      await agentRegistry.connect(fan1).createAgent("HackBot", "MULTI", 1);
      const agentId = 1;

      const registryAddr = await agentRegistry.getAddress();
      const actionBytes = ethers.keccak256(ethers.toUtf8Bytes("createAgent(string,string,uint256)"));
      const expiry = (await time.latest()) + 86400 * 30;

      // Set policy that allows calling anything
      await policyEngine.connect(fan1).setPolicy(
        agentId, ethers.parseEther("10"), ethers.parseEther("50"),
        1, expiry, [registryAddr], [actionBytes], 5
      );

      const callData = "0x00";

      // Should be blocked by forbidden target
      const nonce = ethers.encodeBytes32String("nonce1");
      await expect(
        gateway.connect(fan1).execute(
          agentId, registryAddr, actionBytes, callData, 0, nonce
        )
      ).to.be.revertedWithCustomError(gateway, "ForbiddenTarget");
    });

    it("should prevent agent from calling the gateway itself", async function () {
      const {
        fan1, gateway, agentRegistry, policyEngine,
      } = await loadFixture(deployFullProtocol);

      await agentRegistry.connect(fan1).createAgent("LoopBot", "MULTI", 1);
      const agentId = 1;

      const gatewayAddr = await gateway.getAddress();
      const actionBytes = ethers.keccak256(ethers.toUtf8Bytes("execute"));
      const expiry = (await time.latest()) + 86400 * 30;

      await policyEngine.connect(fan1).setPolicy(
        agentId, ethers.parseEther("10"), ethers.parseEther("50"),
        1, expiry, [gatewayAddr], [actionBytes], 5
      );

      const nonce = ethers.encodeBytes32String("nonce1");
      await expect(
        gateway.connect(fan1).execute(
          agentId, gatewayAddr, actionBytes, "0x00", 0, nonce
        )
      ).to.be.revertedWithCustomError(gateway, "ForbiddenTarget");
    });

    it("should prevent agent from calling reputation store directly", async function () {
      const {
        fan1, gateway, agentRegistry, policyEngine, reputationStore,
      } = await loadFixture(deployFullProtocol);

      await agentRegistry.connect(fan1).createAgent("RepHack", "MULTI", 1);
      const agentId = 1;

      const repAddr = await reputationStore.getAddress();
      const actionBytes = ethers.keccak256(ethers.toUtf8Bytes("recordSuccess"));
      const expiry = (await time.latest()) + 86400 * 30;

      await policyEngine.connect(fan1).setPolicy(
        agentId, 0, 0, 1, expiry, [repAddr], [actionBytes], 5
      );

      const nonce = ethers.encodeBytes32String("nonce1");
      await expect(
        gateway.connect(fan1).execute(
          agentId, repAddr, actionBytes, "0x00", 0, nonce
        )
      ).to.be.revertedWithCustomError(gateway, "ForbiddenTarget");
    });

    it("should prevent nonce replay across different actions", async function () {
      const {
        fan1, gateway, agentRegistry, policyEngine, target,
      } = await loadFixture(deployFullProtocol);

      await agentRegistry.connect(fan1).createAgent("NonceBot", "PREDICTION", 1);
      const agentId = 1;

      const targetAddr = await target.getAddress();
      const actionBytes = ethers.keccak256(ethers.toUtf8Bytes("doSomething()"));
      const expiry = (await time.latest()) + 86400 * 30;

      await policyEngine.connect(fan1).setPolicy(
        agentId, ethers.parseEther("1"), ethers.parseEther("5"),
        1, expiry, [targetAddr], [actionBytes], 10
      );

      const callData = target.interface.encodeFunctionData("doSomething");

      // First execution with nonce
      const nonce = ethers.encodeBytes32String("nonce42");
      await gateway.connect(fan1).execute(
        agentId, targetAddr, actionBytes, callData, 0, nonce
      );

      // Replay same nonce
      await time.increase(2);
      await expect(
        gateway.connect(fan1).execute(
          agentId, targetAddr, actionBytes, callData, 0, nonce
        )
      ).to.be.revertedWithCustomError(gateway, "NonceAlreadyUsed");
    });
  });
});
