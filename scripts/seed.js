const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const addressesPath = path.join(__dirname, "..", "deployed-addresses.json");
  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));

  const [deployer] = await hre.ethers.getSigners();

  console.log("Seeding WireTrust Protocol with mock data...");
  console.log("Seeder:", deployer.address);
  console.log("---");

  // Get contract instances
  const franchiseRegistry = await hre.ethers.getContractAt("FranchiseRegistry", addresses.franchiseRegistry);
  const matchOracle = await hre.ethers.getContractAt("MatchOracle", addresses.matchOracle);
  const fantasyModule = await hre.ethers.getContractAt("FantasyModule", addresses.fantasyModule);
  const wireTrustNFT = await hre.ethers.getContractAt("WireTrustNFT", addresses.wireTrustNFT);

  // 1. Register "The Pindiz" franchise
  const tx1 = await franchiseRegistry.registerFranchise(
    "The Pindiz",
    "PSL",
    addresses.franchiseWallet,
    addresses.treasury
  );
  await tx1.wait();
  console.log("1. Registered franchise: The Pindiz (ID: 1)");

  // 2. Create mock matches
  const now = Math.floor(Date.now() / 1000);
  const oneDay = 86400;

  const match1Tx = await matchOracle.createMatch(1, "The Pindiz", "Karachi Kings", now + oneDay);
  await match1Tx.wait();
  console.log("2. Created Match 1: The Pindiz vs Karachi Kings");

  const match2Tx = await matchOracle.createMatch(1, "The Pindiz", "Lahore Qalandars", now + 2 * oneDay);
  await match2Tx.wait();
  console.log("   Created Match 2: The Pindiz vs Lahore Qalandars");

  const match3Tx = await matchOracle.createMatch(1, "Quetta Gladiators", "The Pindiz", now + 4 * oneDay);
  await match3Tx.wait();
  console.log("   Created Match 3: Quetta Gladiators vs The Pindiz");

  // 3. Create fantasy contest for Match 1 (FREE-TO-PLAY, sponsor-funded)
  const contestTx = await fantasyModule.createContest(1, 1, 0); // maxParticipants=0 (unlimited)
  await contestTx.wait();
  console.log("3. Created Fantasy Contest for Match 1 (FREE-TO-PLAY)");

  // 3b. Fund the contest with sponsor pool (use small amount on testnet)
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const sponsorAmount = balance > hre.ethers.parseEther("2") ? hre.ethers.parseEther("1") : 0n;
  if (sponsorAmount > 0n) {
    const fundTx = await fantasyModule.fundContest(1, { value: sponsorAmount });
    await fundTx.wait();
    console.log(`   Funded contest with ${hre.ethers.formatEther(sponsorAmount)} WIRE sponsor pool`);
  } else {
    console.log("   Skipped contest funding (low balance) — points-only contest");
  }

  // 4. Mint sample NFTs
  // Watch Party Pass (EXPERIENCE = 1)
  const nft1 = await wireTrustNFT.mint(
    deployer.address, 1, 1, // EXPERIENCE
    "Watch Party Pass - Pindiz vs KK",
    "Official Pindiz watch party for Match 1",
    "ipfs://placeholder/watch-party",
    hre.ethers.parseEther("2500"),
    now + oneDay
  );
  await nft1.wait();
  console.log("4. Minted NFT: Watch Party Pass (EXPERIENCE)");

  // Match Ticket (TICKET = 0)
  const nft2 = await wireTrustNFT.mint(
    deployer.address, 1, 0, // TICKET
    "Match Ticket - Seat A12 - Pindiz vs KK",
    "Official match ticket, Seat A12",
    "ipfs://placeholder/ticket-a12",
    hre.ethers.parseEther("2000"),
    now + oneDay
  );
  await nft2.wait();
  console.log("   Minted NFT: Match Ticket Seat A12 (TICKET)");

  // Collectible (COLLECTIBLE = 2)
  const nft3 = await wireTrustNFT.mint(
    deployer.address, 1, 2, // COLLECTIBLE
    "Babar Azam Gold Card",
    "Limited edition player card - Season 2026",
    "ipfs://placeholder/babar-gold",
    hre.ethers.parseEther("3000"),
    0 // no expiry
  );
  await nft3.wait();
  console.log("   Minted NFT: Babar Azam Gold Card (COLLECTIBLE)");

  // Badge (BADGE = 3) - soulbound
  const nft4 = await wireTrustNFT.mint(
    deployer.address, 1, 3, // BADGE
    "True Fan Badge",
    "Earned by attending 3+ matches",
    "ipfs://placeholder/true-fan",
    0, // free
    0  // no expiry
  );
  await nft4.wait();
  console.log("   Minted NFT: True Fan Badge (BADGE - Soulbound)");

  // Merchandise (MERCHANDISE = 4)
  const nft5 = await wireTrustNFT.mint(
    deployer.address, 1, 4, // MERCHANDISE
    "Official Pindiz Jersey 2026",
    "Authenticated official jersey - Season 2026",
    "ipfs://placeholder/jersey-2026",
    hre.ethers.parseEther("4000"),
    0 // no expiry
  );
  await nft5.wait();
  console.log("   Minted NFT: Official Pindiz Jersey (MERCHANDISE)");

  console.log("\nSeed complete! Mock data ready for demo.");
  console.log("\nSummary:");
  console.log("  Franchises: 1 (The Pindiz)");
  console.log("  Matches: 3");
  console.log("  Fantasy Contests: 1 (FREE-TO-PLAY, 5000 WIRE sponsor pool)");
  console.log("  NFTs: 5 (1 ticket, 1 experience, 1 collectible, 1 badge, 1 merch)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
