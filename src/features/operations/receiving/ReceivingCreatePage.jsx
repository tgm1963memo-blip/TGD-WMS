import { Link } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';

export function ReceivingCreatePage() {
  return (
    <section className="page-shell">
      <PageHeader
        title="Receiving Create Locked"
        description="การสร้างเอกสารรับเข้าใหม่ยังถูกล็อกอยู่ระหว่าง Operational Write Gate"
      />

      <section
        className="warning-panel"
        role="status"
        style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 8,
          color: '#92400e',
          marginBottom: 18,
          padding: 16,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Operational write is locked</h3>
        <ul style={{ marginBottom: 0 }}>
          <li>Staging only</li>
          <li>Operational write is locked</li>
          <li>Controlled write passed in 13J-H</li>
          <li>Next approval required before enabling real receiving</li>
        </ul>
      </section>

      <section
        style={{
          background: '#ffffff',
          border: '1px solid #d9e2ec',
          borderRadius: 8,
          padding: 16,
        }}
      >
        <p style={{ marginTop: 0 }}>
          หน้านี้ไม่แสดงฟอร์มบันทึกเอกสารรับเข้า และยังไม่เปิดให้ส่งข้อมูล Receiving จริงจาก Frontend
        </p>
        <Link className="action-link" to="/operations/receiving">
          Back to receiving
        </Link>
      </section>
    </section>
  );
}
