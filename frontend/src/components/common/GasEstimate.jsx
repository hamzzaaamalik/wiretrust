import { useState, useEffect } from 'react';
import { Fuel } from 'lucide-react';

const GAS_PRICE_GWEI = 10n; // WireFluid minimum gas price
const GWEI = 1000000000n;

/**
 * Displays estimated gas fee for a transaction.
 * Props:
 *   provider  - ethers provider
 *   txParams  - { to, data, value?, from? } for estimateGas
 *   label     - optional label override
 *   fallbackGas - fallback gas units if estimation fails (default 200000)
 */
export default function GasEstimate({ provider, txParams, label, fallbackGas = 200000n }) {
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!provider || !txParams?.to) {
      // Show static estimate when we can't estimate dynamically
      const cost = BigInt(fallbackGas) * GAS_PRICE_GWEI * GWEI;
      setEstimate({ gas: fallbackGas.toString(), cost: formatWire(cost) });
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function estimate() {
      try {
        const gasUnits = await provider.estimateGas(txParams);
        const cost = gasUnits * GAS_PRICE_GWEI * GWEI;
        if (!cancelled) {
          setEstimate({ gas: gasUnits.toString(), cost: formatWire(cost) });
        }
      } catch {
        // Fallback to static estimate
        const cost = BigInt(fallbackGas) * GAS_PRICE_GWEI * GWEI;
        if (!cancelled) {
          setEstimate({ gas: fallbackGas.toString(), cost: formatWire(cost) });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    estimate();
    return () => { cancelled = true; };
  }, [provider, txParams?.to, txParams?.data, fallbackGas]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-2xs text-zinc-600">
        <Fuel size={12} />
        <span>Estimating gas...</span>
      </div>
    );
  }

  if (!estimate) return null;

  return (
    <div className="flex items-center gap-2 text-2xs text-zinc-500">
      <Fuel size={12} className="text-zinc-600" />
      <span>{label || 'Est. Gas Fee'}:</span>
      <span className="text-zinc-300 font-medium">~{estimate.cost} WIRE</span>
      <span className="text-zinc-700">({estimate.gas} gas units)</span>
    </div>
  );
}

function formatWire(wei) {
  const str = wei.toString();
  if (str.length <= 18) {
    return '0.' + str.padStart(18, '0').slice(0, 6);
  }
  const whole = str.slice(0, str.length - 18);
  const frac = str.slice(str.length - 18, str.length - 12);
  return `${whole}.${frac}`;
}
