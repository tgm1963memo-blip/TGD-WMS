export function AgingBucketSummary({ data = [], loading, error, label }) {
  if (loading) return <p className="sprint-status">กำลังโหลดข้อมูล {label}...</p>;
  if (error) return <p className="sprint-status">ไม่สามารถโหลดข้อมูล {label} ได้</p>;
  if (!data.length) return <p className="sprint-status">ไม่พบข้อมูล {label}</p>;

  return (
    <table className="tgd-table">
      <thead>
        <tr>
          <th>{label}</th>
          <th>รายการ</th>
          <th>ยอดจัดเก็บ</th>
          <th>อายุจัดเก็บเฉลี่ย (วัน)</th>
          <th>จำนวนวันคิดค่าฝาก</th>
          <th>ใกล้หมดอายุ</th>
          <th>หมดอายุแล้ว</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.id}>
            <td>{row.group_id}</td>
            <td>{row.row_count}</td>
            <td>{row.qty_on_hand}</td>
            <td>{row.average_aging_days}</td>
            <td>{row.chargeable_days_total}</td>
            <td>{row.near_expiry_lots}</td>
            <td>{row.expired_lots}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
