const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const provider = new ethers.JsonRpcProvider('https://evm.wirefluid.com', { name: 'wirefluid', chainId: 92533 });
const deployer = '0x22EfFAe93649A93F7c6e01aBB6Ce2496BB2D4105';

const addresses = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'deployed-addresses.json'), 'utf-8'));

async function main() {
  console.log('=== WireTrust Transaction Report ===\n');
  console.log('Network: WireFluid (Chain 92533)');
  console.log('Deployer:', deployer);

  const count = await provider.getTransactionCount(deployer);
  console.log('Total transactions:', count);

  const balance = await provider.getBalance(deployer);
  console.log('Balance:', ethers.formatEther(balance), 'WIRE\n');

  console.log('--- Deployed Contracts ---\n');

  const contracts = [
    'franchiseRegistry', 'agentRegistry', 'reputationStore', 'policyEngine',
    'executionGateway', 'matchOracle', 'predictionModule', 'fantasyModule', 'wireTrustNFT'
  ];

  for (const name of contracts) {
    const addr = addresses[name];
    if (!addr) continue;
    const code = await provider.getCode(addr);
    const hasCode = code && code !== '0x';
    console.log(`${name.padEnd(22)} ${addr}  ${hasCode ? 'VERIFIED' : 'NO CODE'}`);
  }

  console.log('\n--- Recent Transactions ---\n');

  const block = await provider.getBlockNumber();
  console.log('Current block:', block);

  // Check last 100 blocks for deployer transactions
  let found = 0;
  for (let i = block; i > Math.max(block - 100, 0) && found < 10; i--) {
    try {
      const b = await provider.getBlock(i, true);
      if (!b || !b.transactions) continue;
      for (const txHash of b.transactions) {
        try {
          const tx = await provider.getTransaction(txHash);
          if (tx && tx.from && tx.from.toLowerCase() === deployer.toLowerCase()) {
            const receipt = await provider.getTransactionReceipt(txHash);
            console.log(`Block ${i} | TX: ${txHash}`);
            console.log(`  To: ${tx.to || 'CONTRACT CREATION'} | Status: ${receipt.status === 1 ? 'SUCCESS' : 'FAILED'} | Gas: ${receipt.gasUsed.toString()}`);
            found++;
          }
        } catch {}
      }
    } catch {}
  }

  if (found === 0) console.log('No recent transactions found in last 100 blocks.');
}

main().catch(err => console.error('Error:', err.message));
