const fs = require('fs');

let file = fs.readFileSync('src/features/reports/MovementLedgerReportPage.jsx', 'utf8');

// Add import
file = file.replace('import { getActiveLocations } from \'../../services/warehouseLayoutService.js\';', 'import { getActiveLocations } from \'../../services/warehouseLayoutService.js\';\nimport { EmptyState } from \'../../components/ui/EmptyState.jsx\';');

// Replace empty state
const emptyStateHtml = `<div className="section-card" style={{ padding: 24, textAlign: 'center', color: 'var(--tgd-muted-text)' }}>
            กรุณาเลือกช่วงเวลาและกด Search เพื่อดูข้อมูล
          </div>`;
file = file.replace(emptyStateHtml, '<EmptyState message="รอการค้นหา" description="กรุณาเลือกช่วงเวลาและกด Search เพื่อดูข้อมูลรายการเคลื่อนไหว" />');

fs.writeFileSync('src/features/reports/MovementLedgerReportPage.jsx', file, 'utf8');
