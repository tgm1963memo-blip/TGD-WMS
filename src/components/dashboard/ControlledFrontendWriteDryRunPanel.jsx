import { useState } from 'react';
import { runControlledReceiveDryRun } from '../../services/controlledFrontendWriteDryRunService.js';

function getMovementId(result) {
  return result?.movement?.movement_id
    ?? result?.movement?.id
    ?? result?.movement
    ?? 'returned by RPC';
}

export function ControlledFrontendWriteDryRunPanel({ session }) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const authenticated = Boolean(session?.user);
  const canRun = authenticated && confirmed && !busy;

  async function handleRunDryRun() {
    setBusy(true);
    setError(null);
    setResult(null);

    const nextResult = await runControlledReceiveDryRun();
    setBusy(false);

    if (nextResult.error) {
      setError(nextResult.error);
      return;
    }

    setResult(nextResult.data);
  }

  return (
    <section
      className="controlled-write-dry-run-panel"
      style={{
        background: '#fff7ed',
        border: '1px solid #fed7aa',
        borderRadius: 8,
        marginBottom: 18,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        <h3 style={{ color: '#9a3412', margin: 0 }}>Controlled Frontend Write Dry Run</h3>
        <span style={{ color: '#7c2d12' }}>
          Staging only | Demo data only | RPC only | No direct stock balance update
        </span>
      </div>

      <ul style={{ color: '#7c2d12', marginTop: 0 }}>
        <li>เริ่มทดสอบเฉพาะ RECEIVE เท่านั้น</li>
        <li>ต้องเข้าสู่ระบบ Staging ก่อนใช้งาน</li>
        <li>ใช้ RPC ที่ผ่านการตรวจสอบเท่านั้น</li>
      </ul>

      <label style={{ alignItems: 'center', display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          type="checkbox"
        />
        <span>I understand this will write one demo RECEIVE movement to Staging</span>
      </label>

      <button
        className="primary-button"
        disabled={!canRun}
        onClick={handleRunDryRun}
        type="button"
      >
        {busy ? 'Running...' : 'Run controlled RECEIVE dry run'}
      </button>

      {!authenticated ? (
        <p style={{ color: '#92400e', marginBottom: 0 }}>
          ต้องเข้าสู่ระบบ Staging ก่อนจึงจะเปิดปุ่มทดสอบได้
        </p>
      ) : null}

      {result ? (
        <section
          role="status"
          style={{
            background: '#ecfdf5',
            border: '1px solid #bbf7d0',
            borderRadius: 8,
            color: '#166534',
            marginTop: 12,
            padding: 12,
          }}
        >
          <strong>Controlled RECEIVE dry run completed.</strong>
          <div>movement_id: {String(getMovementId(result))}</div>
          <div>Refresh the dashboard before and after comparison to confirm stock movement and balance changes.</div>
        </section>
      ) : null}

      {error ? (
        <p role="alert" style={{ color: '#991b1b', marginBottom: 0 }}>
          Controlled RECEIVE dry run failed: {error.message ?? String(error)}
        </p>
      ) : null}
    </section>
  );
}

export default ControlledFrontendWriteDryRunPanel;
