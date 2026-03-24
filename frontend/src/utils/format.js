import { formatEther, decodeBytes32String } from 'ethers';

/**
 * Formats a wei BigInt value to human-readable WIRE with 2 decimal places.
 */
export function formatWIRE(wei) {
  if (wei == null) return '0.00 WIRE';
  const ether = formatEther(wei);
  const num = parseFloat(ether);
  return `${num.toFixed(2)} WIRE`;
}

/**
 * Shortens an Ethereum address to "0x1234...5678" format.
 */
export function shortenAddress(addr) {
  if (!addr) return '';
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/**
 * Formats a Unix timestamp (seconds) to a readable date string.
 */
export function formatTimestamp(unix) {
  if (!unix) return '';
  const date = new Date(Number(unix) * 1000);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Returns score value with a color class based on threshold.
 * green >= 70, yellow >= 40, red < 40
 */
export function formatScore(score) {
  if (score == null) return { value: 0, colorClass: 'text-red-500' };
  const num = Number(score);
  let colorClass;
  if (num >= 70) {
    colorClass = 'text-green-500';
  } else if (num >= 40) {
    colorClass = 'text-yellow-500';
  } else {
    colorClass = 'text-red-500';
  }
  return { value: num, colorClass };
}

/**
 * Maps badge enum values to human-readable labels.
 * 0 = SAFE, 1 = MEDIUM, 2 = RISKY
 */
export function formatBadge(badge) {
  const labels = { 0: 'SAFE', 1: 'MEDIUM', 2: 'RISKY' };
  return labels[Number(badge)] ?? 'UNKNOWN';
}

/**
 * Decodes a bytes32 hex string to a human-readable action name.
 * Falls back to shortened hex if decoding fails.
 */
export function formatAction(bytes32) {
  if (!bytes32) return '-';
  try {
    const decoded = decodeBytes32String(bytes32);
    if (decoded) return decoded;
  } catch {}
  // Fallback: show shortened hex
  if (bytes32.length > 14) return `${bytes32.slice(0, 10)}...`;
  return bytes32;
}

/**
 * Friendly labels for action names.
 */
const ACTION_LABELS = {
  JOIN_CONTEST: 'Join Squad Challenge',
  FANTASY_JOIN: 'Join Squad Challenge',
  PREDICT: 'Make Prediction',
  BUY_NFT: 'Buy NFT',
  CREATE_AGENT: 'Create Agent',
};

export function friendlyAction(bytes32) {
  const raw = formatAction(bytes32);
  return ACTION_LABELS[raw] || raw;
}
