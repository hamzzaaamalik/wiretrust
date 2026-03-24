const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const addressesPath = path.join(__dirname, "..", "deployed-addresses.json");
  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const [deployer] = await hre.ethers.getSigners();

  console.log("Creating fantasy contests for matches 4-6...");
  console.log("Deployer:", deployer.address);

  const fantasyModule = await hre.ethers.getContractAt("FantasyModule", addresses.fantasyModule);

  // Check current contest count
  const currentCount = await fantasyModule.contestCount();
  console.log(`Current contest count: ${currentCount}`);

  // Create contests for matches 4, 5, 6
  const matchContests = [
    { matchId: 4, name: "Pindiz vs Karachi Kings — Grand Contest", maxParticipants: 100 },
    { matchId: 4, name: "Pindiz vs Karachi Kings — Mini League", maxParticipants: 10 },
    { matchId: 5, name: "Pindiz vs Lahore Qalandars — Main Contest", maxParticipants: 50 },
    { matchId: 5, name: "Pindiz vs Lahore Qalandars — Head to Head", maxParticipants: 2 },
    { matchId: 6, name: "Quetta vs Pindiz — Mega Contest", maxParticipants: 200 },
    { matchId: 6, name: "Quetta vs Pindiz — Practice Match", maxParticipants: 20 },
  ];

  for (const mc of matchContests) {
    try {
      const tx = await fantasyModule.createContest(1, mc.matchId, mc.maxParticipants);
      const receipt = await tx.wait();
      console.log(`Created contest for Match #${mc.matchId} (max: ${mc.maxParticipants}) — tx: ${receipt.hash.slice(0, 12)}...`);
    } catch (err) {
      console.error(`Failed to create contest for Match #${mc.matchId}:`, err.message);
    }
  }

  // Fund contests with sponsor pools
  const newCount = await fantasyModule.contestCount();
  console.log(`\nNew contest count: ${newCount}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${hre.ethers.formatEther(balance)} WIRE`);

  // Fund each new contest with different amounts
  const fundAmounts = [
    hre.ethers.parseEther("5000"),   // Grand Contest
    hre.ethers.parseEther("1000"),   // Mini League
    hre.ethers.parseEther("3000"),   // Main Contest
    hre.ethers.parseEther("500"),    // Head to Head
    hre.ethers.parseEther("10000"),  // Mega Contest
    hre.ethers.parseEther("750"),    // Practice Match
  ];

  for (let i = 0; i < matchContests.length; i++) {
    const contestId = Number(currentCount) + 1 + i;
    const amount = fundAmounts[i];
    if (balance > amount) {
      try {
        const tx = await fantasyModule.fundContest(contestId, { value: amount });
        await tx.wait();
        console.log(`Funded Contest #${contestId} with ${hre.ethers.formatEther(amount)} WIRE`);
      } catch (err) {
        console.error(`Failed to fund Contest #${contestId}:`, err.message);
      }
    } else {
      console.log(`Skipped funding Contest #${contestId} (low balance)`);
    }
  }

  console.log("\nDone! Contests are ready for testing.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
