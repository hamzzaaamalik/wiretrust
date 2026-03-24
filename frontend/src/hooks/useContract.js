import { useMemo, useState, useEffect } from 'react';
import { Contract } from 'ethers';
import { useWallet } from '../contexts/WalletContext.jsx';
import { getABI } from '../utils/contracts.js';

const abiCache = {};

export function useContract(contractName, address) {
  const { signer, provider } = useWallet();
  const [abiLoaded, setAbiLoaded] = useState(!!abiCache[contractName]);

  useEffect(() => {
    if (!contractName || abiCache[contractName]) {
      setAbiLoaded(!!abiCache[contractName]);
      return;
    }
    getABI(contractName).then((abi) => {
      abiCache[contractName] = abi;
      setAbiLoaded(true);
    }).catch((err) => {
      console.error(`Failed to load ABI for ${contractName}:`, err);
    });
  }, [contractName]);

  const contract = useMemo(() => {
    if (!address || !contractName || !abiLoaded) return null;
    const signerOrProvider = signer || provider;
    if (!signerOrProvider) return null;
    if (!abiCache[contractName]) return null;
    return new Contract(address, abiCache[contractName], signerOrProvider);
  }, [contractName, address, signer, provider, abiLoaded]);

  return contract;
}

export default useContract;
