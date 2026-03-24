// ABIs will be copied from hardhat artifacts after compilation
// For now, export a function that loads them dynamically
export async function getABI(contractName) {
  const module = await import(`../abis/${contractName}.json`);
  return module.default || module;
}
