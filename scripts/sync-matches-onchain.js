/**
 * Sync all DB matches to on-chain MatchOracle.
 * Creates matches that exist in DB but not on-chain.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', 'contracts', '.env') });
const { ethers } = require('ethers');
const fs = require('fs');
const { Pool } = require('pg');

const provider = new ethers.JsonRpcProvider('https://evm.wirefluid.com', { name: 'wirefluid', chainId: 92533 });
const wallet = new ethers.Wallet(process.env.DEPLOYER_KEY || process.env.PRIVATE_KEY, provider);
const addresses = JSON.parse(fs.readFileSync(require('path').resolve(__dirname, '..', 'deployed-addresses.json'), 'utf-8'));
const abi = JSON.parse(fs.readFileSync(require('path').resolve(__dirname, '..', 'artifacts/contracts/oracle/MatchOracle.sol/MatchOracle.json'), 'utf-8')).abi;
const oracle = new ethers.Contract(addresses.matchOracle, abi, wallet);

// DB connection - read from backend .env
const backendEnv = fs.readFileSync(require('path').resolve(__dirname, '..', 'backend', '.env'), 'utf-8');
const dbUrl = backendEnv.match(/DATABASE_URL=(.+)/)?.[1]?.trim();

async function main() {
  const pool = new Pool({ connectionString: dbUrl });

  const { rows: dbMatches } = await pool.query(
    `SELECT match_id, team1, team2, start_time FROM matches WHERE status IN ('UPCOMING', 'LIVE') ORDER BY match_id ASC`
  );

  const onChainCount = Number(await oracle.matchCount());
  console.log(`On-chain matches: ${onChainCount}`);
  console.log(`DB matches to sync: ${dbMatches.length}`);
  console.log(`Balance: ${ethers.formatEther(await provider.getBalance(wallet.address))} WIRE\n`);

  let created = 0;
  for (const match of dbMatches) {
    // Use future timestamp (matches need future startTime after our fix)
    const startTime = match.start_time
      ? Math.max(Math.floor(new Date(match.start_time).getTime() / 1000), Math.floor(Date.now() / 1000) + 86400)
      : Math.floor(Date.now() / 1000) + 86400 * 7;

    try {
      const tx = await oracle.createMatch(1, match.team1, match.team2, startTime, {
        gasLimit: 300000n,
      });
      await tx.wait();
      const newId = Number(await oracle.matchCount());
      console.log(`Created match #${newId}: ${match.team1} vs ${match.team2} (DB id: ${match.match_id})`);
      created++;
    } catch (err) {
      console.error(`Failed match ${match.match_id} (${match.team1} vs ${match.team2}):`, err.message?.slice(0, 80));
    }
  }

  console.log(`\nDone! Created ${created} matches on-chain.`);
  console.log(`Total on-chain: ${Number(await oracle.matchCount())}`);
  console.log(`Balance: ${ethers.formatEther(await provider.getBalance(wallet.address))} WIRE`);
  await pool.end();
}

main().catch(console.error);
