/**
 * Converts raw contract / wallet errors into fan-friendly messages.
 */
export default function friendlyError(err) {
  const raw = err?.reason || err?.message || err?.data?.message || '';
  const msg = raw.toLowerCase();
  // Also check the error data for custom error selectors
  const data = err?.data || err?.error?.data || '';
  const dataStr = typeof data === 'string' ? data.toLowerCase() : '';
  const combined = msg + ' ' + dataStr;

  // Wallet / user actions
  if (combined.includes('user rejected') || combined.includes('user denied') || combined.includes('action_rejected'))
    return 'Transaction was cancelled in your wallet.';
  if (combined.includes('insufficient funds'))
    return 'Not enough WIRE for this transaction. Get more from the faucet.';
  if (combined.includes('metamask') && combined.includes('not found'))
    return 'MetaMask not detected. Please install MetaMask to continue.';

  // Network
  if (combined.includes('could not detect network') || combined.includes('network changed'))
    return 'Network connection issue. Please check you are on WireFluid Testnet.';
  if (combined.includes('network') && combined.includes('error'))
    return 'Network error. Please check your connection and try again.';
  if (combined.includes('timeout') || combined.includes('timed out'))
    return 'Request timed out. Please try again.';
  if (combined.includes('server error') || combined.includes('internal error'))
    return 'Server error. Please try again in a moment.';

  // PredictionModule errors (custom error selectors)
  if (combined.includes('invalidpredictiontype') || combined.includes('0xa7b0916e'))
    return 'This prediction type is not available yet. Please try again later.';
  if (combined.includes('matchalreadystarted') || combined.includes('0x'))
    if (combined.includes('matchalreadystarted'))
      return 'This match has already started. Predictions are closed, select an upcoming match.';
  if (combined.includes('alreadypredicted'))
    return 'You already made a prediction for this match and type.';
  if (combined.includes('invalidmatch') || combined.includes('invalidmatchid'))
    return 'This match is not registered on-chain. Please select a different match.';
  if (combined.includes('matchpredictionsfull'))
    return 'This match has reached the maximum number of predictions.';

  // PolicyEngine errors
  if (combined.includes('policy paused') || combined.includes('policy not active'))
    return 'Your policy is currently paused. Activate it first.';
  if (combined.includes('policy expired'))
    return 'Your policy has expired. Please update the expiry date.';
  if (combined.includes('exceeds per-action') || combined.includes('per-action limit'))
    return 'Amount exceeds your per-action spending limit.';
  if (combined.includes('exceeds daily'))
    return 'You have reached your daily spending limit.';
  if (combined.includes('too soon') || combined.includes('cooldown'))
    return 'Please wait for the cooldown period before your next action.';
  if (combined.includes('contract not in whitelist') || combined.includes('not in whitelist'))
    return 'This contract is not in your allowed list. Update your policy.';
  if (combined.includes('action not allowed'))
    return 'This action is not permitted by your policy.';
  if (combined.includes('max positions'))
    return 'Maximum open positions reached. Close some first.';

  // AgentRegistry / general
  if (combined.includes('franchisenotactive') || combined.includes('franchise not active'))
    return 'This franchise is not active right now.';
  if (combined.includes('not the owner') || combined.includes('ownable') || combined.includes('ownableunauthorizedaccount'))
    return 'You do not own this agent.';

  // FantasyModule
  if (combined.includes('contest not active') || combined.includes('contestnotactive'))
    return 'This contest is no longer accepting entries.';
  if (combined.includes('contest is locked') || combined.includes('contestlocked'))
    return 'This contest is locked. The match has started.';
  if (combined.includes('already joined') || combined.includes('alreadyjoined'))
    return 'You have already joined this contest.';
  if (combined.includes('exceeds credit') || combined.includes('creditlimitexceeded'))
    return 'Your squad exceeds the 100-credit budget.';

  // NFT
  if (combined.includes('soulbound'))
    return 'This item is soulbound and cannot be transferred.';
  if (combined.includes('price exceeds') || combined.includes('maxresaleprice'))
    return 'Resale price exceeds the allowed maximum.';

  // Generic contract reverts
  if (combined.includes('execution reverted') || combined.includes('call revert') || combined.includes('estimategas'))
    return 'Transaction failed. The smart contract rejected this action. Please check your inputs and try again.';
  if (combined.includes('nonce') && combined.includes('too'))
    return 'Transaction nonce error. Please refresh the page and try again.';
  if (combined.includes('gas') && combined.includes('exceed'))
    return 'Transaction requires too much gas. Try a smaller amount.';
  if (combined.includes('unpredictable_gas_limit'))
    return 'Transaction would fail. Please check your inputs and try again.';

  // Fallback: if the raw message is too long / technical, simplify
  if (raw.length > 120)
    return 'Transaction failed. Please try again.';

  return raw || 'Something went wrong. Please try again.';
}
