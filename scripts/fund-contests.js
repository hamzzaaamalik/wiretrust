const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const addressesPath = path.join(__dirname, "..", "deployed-addresses.json");
  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const [deployer] = await hre.ethers.getSigners();

  const fantasyModule = await hre.ethers.getContractAt("FantasyModule", addresses.fantasyModule);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} WIRE`);

  // Fund contests 2-7 with small amounts (we have ~6.7 WIRE)
  const funds = [
    { id: 2, amount: "1.5" },   // Grand Contest — Match 4
    { id: 3, amount: "0.5" },   // Mini League — Match 4
    { id: 4, amount: "1.0" },   // Main Contest — Match 5
    { id: 5, amount: "0.25" },  // Head to Head — Match 5
    { id: 6, amount: "2.0" },   // Mega Contest — Match 6
    { id: 7, amount: "0.3" },   // Practice — Match 6
  ];

  for (const f of funds) {
    try {
      const tx = await fantasyModule.fundContest(f.id, { value: hre.ethers.parseEther(f.amount) });
      await tx.wait();
      console.log(`Funded Contest #${f.id} with ${f.amount} WIRE`);
    } catch (err) {
      console.error(`Failed Contest #${f.id}:`, err.message);
    }
  }

  const finalBalance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Remaining: ${hre.ethers.formatEther(finalBalance)} WIRE`);
}

main().catch(console.error);
