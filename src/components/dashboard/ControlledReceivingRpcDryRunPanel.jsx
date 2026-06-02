import { useState } from 'react';
import { runControlledReceivingRpcDryRun } from '../../services/controlledReceivingRpcDryRunService.js';

function BaselineTable({ title, baseline }) {
  if (!baseline) {
    return null;
  }

  return (
    <div style={{ minWidth: 240 }}>
      <h4 style={{ margin: '0 0 8px' }}>{title}</h4>
      <dl style={{ display: 'grid', gap: 6, margin: 0 }}>
        <div>receiving_documents: {baseline.receivingDocuments}</div>
        <div>receiving_lines: {baseline.receivingLines}</div>
        <div>stock_movements: {baseline.stockMovements}</div>
        <div>stock_balances: {baseline.stockBalances}</div>
        <div>total_stock_quantity: {baseline.totalStockQuantity}</div>
      </dl>
    </div>
  );
}

function ValidationList({ validation }) {
  if (!validation) {
    return null;
  }

  return (
    <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
      {Object.entries(validation).map(([key, value]) => (
        <li key={key}>
          {key}: {value ? 'PASS' : 'FAIL'}
        </li>
      ))}
    </ul>
  );
}

export function ControlledReceivingRpcDryRunPanel({ session }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const authenticated = Boolean(session?.user);

  async function handleRunDryRun() {
    setBusy(true);
    setError(null);
    setResult(null);

    const nextResult = await runControlledReceivingRpcDryRun();
    setBusy(false);

    if (nextResult.error) {
      setError(nextResult.error);
      return;
    }

    setResult(nextResult.data);
  }

  return (
    <section
      className="controlled-receiving-rpc-dry-run-panel"
      style={{
        background: '#f8fafc',
        border: '1px solid #cbd5e1',
        borderRadius: 8,
        marginBottom: 18,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        <h3 style={{ color: '#334155', margin: 0 }}>Controlled Receiving RPC Dry Run</h3>
        <strong style={{ color: '#9a3412' }}>
          Staging only / Receiving UI remains locked / No stock posting
        </strong>
      </div>

      <ul style={{ color: '#475569', marginTop: 0 }}>
        <li>Runs through the authenticated Supabase session only.</li>
        <li>Uses Receiving RPCs only; no direct table insert/update/delete/upsert from the frontend.</li>
        <li>Confirm RPC is expected to stop before stock posting.</li>
      </ul>

      <button
        className="primary-button"
        disabled={!authenticated || busy}
        onClick={handleRunDryRun}
        type="button"
      >
        {busy ? 'Running...' : 'Run Receiving RPC Dry Run'}
      </button>

      {!authenticated ? (
        <p style={{ color: '#92400e', marginBottom: 0 }}>
          Please sign in to Staging before running the controlled Receiving RPC dry run.
        </p>
      ) : null}

      {result ? (
        <section
          role="status"
          style={{
            background: result.validationStatus === 'PASS' ? '#ecfdf5' : '#fef2f2',
            border: result.validationStatus === 'PASS' ? '1px solid #bbf7d0' : '1px solid #fecaca',
            borderRadius: 8,
            color: result.validationStatus === 'PASS' ? '#166534' : '#991b1b',
            marginTop: 12,
            padding: 12,
          }}
        >
          <strong>Validation: {result.validationStatus}</strong>
          <div>document_id: {String(result.documentId)}</div>
          <div>line_id: {String(result.lineId)}</div>
          <div>expected confirm block: {result.confirmExpectedError}</div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 12 }}>
            <BaselineTable title="Before baseline" baseline={result.before} />
            <BaselineTable title="After baseline" baseline={result.after} />
          </div>

          <ValidationList validation={result.validation} />
        </section>
      ) : null}

      {error ? (
        <p role="alert" style={{ color: '#991b1b', marginBottom: 0 }}>
          Controlled Receiving RPC dry run failed: {error.message ?? String(error)}
        </p>
      ) : null}
    </section>
  );
}

export default ControlledReceivingRpcDryRunPanel;
