const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("MatchOracle - Extended Tests", function () {
  async function deployFixture() {
    const [owner, oracle1, oracle2, random, treasury] =
      await ethers.getSigners();

    const FranchiseRegistry = await ethers.getContractFactory("FranchiseRegistry");
    const franchiseRegistry = await FranchiseRegistry.deploy(treasury.address);

    await franchiseRegistry.registerFranchise("TestTeam", "PSL", owner.address, treasury.address);

    const MatchOracle = await ethers.getContractFactory("MatchOracle");
    const matchOracle = await MatchOracle.deploy();

    await matchOracle.authorizeOracle(oracle1.address);

    return { owner, oracle1, oracle2, random, matchOracle, franchiseRegistry };
  }

  async function createMatch(matchOracle, franchiseId = 1) {
    const startTime = (await time.latest()) + 86400;
    await matchOracle.createMatch(franchiseId, "Team A", "Team B", startTime);
    const count = await matchOracle.matchCount();
    return Number(count);
  }

  describe("Multi-oracle authorization", function () {
    it("should allow multiple oracles to be authorized", async function () {
      const { matchOracle, oracle1, oracle2, owner } = await loadFixture(deployFixture);
      await matchOracle.authorizeOracle(oracle2.address);

      const matchId = await createMatch(matchOracle);
      const matchId2 = await createMatch(matchOracle);

      // oracle1 submits result for match 1
      await matchOracle.connect(oracle1).submitResult(matchId, "Team A", false);
      // oracle2 submits result for match 2
      await matchOracle.connect(oracle2).submitResult(matchId2, "Team B", false);

      const m1 = await matchOracle.getResult(matchId);
      const m2 = await matchOracle.getResult(matchId2);
      expect(m1.winner).to.equal("Team A");
      expect(m2.winner).to.equal("Team B");
    });

    it("should reject submissions after oracle is revoked", async function () {
      const { matchOracle, oracle1, owner } = await loadFixture(deployFixture);
      await matchOracle.revokeOracle(oracle1.address);

      const matchId = await createMatch(matchOracle);
      await expect(
        matchOracle.connect(oracle1).submitResult(matchId, "Team A", false)
      ).to.be.reverted;
    });

    it("should allow re-authorizing a revoked oracle", async function () {
      const { matchOracle, oracle1 } = await loadFixture(deployFixture);
      await matchOracle.revokeOracle(oracle1.address);
      await matchOracle.authorizeOracle(oracle1.address);

      const matchId = await createMatch(matchOracle);
      await matchOracle.connect(oracle1).submitResult(matchId, "Team A", false);
      const m = await matchOracle.getResult(matchId);
      expect(m.winner).to.equal("Team A");
    });
  });

  describe("Match creation edge cases", function () {
    it("should create multiple matches with sequential IDs", async function () {
      const { matchOracle } = await loadFixture(deployFixture);
      const id1 = await createMatch(matchOracle);
      const id2 = await createMatch(matchOracle);
      const id3 = await createMatch(matchOracle);
      expect(id2).to.equal(id1 + 1);
      expect(id3).to.equal(id2 + 1);
    });

    it("should store correct teams and start time", async function () {
      const { matchOracle } = await loadFixture(deployFixture);
      const startTime = (await time.latest()) + 3600;
      await matchOracle.createMatch(1, "Lahore Qalandars", "Islamabad United", startTime);
      const matchId = Number(await matchOracle.matchCount());

      const match = await matchOracle.getResult(matchId);
      expect(match.team1).to.equal("Lahore Qalandars");
      expect(match.team2).to.equal("Islamabad United");
      expect(Number(match.startTime)).to.equal(startTime);
      expect(match.resultSubmitted).to.equal(false);
      expect(match.abandoned).to.equal(false);
    });

    it("should reject createMatch from non-owner", async function () {
      const { matchOracle, random } = await loadFixture(deployFixture);
      const startTime = (await time.latest()) + 3600;
      await expect(
        matchOracle.connect(random).createMatch(1, "A", "B", startTime)
      ).to.be.reverted;
    });
  });

  describe("Result submission edge cases", function () {
    it("should set settledAt timestamp on result submission", async function () {
      const { matchOracle, oracle1 } = await loadFixture(deployFixture);
      const matchId = await createMatch(matchOracle);

      await matchOracle.connect(oracle1).submitResult(matchId, "Team A", false);
      const match = await matchOracle.getResult(matchId);
      expect(Number(match.settledAt)).to.be.greaterThan(0);
    });

    it("should handle abandoned match correctly", async function () {
      const { matchOracle, oracle1 } = await loadFixture(deployFixture);
      const matchId = await createMatch(matchOracle);

      await matchOracle.connect(oracle1).submitResult(matchId, "", true);
      const match = await matchOracle.getResult(matchId);
      expect(match.abandoned).to.equal(true);
      expect(match.winner).to.equal("");
      expect(match.resultSubmitted).to.equal(true);
    });
  });

  describe("Player stats edge cases", function () {
    it("should store all player stat fields correctly", async function () {
      const { matchOracle, oracle1 } = await loadFixture(deployFixture);
      const matchId = await createMatch(matchOracle);
      await matchOracle.connect(oracle1).submitResult(matchId, "Team A", false);

      await matchOracle.connect(oracle1).submitPlayerStats(
        matchId, 42, 85, 3, 750, 14200, true
      );

      const stats = await matchOracle.getPlayerStats(matchId, 42);
      expect(Number(stats.runs)).to.equal(85);
      expect(Number(stats.wickets)).to.equal(3);
      expect(Number(stats.economyRate)).to.equal(750);
      expect(Number(stats.strikeRate)).to.equal(14200);
      expect(stats.isMotm).to.equal(true);
    });

    it("should allow stats for multiple players in same match", async function () {
      const { matchOracle, oracle1 } = await loadFixture(deployFixture);
      const matchId = await createMatch(matchOracle);
      await matchOracle.connect(oracle1).submitResult(matchId, "Team A", false);

      await matchOracle.connect(oracle1).submitPlayerStats(matchId, 1, 50, 0, 0, 12500, false);
      await matchOracle.connect(oracle1).submitPlayerStats(matchId, 2, 0, 4, 650, 0, true);

      const s1 = await matchOracle.getPlayerStats(matchId, 1);
      const s2 = await matchOracle.getPlayerStats(matchId, 2);
      expect(Number(s1.runs)).to.equal(50);
      expect(Number(s2.wickets)).to.equal(4);
      expect(s2.isMotm).to.equal(true);
    });

    it("should reject stats for non-existent match", async function () {
      const { matchOracle, oracle1 } = await loadFixture(deployFixture);
      await expect(
        matchOracle.connect(oracle1).submitPlayerStats(999, 1, 50, 0, 0, 0, false)
      ).to.be.reverted;
    });
  });

  describe("View functions", function () {
    it("should return correct matchCount", async function () {
      const { matchOracle } = await loadFixture(deployFixture);
      expect(Number(await matchOracle.matchCount())).to.equal(0);
      await createMatch(matchOracle);
      expect(Number(await matchOracle.matchCount())).to.equal(1);
      await createMatch(matchOracle);
      expect(Number(await matchOracle.matchCount())).to.equal(2);
    });

    it("should return unresolved matches correctly", async function () {
      const { matchOracle, oracle1 } = await loadFixture(deployFixture);
      const id1 = await createMatch(matchOracle);
      const id2 = await createMatch(matchOracle);

      // Resolve only match 1
      await matchOracle.connect(oracle1).submitResult(id1, "Team A", false);

      const m1 = await matchOracle.getResult(id1);
      const m2 = await matchOracle.getResult(id2);
      expect(m1.resultSubmitted).to.equal(true);
      expect(m2.resultSubmitted).to.equal(false);
    });
  });
});
