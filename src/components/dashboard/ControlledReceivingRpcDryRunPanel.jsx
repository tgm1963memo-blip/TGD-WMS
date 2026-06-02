import { useState } from 'react';
import {
  CONTROLLED_RECEIVING_DRY_RUN_DOCUMENT_ID,
  runControlledReceivingRpcDryRun,
} from '../../services/controlledReceivingRpcDryRunService.js';

export function ControlledReceivingRpcDryRunPanel({ session }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const authenticated = Boolean(session?.user);
  const userId = session?.user?.id ?? session?.user?.email ?? 'unknown';

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
          DRY RUN ONLY — no stock movement will be posted
        </strong>
      </div>

      <ul style={{ color: '#475569', marginTop: 0 }}>
        <li>Requires an authenticated Staging session.</li>
        <li>Calls only <code>tgd_rpc_post_receiving_document_dry</code>.</li>
        <li>Uses fixed document_id: {CONTROLLED_RECEIVING_DRY_RUN_DOCUMENT_ID}</li>
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
      ) : (
        <p style={{ color: '#0f172a', marginTop: 12, marginBottom: 0 }}>
          Authenticated user ID: {userId}
        </p>
      )}

      {result ? (
        <section
          role="status"
          style={{
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            color: '#0f172a',
            marginTop: 12,
            padding: 12,
          }}
        >
          <strong>Dry run result</strong>
          <div style={{ marginTop: 8 }}>document_id: {CONTROLLED_RECEIVING_DRY_RUN_DOCUMENT_ID}</div>
          <div style={{ marginTop: 12 }}>
            <pre
              style={{
                background: '#fff',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                margin: 0,
                padding: 12,
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {JSON.stringify(result.dryRunResult, null, 2)}
            </pre>
          </div>
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
