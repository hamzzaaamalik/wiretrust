import React, { useState } from 'react';

export default function SimulatePanel({ agentId, target, action, amount, onSimulate, onExecute }) {
  const [simResult, setSimResult] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);

  const handleSimulate = async () => {
    setSimulating(true);
    setSimResult(null);
    try {
      const result = await onSimulate({ agentId, target, action, amount });
      setSimResult(result);
    } catch (err) {
      setSimResult({ prediction: 'ERROR', reason: err.message || 'Simulation failed' });
    } finally {
      setSimulating(false);
    }
  };

  const handleExecute = async () => {
    setExecuting(true);
    try {
      await onExecute({ agentId, target, action, amount });
    } finally {
      setExecuting(false);
    }
  };

  const canExecute = simResult || manualOverride;

  return (
    <div className="card space-y-4">
      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Simulate & Execute</h3>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500">Agent</span>
          <p className="text-white font-mono text-xs truncate">{agentId || '--'}</p>
        </div>
        <div>
          <span className="text-gray-500">Target</span>
          <p className="text-white font-mono text-xs truncate">{target || '--'}</p>
        </div>
        <div>
          <span className="text-gray-500">Action</span>
          <p className="text-white text-xs">{action || '--'}</p>
        </div>
        <div>
          <span className="text-gray-500">Amount</span>
          <p className="text-white text-xs">{amount || '--'}</p>
        </div>
      </div>

      {/* Simulate button */}
      <button
        onClick={handleSimulate}
        disabled={simulating}
        className="btn-secondary w-full text-sm disabled:opacity-50"
      >
        {simulating ? 'Simulating...' : 'SIMULATE'}
      </button>

      {/* Simulation result */}
      {simResult && (
        <div className={`rounded-lg p-3 border ${
          simResult.prediction === 'SUCCESS'
            ? 'bg-success/10 border-success/30'
            : simResult.prediction === 'BLOCKED'
            ? 'bg-error/10 border-error/30'
            : 'bg-warning/10 border-warning/30'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-sm font-bold ${
              simResult.prediction === 'SUCCESS' ? 'text-success'
              : simResult.prediction === 'BLOCKED' ? 'text-error'
              : 'text-warning'
            }`}>
              {simResult.prediction}
            </span>
            {simResult.predictedScore !== undefined && (
              <span className="text-xs text-gray-400">
                Score: <span className="text-white font-mono">{simResult.predictedScore}</span>
              </span>
            )}
          </div>
          {simResult.reason && (
            <p className="text-xs text-gray-400">{simResult.reason}</p>
          )}
        </div>
      )}

      {/* Manual override */}
      {!simResult && (
        <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={manualOverride}
            onChange={(e) => setManualOverride(e.target.checked)}
            className="rounded border-dark-border bg-dark-bg text-primary focus:ring-primary"
          />
          Execute without simulation
        </label>
      )}

      {/* Execute button */}
      <button
        onClick={handleExecute}
        disabled={!canExecute || executing}
        className="btn-primary w-full text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {executing ? 'Executing...' : 'EXECUTE'}
      </button>
    </div>
  );
}
