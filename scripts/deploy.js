const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const treasury = process.env.PROTOCOL_TREASURY || deployer.address;
  const oracleWallet = process.env.ORACLE_WALLET || deployer.address;
  const franchiseWallet = process.env.FRANCHISE_WALLET || deployer.address;

  console.log("Deploying WireTrust Protocol...");
  console.log("Deployer:", deployer.address);
  console.log("Treasury:", treasury);
  console.log("Oracle Wallet:", oracleWallet);
  console.log("Franchise Wallet:", franchiseWallet);
  console.log("---");

  // 1. FranchiseRegistry
  const FranchiseRegistry = await hre.ethers.getContractFactory("FranchiseRegistry");
  const franchiseRegistry = await FranchiseRegistry.deploy(treasury);
  await franchiseRegistry.waitForDeployment();
  const franchiseRegistryAddr = await franchiseRegistry.getAddress();
  console.log("1. FranchiseRegistry:", franchiseRegistryAddr);

  // 2. MatchOracle
  const MatchOracle = await hre.ethers.getContractFactory("MatchOracle");
  const matchOracle = await MatchOracle.deploy();
  await matchOracle.waitForDeployment();
  const matchOracleAddr = await matchOracle.getAddress();
  console.log("2. MatchOracle:", matchOracleAddr);

  // 3. AgentRegistry
  const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy(franchiseRegistryAddr);
  await agentRegistry.waitForDeployment();
  const agentRegistryAddr = await agentRegistry.getAddress();
  console.log("3. AgentRegistry:", agentRegistryAddr);

  // 4. ReputationStore
  const ReputationStore = await hre.ethers.getContractFactory("ReputationStore");
  const reputationStore = await ReputationStore.deploy();
  await reputationStore.waitForDeployment();
  const reputationStoreAddr = await reputationStore.getAddress();
  console.log("4. ReputationStore:", reputationStoreAddr);

  // 5. PolicyEngine
  const PolicyEngine = await hre.ethers.getContractFactory("PolicyEngine");
  const policyEngine = await PolicyEngine.deploy(agentRegistryAddr);
  await policyEngine.waitForDeployment();
  const policyEngineAddr = await policyEngine.getAddress();
  console.log("5. PolicyEngine:", policyEngineAddr);

  // 6. ExecutionGateway
  const ExecutionGateway = await hre.ethers.getContractFactory("ExecutionGateway");
  const executionGateway = await ExecutionGateway.deploy(
    agentRegistryAddr,
    policyEngineAddr,
    reputationStoreAddr,
    treasury
  );
  await executionGateway.waitForDeployment();
  const executionGatewayAddr = await executionGateway.getAddress();
  console.log("6. ExecutionGateway:", executionGatewayAddr);

  // 7. Wire: ReputationStore ← Gateway
  await reputationStore.setGateway(executionGatewayAddr);
  console.log("   Wired: ReputationStore.setGateway");

  // 8. Wire: PolicyEngine ← Gateway
  await policyEngine.setGateway(executionGatewayAddr);
  console.log("   Wired: PolicyEngine.setGateway");

  // 9. FantasyModule
  const FantasyModule = await hre.ethers.getContractFactory("FantasyModule");
  const fantasyModule = await FantasyModule.deploy(
    matchOracleAddr,
    franchiseRegistryAddr,
    treasury
  );
  await fantasyModule.waitForDeployment();
  const fantasyModuleAddr = await fantasyModule.getAddress();
  console.log("7. FantasyModule:", fantasyModuleAddr);

  // 10. PredictionModule (no treasury — points-only, no ETH flows)
  const PredictionModule = await hre.ethers.getContractFactory("PredictionModule");
  const predictionModule = await PredictionModule.deploy(
    matchOracleAddr,
    franchiseRegistryAddr
  );
  await predictionModule.waitForDeployment();
  const predictionModuleAddr = await predictionModule.getAddress();
  console.log("8. PredictionModule:", predictionModuleAddr);

  // 11. WireTrustNFT
  const WireTrustNFT = await hre.ethers.getContractFactory("WireTrustNFT");
  const wireTrustNFT = await WireTrustNFT.deploy(
    franchiseRegistryAddr,
    treasury
  );
  await wireTrustNFT.waitForDeployment();
  const wireTrustNFTAddr = await wireTrustNFT.getAddress();
  console.log("9. WireTrustNFT:", wireTrustNFTAddr);

  // 12. Authorize oracle wallet
  await matchOracle.authorizeOracle(oracleWallet);
  console.log("   Wired: MatchOracle.authorizeOracle");

  // Save addresses
  const addresses = {
    franchiseRegistry: franchiseRegistryAddr,
    matchOracle: matchOracleAddr,
    agentRegistry: agentRegistryAddr,
    reputationStore: reputationStoreAddr,
    policyEngine: policyEngineAddr,
    executionGateway: executionGatewayAddr,
    fantasyModule: fantasyModuleAddr,
    predictionModule: predictionModuleAddr,
    wireTrustNFT: wireTrustNFTAddr,
    deployer: deployer.address,
    treasury,
    oracleWallet,
    franchiseWallet,
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployedAt: new Date().toISOString(),
  };

  const outPath = path.join(__dirname, "..", "deployed-addresses.json");
  fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));
  console.log("\nAddresses saved to deployed-addresses.json");
  console.log("\nWireTrust Protocol deployed successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
