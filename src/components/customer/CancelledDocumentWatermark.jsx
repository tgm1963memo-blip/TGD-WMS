// Diagonal "ยกเลิกแล้ว / CANCELLED" watermark shown across a printed
// customer request document (deposit or withdrawal) whose request status
// is CANCELLED — printed copies otherwise carry no indication the request
// behind them was voided (see e.g. CWR-20260710-0009, printed with no
// cancelled marking at all despite being cancelled in the system).
// Shared by CustomerWithdrawalRequestPrintDocument.jsx,
// CustomerDepositRequestPrintDocument.jsx, and
// CustomerDepositStaffWorkOrderPrint.jsx — the parent <article> must have
// position: 'relative' for this to anchor to the printed page rather than
// the whole document.
export function CancelledDocumentWatermark({ status }) {
  if (status !== 'CANCELLED') return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: '42%',
        left: '50%',
        transform: 'translate(-50%, -50%) rotate(-28deg)',
        fontSize: 56,
        fontWeight: 900,
        color: 'rgba(220, 38, 38, 0.30)',
        border: '6px solid rgba(220, 38, 38, 0.30)',
        borderRadius: 14,
        padding: '6px 28px',
        letterSpacing: 3,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: 50,
      }}
    >
      ยกเลิกแล้ว / CANCELLED
    </div>
  );
}
