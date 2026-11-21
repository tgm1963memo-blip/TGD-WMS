// Where a customer request stands, as four plain stages. Rejected, cancelled
// or unknown statuses show nothing: the status badge already says so, and a
// half-filled bar would read as "still moving".
const WITHDRAWAL_STAGES = [
  { label: 'ลูกค้าส่งคำขอ', statuses: ['SUBMITTED_BY_CUSTOMER'] },
  { label: 'ธุรการตรวจสอบ', statuses: ['ADMIN_REVIEWING'] },
  { label: 'คลังจัดสินค้า', statuses: ['ADMIN_ACCEPTED', 'WAREHOUSE_PICKING'] },
  { label: 'เสร็จสิ้น', statuses: ['DISPATCHED', 'LOADED_CONFIRMED', 'CUSTOMER_NOTIFIED', 'CLOSED', 'COMPLETED'] },
];

const DEPOSIT_STAGES = [
  { label: 'ลูกค้าส่งคำขอ', statuses: ['SUBMITTED_BY_CUSTOMER'] },
  { label: 'ธุรการตรวจสอบ', statuses: ['ADMIN_REVIEWING'] },
  {
    label: 'คลังรับสินค้า',
    statuses: ['ADMIN_ACCEPTED', 'WAREHOUSE_RECEIVING', 'PALLETIZING', 'ADMIN_RECOUNT_REQUESTED', 'RECEIVING_VARIANCE', 'COUNT_VARIANCE_REVIEW'],
  },
  { label: 'เสร็จสิ้น', statuses: ['RECEIVED_CONFIRMED', 'CUSTOMER_NOTIFIED', 'CLOSED'] },
];

export function getRequestStageIndex(stages, status) {
  return stages.findIndex((stage) => stage.statuses.includes(status));
}

export function RequestProgress({ kind, status }) {
  const stages = kind === 'deposit' ? DEPOSIT_STAGES : WITHDRAWAL_STAGES;
  const current = getRequestStageIndex(stages, status);
  if (current < 0) return null;
  const finished = current === stages.length - 1;

  return (
    <ol className="request-progress" aria-label="ขั้นตอนของเอกสาร" data-testid="request-progress">
      {stages.map((stage, index) => {
        const done = index < current || (finished && index === current);
        const isCurrent = index === current && !finished;
        return (
          <li
            key={stage.label}
            className={`request-progress-step${done ? ' request-progress-step--done' : ''}${isCurrent ? ' request-progress-step--current' : ''}`}
            aria-current={index === current ? 'step' : undefined}
          >
            {stage.label}
          </li>
        );
      })}
    </ol>
  );
}
