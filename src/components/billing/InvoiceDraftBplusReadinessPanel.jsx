import { INVOICE_DRAFT_STATUS, formatInvoiceDraftError } from '../../utils/billingInvoiceDraftUtils.js';
import { BPLUS_EXPORT_READINESS_STATUS } from '../../utils/billingInvoiceDraftBplusExportUtils.js';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function formatNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number.toLocaleString() : '-';
}

function readinessBadgeClass(status) {
  if (status === BPLUS_EXPORT_READINESS_STATUS.READY) return 'badge badge-success';
  if (status === BPLUS_EXPORT_READINESS_STATUS.NEEDS_REVIEW) return 'badge badge-warning';
  return 'badge badge-danger';
}

export function InvoiceDraftBplusReadinessPanel({
  draft,
  readiness = null,
  loading = false,
  error = null,
  onPreview,
}) {
  const isApproved = draft?.status === INVOICE_DRAFT_STATUS.APPROVED;

  return (
    <section
      className="section-card"
      data-testid="invoice-draft-bplus-readiness-panel"
      style={{ marginTop: 16, padding: 16 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0 }}>Bplus Export Readiness Preview</h3>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#4b5563' }}>
            Read-only preview for accounting review. No export file is generated and no draft status changes.
          </p>
        </div>
        {isApproved ? (
          <button
            type="button"
            className="btn btn-outline"
            onClick={onPreview}
            disabled={loading}
            data-testid="invoice-draft-bplus-preview-button"
          >
            {loading ? 'Loading preview...' : 'Preview Bplus Readiness'}
          </button>
        ) : null}
      </div>

      {!isApproved ? (
        <p style={{ marginTop: 16, fontSize: 14 }}>
          Bplus export readiness preview is available after the draft is approved.
        </p>
      ) : null}

      {error ? (
        <div role="alert" style={{ marginTop: 16, color: 'var(--tgd-danger)' }}>
          {formatInvoiceDraftError(error)}
        </div>
      ) : null}

      {readiness ? (
        <>
          <div style={{ marginTop: 16 }}>
            <span className={readinessBadgeClass(readiness.readiness_status)} data-testid="invoice-draft-bplus-readiness-badge">
              {readiness.readiness_status}
            </span>
          </div>

          <div data-testid="invoice-draft-bplus-readiness-checklist" style={{ marginTop: 16 }}>
            {readiness.blockers?.length ? (
              <div data-testid="invoice-draft-bplus-readiness-blockers" style={{ marginBottom: 12 }}>
                <strong>Blocking issues</strong>
                <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                  {readiness.blockers.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p data-testid="invoice-draft-bplus-readiness-blockers">No blocking issues.</p>
            )}

            {readiness.warnings?.length ? (
              <div data-testid="invoice-draft-bplus-readiness-warnings">
                <strong>Warnings / pending confirmation</strong>
                <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                  {readiness.warnings.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p data-testid="invoice-draft-bplus-readiness-warnings">No warnings.</p>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <strong>Header preview</strong>
            <div className="summary-grid" style={{ marginTop: 8 }}>
              <div className="section-card"><strong>Draft No</strong><div>{readiness.header_preview?.draft_no ?? '-'}</div></div>
              <div className="section-card"><strong>Customer</strong><div>{readiness.header_preview?.customer_name ?? '-'}</div></div>
              <div className="section-card"><strong>Customer Code</strong><div>{readiness.header_preview?.customer_code ?? '-'}</div></div>
              <div className="section-card"><strong>Billing Period</strong><div>{readiness.header_preview?.billing_period ?? '-'}</div></div>
              <div className="section-card"><strong>Total Chargeable Weight</strong><div>{formatNumber(readiness.header_preview?.total_chargeable_weight)}</div></div>
              <div className="section-card"><strong>Total Amount</strong><div>{readiness.header_preview?.total_amount == null ? '-' : formatNumber(readiness.header_preview?.total_amount)} {readiness.header_preview?.currency}</div></div>
              <div className="section-card"><strong>Status</strong><div>{readiness.header_preview?.status ?? '-'}</div></div>
              <div className="section-card"><strong>Approved At</strong><div>{formatDate(readiness.header_preview?.approved_at)}</div></div>
            </div>
          </div>

          <div className="table-responsive responsive-table" data-testid="invoice-draft-bplus-export-preview-table" style={{ marginTop: 16 }}>
            <table className="tgd-table">
              <thead>
                <tr>
                  <th>Product Code</th>
                  <th>Product Name</th>
                  <th>Lot No</th>
                  <th>Movement Type</th>
                  <th>Qty</th>
                  <th>Chargeable Weight</th>
                  <th>Rate</th>
                  <th>Amount</th>
                  <th>Bplus Service</th>
                  <th>Line Warnings</th>
                </tr>
              </thead>
              <tbody>
                {(readiness.line_previews ?? []).map((line, index) => (
                  <tr key={`${line.product_code ?? 'line'}-${index}`}>
                    <td>{line.product_code ?? '-'}</td>
                    <td>{line.product_name ?? '-'}</td>
                    <td>{line.lot_no ?? '-'}</td>
                    <td>{line.movement_type ?? '-'}</td>
                    <td>{formatNumber(line.qty)} {line.uom ?? ''}</td>
                    <td>{formatNumber(line.chargeable_weight)}</td>
                    <td>{line.rate == null ? '-' : formatNumber(line.rate)}</td>
                    <td>{line.amount == null ? '-' : formatNumber(line.amount)}</td>
                    <td>{line.bplus_service_code ?? '-'}</td>
                    <td>{(line.line_warnings ?? []).join(' ') || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
