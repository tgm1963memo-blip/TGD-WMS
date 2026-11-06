import { useEffect, useMemo, useState } from 'react';

const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TOP_CUSTOMERS = 5;

export function formatTHB(amount) {
  return `฿${Number(amount ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCompactTHB(amount) {
  const n = Number(amount ?? 0);
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

export function monthLabel(monthKey, language = 'th', { withYear = false } = {}) {
  const [y, m] = String(monthKey ?? '').split('-');
  const idx = Number(m) - 1;
  const names = language === 'en' ? MONTHS_EN : MONTHS_TH;
  if (!names[idx]) return String(monthKey ?? '-');
  if (!withYear) return names[idx];
  // monthKey years are CE; Thai labels show BE like the rest of the app.
  const year = language === 'en' ? Number(y) : Number(y) + 543;
  return `${names[idx]} ${year}`;
}

// Rounds the axis top up to a 1/2/2.5/5 × 10^n step so ticks read cleanly.
export function niceAxisMax(value) {
  if (!(value > 0)) return 1;
  const exp = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * exp >= value) return step * exp;
  }
  return 10 * exp;
}

function isCurrentMonth(monthKey, now = new Date()) {
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return monthKey === key;
}

function RevenueChart({ months, selectedKey, onSelect, language }) {
  const W = 420;
  const H = 168;
  const top = 18;
  const bottom = 22;
  const left = 40;
  const chartH = H - top - bottom;
  const max = niceAxisMax(Math.max(...months.map((m) => m.amount), 0));
  const y = (v) => top + chartH - (v / max) * chartH;
  const step = (W - left) / Math.max(months.length, 1);
  const barW = Math.min(40, step * 0.6);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);

  const summary = months
    .map((m) => `${monthLabel(m.monthKey, language, { withYear: true })} ${formatTHB(m.amount)}`)
    .join(', ');

  return (
    <svg
      className="dash-rev-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="group"
      aria-label={(language === 'th' ? 'รายได้รายเดือน: ' : 'Monthly revenue: ') + summary}
    >
      {ticks.map((v) => (
        <g key={v}>
          <line x1={left} x2={W} y1={y(v)} y2={y(v)} stroke="var(--color-border)" strokeWidth="1" />
          <text x={left - 6} y={y(v) + 3} textAnchor="end">{formatCompactTHB(v)}</text>
        </g>
      ))}
      {months.map((m, i) => {
        const x = left + i * step + (step - barW) / 2;
        const selected = m.monthKey === selectedKey;
        const partial = isCurrentMonth(m.monthKey);
        const h = Math.max(0, y(0) - y(m.amount));
        const label = `${monthLabel(m.monthKey, language, { withYear: true })}: ${formatTHB(m.amount)}${partial ? (language === 'th' ? ' (ยังไม่ครบเดือน)' : ' (month to date)') : ''}`;
        return (
          <g
            key={m.monthKey}
            className="dash-rev-bar"
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-label={label}
            onClick={() => onSelect(m.monthKey)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(m.monthKey); }
            }}
          >
            <title>{label}</title>
            {/* Full-height hit area so short bars are still easy to click. */}
            <rect x={left + i * step} y={top} width={step} height={chartH} fill="transparent" />
            <rect
              x={x}
              y={y(m.amount)}
              width={barW}
              height={h}
              rx="3"
              fill={selected ? 'var(--tgd-primary-gold)' : 'var(--color-text-muted)'}
              opacity={selected ? 1 : 0.4}
              stroke={partial ? 'var(--color-gold-text)' : undefined}
              strokeDasharray={partial ? '3 3' : undefined}
            />
            <text x={x + barW / 2} y={y(m.amount) - 5} textAnchor="middle" className={selected ? 'dash-rev-lbl' : undefined}>
              {formatCompactTHB(m.amount)}
            </text>
            <text x={x + barW / 2} y={H - 6} textAnchor="middle" className={selected ? 'dash-rev-lbl' : undefined}>
              {monthLabel(m.monthKey, language)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Storage revenue overview: month bars (click to pick a month) + that
 * month's customer split. Data from getMonthlyStorageRevenueSummary.
 */
export function RevenueOverview({ data, language = 'th' }) {
  const months = useMemo(() => data?.months ?? [], [data]);
  const currentKey = data?.currentMonth?.monthKey ?? months[months.length - 1]?.monthKey ?? null;
  const [selectedKey, setSelectedKey] = useState(currentKey);

  useEffect(() => { setSelectedKey(currentKey); }, [currentKey]);

  const selectedIndex = Math.max(0, months.findIndex((m) => m.monthKey === selectedKey));
  const selected = months[selectedIndex] ?? null;
  const previous = selectedIndex > 0 ? months[selectedIndex - 1] : null;
  const selectedPartial = selected ? isCurrentMonth(selected.monthKey) : false;
  const delta = selected && previous && previous.amount > 0 && !selectedPartial
    ? ((selected.amount - previous.amount) / previous.amount) * 100
    : null;

  const customers = selected?.byCustomer ?? [];
  const top = customers.slice(0, TOP_CUSTOMERS);
  const rest = customers.slice(TOP_CUSTOMERS);
  const restAmount = rest.reduce((sum, c) => sum + c.amount, 0);
  const maxCustomer = Math.max(...top.map((c) => c.amount), restAmount, 1);
  const th = language === 'th';

  if (!months.length) {
    return (
      <div className="dash-empty">{th ? 'ยังไม่มีข้อมูลรายได้ในช่วงนี้' : 'No revenue data for this period yet.'}</div>
    );
  }

  return (
    <div className="dash-rev">
      <div>
        <h4>{th ? `รายได้ค่าฝากรายเดือน · ${months.length} เดือนล่าสุด` : `Monthly storage revenue · last ${months.length} months`}</h4>
        <div className="dash-rev-big">
          <span className="dash-kpi-value" data-testid="revenue-selected-amount">{formatTHB(selected?.amount)}</span>
          <span className="dash-kpi-helper">
            {monthLabel(selected?.monthKey, language, { withYear: true })}
            {selectedPartial ? (th ? ' · ยังไม่ครบเดือน' : ' · month to date') : null}
            {delta != null ? (
              <>
                {' · '}
                <span className={delta >= 0 ? 'dash-up' : 'dash-down'}>
                  {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
                </span>
                {th ? ` จาก ${monthLabel(previous.monthKey, language)}` : ` vs ${monthLabel(previous.monthKey, language)}`}
              </>
            ) : null}
          </span>
        </div>
        <RevenueChart months={months} selectedKey={selected?.monthKey} onSelect={setSelectedKey} language={language} />
        <p className="dash-note">
          {th ? `รวม ${months.length} เดือน ${formatTHB(data?.totalAmount)} · กดที่แท่งเพื่อดูแยกตามลูกค้า` : `${months.length}-month total ${formatTHB(data?.totalAmount)} · click a bar for the customer split`}
        </p>
      </div>
      <div>
        <h4>{th ? `แยกตามลูกค้า · ${monthLabel(selected?.monthKey, language, { withYear: true })}` : `By customer · ${monthLabel(selected?.monthKey, language, { withYear: true })}`}</h4>
        {top.length === 0 ? (
          <div className="dash-empty" style={{ padding: 0 }}>{th ? 'ไม่มีรายได้ในเดือนนี้' : 'No revenue this month.'}</div>
        ) : (
          <div className="dash-cust">
            {top.map((c) => (
              <div className="dash-cust-row" key={c.customerId}>
                <span title={c.customerName}>{c.customerName}</span>
                <div className="dash-bar"><i style={{ width: `${(c.amount / maxCustomer) * 100}%` }} /></div>
                <span className="num">{formatCompactTHB(c.amount)}</span>
              </div>
            ))}
            {rest.length > 0 ? (
              <div className="dash-cust-row">
                <span>{th ? `อื่นๆ (${rest.length} ราย)` : `Others (${rest.length})`}</span>
                <div className="dash-bar"><i style={{ width: `${(restAmount / maxCustomer) * 100}%`, background: 'var(--color-border-strong)' }} /></div>
                <span className="num">{formatCompactTHB(restAmount)}</span>
              </div>
            ) : null}
          </div>
        )}
        <p className="dash-note" style={{ marginTop: 'auto' }}>
          {th
            ? '* ประมาณการค่าฝากจากอัตราที่ตั้งไว้และประวัติฝาก/เบิกจริง ยังไม่รวมค่าบริการอื่น และยังไม่ใช่ยอดจากใบแจ้งหนี้ที่อนุมัติ'
            : '* Storage-fee estimate from configured rates and actual deposit/withdrawal history. Excludes other service charges; not yet reconciled to approved invoices.'}
        </p>
      </div>
    </div>
  );
}
