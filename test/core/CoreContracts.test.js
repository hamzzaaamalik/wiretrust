const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("WireTrust Core Contracts", function () {
  // ──────────────────────────────────────────────
  //  Shared deploy fixture
  // ──────────────────────────────────────────────

  async function deployFixture() {
    const [owner, admin1, admin2, treasury, user1, user2, randomAddr] =
      await ethers.getSigners();

    // --- FranchiseRegistry ---
    const FranchiseRegistry = await ethers.getContractFactory(
      "FranchiseRegistry"
    );
    const franchiseRegistry = await FranchiseRegistry.deploy(treasury.address);

    // --- AgentRegistry ---
    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    const agentRegistry = await AgentRegistry.deploy(
      await franchiseRegistry.getAddress()
    );

    // --- ReputationStore ---
    const ReputationStore = await ethers.getContractFactory("ReputationStore");
    const reputationStore = await ReputationStore.deploy();

    // --- PolicyEngine ---
    const PolicyEngine = await ethers.getContractFactory("PolicyEngine");
    const policyEngine = await PolicyEngine.deploy(
      await agentRegistry.getAddress()
    );

    // --- ExecutionGateway ---
    const ExecutionGateway = await ethers.getContractFactory(
      "ExecutionGateway"
    );
    const gateway = await ExecutionGateway.deploy(
      await agentRegistry.getAddress(),
      await policyEngine.getAddress(),
      await reputationStore.getAddress(),
      treasury.address
    );

    // Wire gateway into reputation + policy
    await reputationStore.setGateway(await gateway.getAddress());
    await policyEngine.setGateway(await gateway.getAddress());

    // --- SimpleTarget: a contract that accepts calls for testing ---
    const SimpleTarget = await ethers.getContractFactory("SimpleTarget");
    const target = await SimpleTarget.deploy();

    // Register a franchise so tests can create agents
    await franchiseRegistry.registerFranchise(
      "TestFranchise",
      "PSL",
      admin1.address,
      treasury.address
    );
    const franchiseId = 1;

    // Create an agent owned by user1
    const agentTx = await agentRegistry
      .connect(user1)
      .createAgent("Bot-1", "sniper", franchiseId);
    const agentId = 1;

    return {
      owner,
      admin1,
      admin2,
      treasury,
      user1,
      user2,
      randomAddr,
      franchiseRegistry,
      agentRegistry,
      reputationStore,
      policyEngine,
      gateway,
      target,
      franchiseId,
      agentId,
    };
  }

  // ================================================================
  //  1. FranchiseRegistry
  // ================================================================

  describe("FranchiseRegistry", function () {
    it("should deploy with correct treasury", async function () {
      const { franchiseRegistry, treasury } = await loadFixture(deployFixture);
      expect(await franchiseRegistry.protocolTreasury()).to.equal(
        treasury.address
      );
    });

    it("should revert deployment with zero treasury", async function () {
      const FranchiseRegistry = await ethers.getContractFactory(
        "FranchiseRegistry"
      );
      await expect(
        FranchiseRegistry.deploy(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(FranchiseRegistry, "InvalidAddress");
    });

    it("should register a franchise and return correct data", async function () {
      const { franchiseRegistry, admin2, treasury, owner } =
        await loadFixture(deployFixture);

      const tx = await franchiseRegistry.registerFranchise(
        "NewTeam",
        "IPL",
        admin2.address,
        treasury.address
      );
      await expect(tx)
        .to.emit(franchiseRegistry, "FranchiseRegistered")
        .withArgs(2, "NewTeam", "IPL", admin2.address);

      const f = await franchiseRegistry.getFranchise(2);
      expect(f.name).to.equal("NewTeam");
      expect(f.league).to.equal("IPL");
      expect(f.adminWallet).to.equal(admin2.address);
      expect(f.treasuryWallet).to.equal(treasury.address);
      expect(f.active).to.be.true;
    });

    it("should revert registerFranchise with zero admin", async function () {
      const { franchiseRegistry, treasury } = await loadFixture(deployFixture);
      await expect(
        franchiseRegistry.registerFranchise(
          "X",
          "Y",
          ethers.ZeroAddress,
          treasury.address
        )
      ).to.be.revertedWithCustomError(franchiseRegistry, "InvalidAddress");
    });

    it("should revert registerFranchise with zero treasury wallet", async function () {
      const { franchiseRegistry, user2 } = await loadFixture(deployFixture);
      await expect(
        franchiseRegistry.registerFranchise(
          "X",
          "Y",
          user2.address,
          ethers.ZeroAddress
        )
      ).to.be.revertedWithCustomError(franchiseRegistry, "InvalidAddress");
    });

    it("should revert when admin is already registered", async function () {
      const { franchiseRegistry, admin1, treasury } =
        await loadFixture(deployFixture);
      // admin1 already registered in fixture
      await expect(
        franchiseRegistry.registerFranchise(
          "Dup",
          "X",
          admin1.address,
          treasury.address
        )
      )
        .to.be.revertedWithCustomError(
          franchiseRegistry,
          "AdminAlreadyRegistered"
        )
        .withArgs(admin1.address);
    });

    it("should revert when non-owner calls registerFranchise", async function () {
      const { franchiseRegistry, user1, user2, treasury } =
        await loadFixture(deployFixture);
      await expect(
        franchiseRegistry
          .connect(user1)
          .registerFranchise("X", "Y", user2.address, treasury.address)
      ).to.be.revertedWithCustomError(
        franchiseRegistry,
        "OwnableUnauthorizedAccount"
      );
    });

    it("should deactivate a franchise", async function () {
      const { franchiseRegistry, franchiseId } =
        await loadFixture(deployFixture);
      const tx = await franchiseRegistry.deactivateFranchise(franchiseId);
      await expect(tx)
        .to.emit(franchiseRegistry, "FranchiseDeactivated")
        .withArgs(franchiseId);
      const f = await franchiseRegistry.getFranchise(franchiseId);
      expect(f.active).to.be.false;
    });

    it("should revert getFranchise with invalid id", async function () {
      const { franchiseRegistry } = await loadFixture(deployFixture);
      await expect(franchiseRegistry.getFranchise(0))
        .to.be.revertedWithCustomError(franchiseRegistry, "InvalidFranchiseId")
        .withArgs(0, 1);
      await expect(franchiseRegistry.getFranchise(999))
        .to.be.revertedWithCustomError(franchiseRegistry, "InvalidFranchiseId")
        .withArgs(999, 1);
    });

    it("should revert deactivateFranchise with invalid id", async function () {
      const { franchiseRegistry } = await loadFixture(deployFixture);
      await expect(
        franchiseRegistry.deactivateFranchise(99)
      ).to.be.revertedWithCustomError(franchiseRegistry, "InvalidFranchiseId");
    });
  });

  // ================================================================
  //  2. AgentRegistry
  // ================================================================

  describe("AgentRegistry", function () {
    it("should create an agent with correct data", async function () {
      const { agentRegistry, user1, agentId } =
        await loadFixture(deployFixture);
      const agent = await agentRegistry.getAgent(agentId);
      expect(agent.owner).to.equal(user1.address);
      expect(agent.name).to.equal("Bot-1");
      expect(agent.botType).to.equal("sniper");
      expect(agent.franchiseId).to.equal(1);
      expect(agent.active).to.be.true;
    });

    it("should emit AgentCreated event", async function () {
      const { agentRegistry, user2, franchiseId } =
        await loadFixture(deployFixture);
      await expect(
        agentRegistry.connect(user2).createAgent("Bot-2", "trader", franchiseId)
      ).to.emit(agentRegistry, "AgentCreated");
    });

    it("should revert createAgent with empty name", async function () {
      const { agentRegistry, user1, franchiseId } =
        await loadFixture(deployFixture);
      await expect(
        agentRegistry.connect(user1).createAgent("", "sniper", franchiseId)
      ).to.be.revertedWithCustomError(agentRegistry, "EmptyString");
    });

    it("should revert createAgent with empty botType", async function () {
      const { agentRegistry, user1, franchiseId } =
        await loadFixture(deployFixture);
      await expect(
        agentRegistry.connect(user1).createAgent("Bot", "", franchiseId)
      ).to.be.revertedWithCustomError(agentRegistry, "EmptyString");
    });

    it("should revert createAgent on inactive franchise", async function () {
      const { franchiseRegistry, agentRegistry, user1, franchiseId } =
        await loadFixture(deployFixture);
      await franchiseRegistry.deactivateFranchise(franchiseId);
      await expect(
        agentRegistry.connect(user1).createAgent("Bot-X", "sniper", franchiseId)
      )
        .to.be.revertedWithCustomError(agentRegistry, "FranchiseNotActive")
        .withArgs(franchiseId);
    });

    it("should deactivate an agent (owner only)", async function () {
      const { agentRegistry, user1, agentId } =
        await loadFixture(deployFixture);
      await expect(agentRegistry.connect(user1).deactivateAgent(agentId))
        .to.emit(agentRegistry, "AgentDeactivated")
        .withArgs(agentId);
      const agent = await agentRegistry.getAgent(agentId);
      expect(agent.active).to.be.false;
    });

    it("should revert deactivateAgent if not owner", async function () {
      const { agentRegistry, user2, agentId } =
        await loadFixture(deployFixture);
      await expect(
        agentRegistry.connect(user2).deactivateAgent(agentId)
      ).to.be.revertedWithCustomError(agentRegistry, "NotAgentOwner");
    });

    it("should revert deactivateAgent if already inactive", async function () {
      const { agentRegistry, user1, agentId } =
        await loadFixture(deployFixture);
      await agentRegistry.connect(user1).deactivateAgent(agentId);
      await expect(
        agentRegistry.connect(user1).deactivateAgent(agentId)
      ).to.be.revertedWithCustomError(agentRegistry, "AgentAlreadyInactive");
    });

    it("should reactivate a deactivated agent", async function () {
      const { agentRegistry, user1, agentId } =
        await loadFixture(deployFixture);
      await agentRegistry.connect(user1).deactivateAgent(agentId);
      await expect(agentRegistry.connect(user1).reactivateAgent(agentId))
        .to.emit(agentRegistry, "AgentReactivated")
        .withArgs(agentId);
      const agent = await agentRegistry.getAgent(agentId);
      expect(agent.active).to.be.true;
    });

    it("should revert reactivateAgent if already active", async function () {
      const { agentRegistry, user1, agentId } =
        await loadFixture(deployFixture);
      await expect(
        agentRegistry.connect(user1).reactivateAgent(agentId)
      ).to.be.revertedWithCustomError(agentRegistry, "AgentAlreadyActive");
    });

    it("should revert reactivateAgent if franchise is deactivated", async function () {
      const { franchiseRegistry, agentRegistry, user1, agentId, franchiseId } =
        await loadFixture(deployFixture);
      await agentRegistry.connect(user1).deactivateAgent(agentId);
      await franchiseRegistry.deactivateFranchise(franchiseId);
      await expect(
        agentRegistry.connect(user1).reactivateAgent(agentId)
      ).to.be.revertedWithCustomError(agentRegistry, "FranchiseNotActive");
    });

    it("should revert getAgent with invalid id", async function () {
      const { agentRegistry } = await loadFixture(deployFixture);
      await expect(agentRegistry.getAgent(0))
        .to.be.revertedWithCustomError(agentRegistry, "InvalidAgentId")
        .withArgs(0, 1);
      await expect(agentRegistry.getAgent(999))
        .to.be.revertedWithCustomError(agentRegistry, "InvalidAgentId")
        .withArgs(999, 1);
    });
  });

  // ================================================================
  //  3. ReputationStore
  // ================================================================

  describe("ReputationStore", function () {
    it("should set gateway once", async function () {
      const { reputationStore, gateway } = await loadFixture(deployFixture);
      expect(await reputationStore.gateway()).to.equal(
        await gateway.getAddress()
      );
    });

    it("should revert setGateway if already set", async function () {
      const { reputationStore, user1 } = await loadFixture(deployFixture);
      await expect(
        reputationStore.setGateway(user1.address)
      ).to.be.revertedWithCustomError(reputationStore, "GatewayAlreadySet");
    });

    it("should revert setGateway with zero address", async function () {
      // Deploy fresh reputation store without gateway
      const ReputationStore = await ethers.getContractFactory(
        "ReputationStore"
      );
      const fresh = await ReputationStore.deploy();
      await expect(
        fresh.setGateway(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(fresh, "InvalidGateway");
    });

    it("should revert record* if caller is not gateway", async function () {
      const { reputationStore, user1 } = await loadFixture(deployFixture);
      await expect(
        reputationStore.connect(user1).recordSuccess(1, 100)
      ).to.be.revertedWithCustomError(reputationStore, "Unauthorized");
      await expect(
        reputationStore.connect(user1).recordFailure(1, 100)
      ).to.be.revertedWithCustomError(reputationStore, "Unauthorized");
      await expect(
        reputationStore.connect(user1).recordViolation(1, 100)
      ).to.be.revertedWithCustomError(reputationStore, "Unauthorized");
    });

    it("should return NEUTRAL_SCORE (50) for agent with no history", async function () {
      const { reputationStore } = await loadFixture(deployFixture);
      expect(await reputationStore.getScore(999)).to.equal(50);
    });

    it("should return MEDIUM badge for agent with no history", async function () {
      const { reputationStore } = await loadFixture(deployFixture);
      // RiskBadge.MEDIUM = 1
      expect(await reputationStore.getRiskBadge(999)).to.equal(1);
    });

    describe("Score calculation via gateway executions", function () {
      async function deployWithPolicyFixture() {
        const base = await deployFixture();
        const {
          policyEngine,
          target,
          user1,
          agentId,
        } = base;

        // Set a permissive policy for the agent
        const futureExpiry = (await time.latest()) + 86400;
        await policyEngine.connect(user1).setPolicy(
          agentId,
          ethers.parseEther("100"), // maxAmountPerAction
          ethers.parseEther("1000"), // maxAmountPerDay
          0, // frequencyLimit
          futureExpiry,
          [await target.getAddress()], // allowedContracts
          [ethers.id("doSomething()")], // allowedActions
          10 // maxActivePositions
        );

        return base;
      }

      it("should increase score after successful executions", async function () {
        const { reputationStore, gateway, target, user1, agentId } =
          await loadFixture(deployWithPolicyFixture);

        const action = ethers.id("doSomething()");
        const data = target.interface.encodeFunctionData("doSomething");
        const targetAddr = await target.getAddress();

        // Execute 3 successful calls
        for (let i = 0; i < 3; i++) {
          const nonce = ethers.encodeBytes32String(`nonce-s-${i}`);
          await gateway
            .connect(user1)
            .execute(agentId, targetAddr, action, data, 0, nonce);
        }

        const score = await reputationStore.getScore(agentId);
        // 3 successes, 0 failures, 0 violations → base = 100, no penalties → score = 100
        expect(score).to.equal(100);
      });

      it("should decrease score after failure", async function () {
        const { reputationStore, gateway, target, user1, agentId } =
          await loadFixture(deployWithPolicyFixture);

        const action = ethers.id("doSomething()");
        const targetAddr = await target.getAddress();
        // Call revertMe to trigger a call failure
        const data = target.interface.encodeFunctionData("revertMe");

        const nonce = ethers.encodeBytes32String("fail-1");
        await gateway
          .connect(user1)
          .execute(agentId, targetAddr, action, data, 0, nonce);

        const score = await reputationStore.getScore(agentId);
        // 0 successes, 1 failure → base = 0, failurePenalty = 2 → score = 0
        expect(score).to.equal(0);
      });

      it("should penalize heavily for violations", async function () {
        const { reputationStore, gateway, target, user1, agentId } =
          await loadFixture(deployWithPolicyFixture);

        // Use an action NOT in the allowed list to trigger a policy violation
        const badAction = ethers.id("notAllowed()");
        const data = target.interface.encodeFunctionData("doSomething");
        const targetAddr = await target.getAddress();

        const nonce = ethers.encodeBytes32String("viol-1");
        const result = await gateway
          .connect(user1)
          .execute.staticCall(agentId, targetAddr, badAction, data, 0, nonce);
        expect(result).to.be.false;

        // Actually execute to persist state
        await gateway
          .connect(user1)
          .execute(agentId, targetAddr, badAction, data, 0, nonce);

        const score = await reputationStore.getScore(agentId);
        // 0 successes, 0 failures, 1 violation → base = 0, violationPenalty = 3, recencyPenalty = 10 → 0
        expect(score).to.equal(0);
      });

      it("should assign SAFE badge for high score with zero violations", async function () {
        const { reputationStore, gateway, target, user1, agentId } =
          await loadFixture(deployWithPolicyFixture);

        const action = ethers.id("doSomething()");
        const data = target.interface.encodeFunctionData("doSomething");
        const targetAddr = await target.getAddress();

        for (let i = 0; i < 5; i++) {
          const nonce = ethers.encodeBytes32String(`safe-${i}`);
          await gateway
            .connect(user1)
            .execute(agentId, targetAddr, action, data, 0, nonce);
        }

        // RiskBadge.SAFE = 0
        expect(await reputationStore.getRiskBadge(agentId)).to.equal(0);
      });

      it("should assign RISKY badge for many violations", async function () {
        const { reputationStore, gateway, target, user1, agentId } =
          await loadFixture(deployWithPolicyFixture);

        const badAction = ethers.id("notAllowed()");
        const data = target.interface.encodeFunctionData("doSomething");
        const targetAddr = await target.getAddress();

        // 6 violations → violations > RISKY_VIOLATION_COUNT (5)
        for (let i = 0; i < 6; i++) {
          const nonce = ethers.encodeBytes32String(`risky-${i}`);
          await gateway
            .connect(user1)
            .execute(agentId, targetAddr, badAction, data, 0, nonce);
        }

        // RiskBadge.RISKY = 2
        expect(await reputationStore.getRiskBadge(agentId)).to.equal(2);
      });
    });
  });

  // ================================================================
  //  4. PolicyEngine
  // ================================================================

  describe("PolicyEngine", function () {
    it("should set gateway once", async function () {
      const { policyEngine, gateway } = await loadFixture(deployFixture);
      expect(await policyEngine.gateway()).to.equal(
        await gateway.getAddress()
      );
    });

    it("should revert setGateway if already set", async function () {
      const { policyEngine, user1 } = await loadFixture(deployFixture);
      await expect(
        policyEngine.setGateway(user1.address)
      ).to.be.revertedWithCustomError(policyEngine, "GatewayAlreadySet");
    });

    it("should revert setGateway with zero address", async function () {
      const { agentRegistry } = await loadFixture(deployFixture);
      const PolicyEngine = await ethers.getContractFactory("PolicyEngine");
      const fresh = await PolicyEngine.deploy(
        await agentRegistry.getAddress()
      );
      await expect(
        fresh.setGateway(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(fresh, "InvalidGateway");
    });

    it("should revert setPolicy if caller is not agent owner", async function () {
      const { policyEngine, user2, agentId, target } =
        await loadFixture(deployFixture);
      const futureExpiry = (await time.latest()) + 86400;
      await expect(
        policyEngine
          .connect(user2)
          .setPolicy(
            agentId,
            1000,
            10000,
            0,
            futureExpiry,
            [await target.getAddress()],
            [],
            5
          )
      ).to.be.revertedWithCustomError(policyEngine, "NotAgentOwner");
    });

    it("should revert setPolicy if agent is not active", async function () {
      const { policyEngine, agentRegistry, user1, agentId, target } =
        await loadFixture(deployFixture);
      await agentRegistry.connect(user1).deactivateAgent(agentId);
      const futureExpiry = (await time.latest()) + 86400;
      await expect(
        policyEngine
          .connect(user1)
          .setPolicy(agentId, 1000, 10000, 0, futureExpiry, [], [], 5)
      ).to.be.revertedWithCustomError(policyEngine, "AgentNotActive");
    });

    describe("validateExecution — 8 checks", function () {
      async function deployWithPolicyFixture() {
        const base = await deployFixture();
        const { policyEngine, target, user1, user2, agentId, agentRegistry, franchiseId } =
          base;

        const targetAddr = await target.getAddress();
        const allowedAction = ethers.id("doSomething()");
        const futureExpiry = (await time.latest()) + 86400;

        await policyEngine.connect(user1).setPolicy(
          agentId,
          ethers.parseEther("1"), // maxAmountPerAction
          ethers.parseEther("5"), // maxAmountPerDay
          60, // frequencyLimit (60 seconds)
          futureExpiry,
          [targetAddr], // allowedContracts
          [allowedAction], // allowedActions
          2 // maxActivePositions
        );

        return {
          ...base,
          targetAddr,
          allowedAction,
          futureExpiry,
        };
      }

      it("Check 1: should reject if policy is not active (no policy set)", async function () {
        const { policyEngine, target, agentRegistry, user2, franchiseId } =
          await loadFixture(deployFixture);

        // Create a second agent with no policy
        await agentRegistry
          .connect(user2)
          .createAgent("Bot-NoPol", "x", franchiseId);
        const newAgentId = 2;

        const [valid, reason] = await policyEngine.validateExecution(
          newAgentId,
          await target.getAddress(),
          ethers.id("anything"),
          0
        );
        expect(valid).to.be.false;
        expect(reason).to.equal("Policy paused");
      });

      it("Check 2: should reject if policy is expired", async function () {
        const { policyEngine, targetAddr, allowedAction, futureExpiry } =
          await loadFixture(deployWithPolicyFixture);

        // Advance time past expiry
        await time.increaseTo(futureExpiry);

        const [valid, reason] = await policyEngine.validateExecution(
          1,
          targetAddr,
          allowedAction,
          0
        );
        expect(valid).to.be.false;
        expect(reason).to.equal("Policy expired");
      });

      it("Check 3: should reject contract not in whitelist", async function () {
        const { policyEngine, allowedAction, user2 } =
          await loadFixture(deployWithPolicyFixture);

        const [valid, reason] = await policyEngine.validateExecution(
          1,
          user2.address, // not in whitelist
          allowedAction,
          0
        );
        expect(valid).to.be.false;
        expect(reason).to.equal("Contract not in whitelist");
      });

      it("Check 4: should reject action not in whitelist", async function () {
        const { policyEngine, targetAddr } =
          await loadFixture(deployWithPolicyFixture);

        const [valid, reason] = await policyEngine.validateExecution(
          1,
          targetAddr,
          ethers.id("badAction()"), // not in whitelist
          0
        );
        expect(valid).to.be.false;
        expect(reason).to.equal("Action not allowed");
      });

      it("Check 5: should reject amount exceeding per-action limit", async function () {
        const { policyEngine, targetAddr, allowedAction } =
          await loadFixture(deployWithPolicyFixture);

        const [valid, reason] = await policyEngine.validateExecution(
          1,
          targetAddr,
          allowedAction,
          ethers.parseEther("2") // > 1 ETH limit
        );
        expect(valid).to.be.false;
        expect(reason).to.equal("Exceeds per-action limit");
      });

      it("Check 6: should reject amount exceeding daily limit", async function () {
        const base = await loadFixture(deployFixture);
        const { policyEngine, gateway, target, user1, agentId } = base;

        const targetAddr = await target.getAddress();
        const allowedAction = ethers.id("doSomething()");
        const futureExpiry = (await time.latest()) + 86400;

        // Set policy with a low daily limit (2 ETH) and high positions limit
        await policyEngine.connect(user1).setPolicy(
          agentId,
          ethers.parseEther("1"),  // maxAmountPerAction
          ethers.parseEther("2"),  // maxAmountPerDay — will be exceeded
          60,                      // frequencyLimit
          futureExpiry,
          [targetAddr],
          [allowedAction],
          100                      // high maxActivePositions so it doesn't interfere
        );

        const data = target.interface.encodeFunctionData("doSomething");

        // Execute twice with 1 ETH each to fill 2 ETH daily limit
        for (let i = 0; i < 2; i++) {
          const nonce = ethers.encodeBytes32String(`daily-${i}`);
          await gateway
            .connect(user1)
            .execute(agentId, targetAddr, allowedAction, data, ethers.parseEther("1"), nonce, {
              value: ethers.parseEther("1"),
            });
          await time.increase(61);
        }

        // Now the 3rd should fail the daily limit check
        const [valid, reason] = await policyEngine.validateExecution(
          agentId,
          targetAddr,
          allowedAction,
          ethers.parseEther("1")
        );
        expect(valid).to.be.false;
        expect(reason).to.equal("Exceeds daily limit");
      });

      it("Check 7: should reject if too soon (frequency limit)", async function () {
        const {
          policyEngine,
          gateway,
          target,
          targetAddr,
          allowedAction,
          user1,
          agentId,
        } = await loadFixture(deployWithPolicyFixture);

        const data = target.interface.encodeFunctionData("doSomething");

        // Execute once
        const nonce = ethers.encodeBytes32String("freq-1");
        await gateway
          .connect(user1)
          .execute(agentId, targetAddr, allowedAction, data, 0, nonce);

        // Immediately try to validate another — should be "Too soon"
        const [valid, reason] = await policyEngine.validateExecution(
          agentId,
          targetAddr,
          allowedAction,
          0
        );
        expect(valid).to.be.false;
        expect(reason).to.equal("Too soon");
      });

      it("Check 8: should reject if max positions reached", async function () {
        const {
          policyEngine,
          gateway,
          target,
          targetAddr,
          allowedAction,
          user1,
          agentId,
        } = await loadFixture(deployWithPolicyFixture);

        const data = target.interface.encodeFunctionData("doSomething");

        // Execute 2 times to fill max positions (2)
        for (let i = 0; i < 2; i++) {
          const nonce = ethers.encodeBytes32String(`pos-${i}`);
          await gateway
            .connect(user1)
            .execute(agentId, targetAddr, allowedAction, data, 0, nonce);
          await time.increase(61); // past frequency limit
        }

        // Now try another
        const [valid, reason] = await policyEngine.validateExecution(
          agentId,
          targetAddr,
          allowedAction,
          0
        );
        expect(valid).to.be.false;
        expect(reason).to.equal("Max positions reached");
      });

      it("should pass validation when all checks are satisfied", async function () {
        const { policyEngine, targetAddr, allowedAction } =
          await loadFixture(deployWithPolicyFixture);

        const [valid, reason] = await policyEngine.validateExecution(
          1,
          targetAddr,
          allowedAction,
          ethers.parseEther("0.5")
        );
        expect(valid).to.be.true;
        expect(reason).to.equal("");
      });
    });

    it("should revert updateAfterExecution if caller is not gateway", async function () {
      const { policyEngine, user1 } = await loadFixture(deployFixture);
      await expect(
        policyEngine.connect(user1).updateAfterExecution(1, 100)
      ).to.be.revertedWithCustomError(policyEngine, "Unauthorized");
    });
  });

  // ================================================================
  //  5. ExecutionGateway
  // ================================================================

  describe("ExecutionGateway", function () {
    async function deployWithPolicyFixture() {
      const base = await deployFixture();
      const { policyEngine, target, user1, agentId } = base;

      const targetAddr = await target.getAddress();
      const allowedAction = ethers.id("doSomething()");
      const futureExpiry = (await time.latest()) + 86400;

      await policyEngine.connect(user1).setPolicy(
        agentId,
        ethers.parseEther("10"), // maxAmountPerAction
        ethers.parseEther("100"), // maxAmountPerDay
        0, // no frequency limit
        futureExpiry,
        [targetAddr],
        [allowedAction],
        100 // generous max positions
      );

      return { ...base, targetAddr, allowedAction };
    }

    it("should execute successfully and emit AgentExecuted", async function () {
      const { gateway, target, user1, agentId, targetAddr, allowedAction } =
        await loadFixture(deployWithPolicyFixture);

      const data = target.interface.encodeFunctionData("doSomething");
      const nonce = ethers.encodeBytes32String("exec-1");

      await expect(
        gateway
          .connect(user1)
          .execute(agentId, targetAddr, allowedAction, data, 0, nonce)
      ).to.emit(gateway, "AgentExecuted");
    });

    it("should return true on successful execution", async function () {
      const { gateway, target, user1, agentId, targetAddr, allowedAction } =
        await loadFixture(deployWithPolicyFixture);

      const data = target.interface.encodeFunctionData("doSomething");
      const nonce = ethers.encodeBytes32String("exec-ret");

      const result = await gateway
        .connect(user1)
        .execute.staticCall(agentId, targetAddr, allowedAction, data, 0, nonce);
      expect(result).to.be.true;
    });

    it("should return false on policy violation and emit AgentViolation", async function () {
      const { gateway, target, user1, agentId, targetAddr } =
        await loadFixture(deployWithPolicyFixture);

      const badAction = ethers.id("badAction()");
      const data = target.interface.encodeFunctionData("doSomething");
      const nonce = ethers.encodeBytes32String("viol-1");

      // staticCall to check return value
      const result = await gateway
        .connect(user1)
        .execute.staticCall(agentId, targetAddr, badAction, data, 0, nonce);
      expect(result).to.be.false;

      // Actual call to check event
      await expect(
        gateway
          .connect(user1)
          .execute(agentId, targetAddr, badAction, data, 0, nonce)
      ).to.emit(gateway, "AgentViolation");
    });

    it("should revert with NonceAlreadyUsed on replay", async function () {
      const { gateway, target, user1, agentId, targetAddr, allowedAction } =
        await loadFixture(deployWithPolicyFixture);

      const data = target.interface.encodeFunctionData("doSomething");
      const nonce = ethers.encodeBytes32String("replay-nonce");

      // First execution
      await gateway
        .connect(user1)
        .execute(agentId, targetAddr, allowedAction, data, 0, nonce);

      // Replay
      await expect(
        gateway
          .connect(user1)
          .execute(agentId, targetAddr, allowedAction, data, 0, nonce)
      ).to.be.revertedWithCustomError(gateway, "NonceAlreadyUsed");
    });

    it("should also consume nonce on violation (preventing replay)", async function () {
      const { gateway, target, user1, agentId, targetAddr } =
        await loadFixture(deployWithPolicyFixture);

      const badAction = ethers.id("badAction()");
      const data = target.interface.encodeFunctionData("doSomething");
      const nonce = ethers.encodeBytes32String("viol-replay");

      // First call — violation, returns false but nonce is consumed
      await gateway
        .connect(user1)
        .execute(agentId, targetAddr, badAction, data, 0, nonce);

      // Replay — should revert
      await expect(
        gateway
          .connect(user1)
          .execute(agentId, targetAddr, badAction, data, 0, nonce)
      ).to.be.revertedWithCustomError(gateway, "NonceAlreadyUsed");
    });

    it("should collect 1% fee and send to treasury", async function () {
      const {
        gateway,
        target,
        user1,
        agentId,
        targetAddr,
        allowedAction,
        treasury,
      } = await loadFixture(deployWithPolicyFixture);

      const data = target.interface.encodeFunctionData("doSomething");
      const nonce = ethers.encodeBytes32String("fee-1");
      const amount = ethers.parseEther("1");
      const expectedFee = amount / 100n; // 1%

      const treasuryBefore = await ethers.provider.getBalance(treasury.address);

      await gateway
        .connect(user1)
        .execute(agentId, targetAddr, allowedAction, data, amount, nonce, {
          value: amount,
        });

      const treasuryAfter = await ethers.provider.getBalance(treasury.address);
      expect(treasuryAfter - treasuryBefore).to.equal(expectedFee);
    });

    it("should forward net amount (minus fee) to target", async function () {
      const { gateway, target, user1, agentId, targetAddr, allowedAction } =
        await loadFixture(deployWithPolicyFixture);

      const data = target.interface.encodeFunctionData("doSomething");
      const nonce = ethers.encodeBytes32String("fwd-1");
      const amount = ethers.parseEther("1");
      const expectedNet = amount - amount / 100n;

      const targetBefore = await ethers.provider.getBalance(targetAddr);

      await gateway
        .connect(user1)
        .execute(agentId, targetAddr, allowedAction, data, amount, nonce, {
          value: amount,
        });

      const targetAfter = await ethers.provider.getBalance(targetAddr);
      expect(targetAfter - targetBefore).to.equal(expectedNet);
    });

    it("should revert with NotAgentOwner if caller is not agent owner", async function () {
      const { gateway, target, user2, agentId, targetAddr, allowedAction } =
        await loadFixture(deployWithPolicyFixture);

      const data = target.interface.encodeFunctionData("doSomething");
      const nonce = ethers.encodeBytes32String("not-owner");

      await expect(
        gateway
          .connect(user2)
          .execute(agentId, targetAddr, allowedAction, data, 0, nonce)
      ).to.be.revertedWithCustomError(gateway, "NotAgentOwner");
    });

    it("should revert with AgentNotActive if agent is deactivated", async function () {
      const {
        gateway,
        agentRegistry,
        target,
        user1,
        agentId,
        targetAddr,
        allowedAction,
      } = await loadFixture(deployWithPolicyFixture);

      await agentRegistry.connect(user1).deactivateAgent(agentId);

      const data = target.interface.encodeFunctionData("doSomething");
      const nonce = ethers.encodeBytes32String("inactive");

      await expect(
        gateway
          .connect(user1)
          .execute(agentId, targetAddr, allowedAction, data, 0, nonce)
      ).to.be.revertedWithCustomError(gateway, "AgentNotActive");
    });

    it("should revert with ForbiddenTarget for core contract addresses", async function () {
      const {
        gateway,
        agentRegistry,
        user1,
        agentId,
        allowedAction,
      } = await loadFixture(deployWithPolicyFixture);

      const data = "0x";
      const nonce = ethers.encodeBytes32String("forbidden");
      const registryAddr = await agentRegistry.getAddress();

      await expect(
        gateway
          .connect(user1)
          .execute(agentId, registryAddr, allowedAction, data, 0, nonce)
      )
        .to.be.revertedWithCustomError(gateway, "ForbiddenTarget")
        .withArgs(registryAddr);
    });

    it("should revert with ForbiddenTarget for the gateway itself", async function () {
      const { gateway, user1, agentId, allowedAction } =
        await loadFixture(deployWithPolicyFixture);

      const nonce = ethers.encodeBytes32String("self-call");
      const gatewayAddr = await gateway.getAddress();

      await expect(
        gateway
          .connect(user1)
          .execute(agentId, gatewayAddr, allowedAction, "0x", 0, nonce)
      )
        .to.be.revertedWithCustomError(gateway, "ForbiddenTarget")
        .withArgs(gatewayAddr);
    });

    it("should revert with ValueMismatch if msg.value != amount", async function () {
      const { gateway, target, user1, agentId, targetAddr, allowedAction } =
        await loadFixture(deployWithPolicyFixture);

      const data = target.interface.encodeFunctionData("doSomething");
      const nonce = ethers.encodeBytes32String("mismatch");

      await expect(
        gateway
          .connect(user1)
          .execute(
            agentId,
            targetAddr,
            allowedAction,
            data,
            ethers.parseEther("1"),
            nonce,
            { value: ethers.parseEther("2") }
          )
      ).to.be.revertedWithCustomError(gateway, "ValueMismatch");
    });

    it("should return false and record failure when target call reverts", async function () {
      const {
        gateway,
        target,
        reputationStore,
        user1,
        agentId,
        targetAddr,
        allowedAction,
      } = await loadFixture(deployWithPolicyFixture);

      const data = target.interface.encodeFunctionData("revertMe");
      const nonce = ethers.encodeBytes32String("call-fail");

      const result = await gateway
        .connect(user1)
        .execute.staticCall(
          agentId,
          targetAddr,
          allowedAction,
          data,
          0,
          nonce
        );
      expect(result).to.be.false;

      // Execute to persist
      await gateway
        .connect(user1)
        .execute(agentId, targetAddr, allowedAction, data, 0, nonce);

      // Check reputation recorded a failure
      const checkpoint = await reputationStore.getCheckpoint(agentId);
      expect(checkpoint.failureCount).to.equal(1);
    });

    it("should refund ETH to sender on violation", async function () {
      const { gateway, target, user1, agentId, targetAddr } =
        await loadFixture(deployWithPolicyFixture);

      const badAction = ethers.id("badAction()");
      const data = target.interface.encodeFunctionData("doSomething");
      const nonce = ethers.encodeBytes32String("refund-viol");
      const amount = ethers.parseEther("1");

      const balBefore = await ethers.provider.getBalance(user1.address);

      const tx = await gateway
        .connect(user1)
        .execute(agentId, targetAddr, badAction, data, amount, nonce, {
          value: amount,
        });
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const balAfter = await ethers.provider.getBalance(user1.address);

      // User should only have lost gas costs, ETH was refunded
      expect(balBefore - balAfter).to.be.closeTo(gasCost, ethers.parseEther("0.001"));
    });
  });
});
