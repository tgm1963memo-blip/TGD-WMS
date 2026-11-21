import { useEffect, useId, useMemo, useState } from 'react';

const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TOP_CUSTOMERS = 5;
const ALL_CUSTOMERS = '';
const STORAGE_KEY_METRIC = 'tgd.dashboard.revenue.metric';

export function formatTHB(amount) {
  return `฿${Number(amount ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(value, fractionDigits) {
  return Number(value ?? 0).toLocaleString('th-TH', { minimumFractionDigits: fractionDigits, maximumFractionDigits: 2 });
}

export function formatKg(weight, language = 'th') {
  return `${formatNumber(weight, 0)} ${language === 'en' ? 'kg' : 'กก.'}`;
}

// Unit-less short form for chart axes and bar labels (the unit is shown once
// on the axis instead).
export function formatCompact(value) {
  const n = Number(value ?? 0);
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

export const formatCompactTHB = formatCompact;

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

function bahtPerKg(amount, weight) {
  return weight > 0 ? amount / weight : null;
}

/**
 * Shapes getMonthlyStorageRevenueSummary output for one customer filter and
 * one metric ('amount' in THB or 'weight' in billed kg). A customerId that
 * isn't in the data (e.g. a stale remembered choice) falls back to all.
 */
export function deriveRevenueView(data, { customerId = ALL_CUSTOMERS, metric = 'amount', language = 'th' } = {}) {
  const sourceMonths = data?.months ?? [];
  const unassigned = language === 'en' ? 'No customer' : 'ไม่ระบุลูกค้า';
  const nameOf = (c) => (c.customerId === 'UNASSIGNED' ? unassigned : c.customerName);

  const totalsById = new Map();
  for (const m of sourceMonths) {
    for (const c of m.byCustomer ?? []) {
      const entry = totalsById.get(c.customerId) ?? { customerId: c.customerId, customerName: nameOf(c), amount: 0, weight: 0 };
      entry.amount += Number(c.amount) || 0;
      entry.weight += Number(c.weight) || 0;
      totalsById.set(c.customerId, entry);
    }
  }
  const customers = [...totalsById.values()]
    .filter((c) => c.amount > 0 || c.weight > 0)
    .sort((a, b) => b.amount - a.amount);

  const effectiveCustomerId = customers.some((c) => c.customerId === customerId) ? customerId : ALL_CUSTOMERS;
  const valueOf = (row) => (metric === 'weight' ? row.weight : row.amount);

  const months = sourceMonths.map((m) => {
    const source = effectiveCustomerId
      ? (m.byCustomer ?? []).find((c) => c.customerId === effectiveCustomerId)
      : m;
    const amount = Number(source?.amount) || 0;
    const weight = Number(source?.weight) || 0;
    const byCustomer = (m.byCustomer ?? [])
      .map((c) => ({ ...c, customerName: nameOf(c), amount: Number(c.amount) || 0, weight: Number(c.weight) || 0 }))
      .map((c) => ({ ...c, value: valueOf(c) }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value);
    return { monthKey: m.monthKey, amount, weight, value: metric === 'weight' ? weight : amount, byCustomer };
  });

  const totalAmount = months.reduce((sum, m) => sum + m.amount, 0);
  const totalWeight = months.reduce((sum, m) => sum + m.weight, 0);

  return {
    months,
    customers,
    customerId: effectiveCustomerId,
    customerName: customers.find((c) => c.customerId === effectiveCustomerId)?.customerName ?? null,
    metric,
    totalAmount,
    totalWeight,
    total: metric === 'weight' ? totalWeight : totalAmount,
    isEmpty: totalAmount <= 0 && totalWeight <= 0,
  };
}

function readStored(key, fallback) {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Remembering the choice is a convenience only.
  }
}

function RevenueChart({ months, selectedKey, onSelect, language, metric }) {
  const W = 420;
  const H = 168;
  const top = 18;
  const bottom = 22;
  const left = 40;
  const chartH = H - top - bottom;
  const max = niceAxisMax(Math.max(...months.map((m) => m.value), 0));
  const y = (v) => top + chartH - (v / max) * chartH;
  const step = (W - left) / Math.max(months.length, 1);
  const barW = Math.min(40, step * 0.6);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const th = language === 'th';
  const formatValue = metric === 'weight' ? (v) => formatKg(v, language) : formatTHB;
  const unit = metric === 'weight' ? (th ? 'กก.' : 'kg') : (th ? 'บาท' : 'THB');

  const summary = months
    .map((m) => `${monthLabel(m.monthKey, language, { withYear: true })} ${formatValue(m.value)}`)
    .join(', ');
  const chartTitle = metric === 'weight'
    ? (th ? 'น้ำหนักที่คิดค่าฝากรายเดือน: ' : 'Monthly billed weight: ')
    : (th ? 'รายได้รายเดือน: ' : 'Monthly revenue: ');

  return (
    <svg
      className="dash-rev-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="group"
      aria-label={chartTitle + summary}
    >
      <text x={left - 6} y={top - 8} textAnchor="end" className="dash-rev-unit">{unit}</text>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={left} x2={W} y1={y(v)} y2={y(v)} stroke="var(--color-border)" strokeWidth="1" />
          <text x={left - 6} y={y(v) + 3} textAnchor="end">{formatCompact(v)}</text>
        </g>
      ))}
      {months.map((m, i) => {
        const x = left + i * step + (step - barW) / 2;
        const selected = m.monthKey === selectedKey;
        const partial = isCurrentMonth(m.monthKey);
        const h = Math.max(0, y(0) - y(m.value));
        const label = `${monthLabel(m.monthKey, language, { withYear: true })}: ${formatValue(m.value)}${partial ? (th ? ' (ยังไม่ครบเดือน)' : ' (month to date)') : ''}`;
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
              y={y(m.value)}
              width={barW}
              height={h}
              rx="3"
              fill={selected ? 'var(--tgd-primary-gold)' : 'var(--color-text-muted)'}
              opacity={selected ? 1 : 0.4}
              stroke={partial ? 'var(--color-gold-text)' : undefined}
              strokeDasharray={partial ? '3 3' : undefined}
            />
            <text x={x + barW / 2} y={y(m.value) - 5} textAnchor="middle" className={selected ? 'dash-rev-lbl' : undefined}>
              {formatCompact(m.value)}
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

function CustomerSplit({ month, metric, language }) {
  const th = language === 'th';
  const customers = month?.byCustomer ?? [];
  const top = customers.slice(0, TOP_CUSTOMERS);
  const rest = customers.slice(TOP_CUSTOMERS);
  const restValue = rest.reduce((sum, c) => sum + c.value, 0);
  const maxValue = Math.max(...top.map((c) => c.value), restValue, 1);
  const short = (v) => (metric === 'weight' ? `${formatCompact(v)} ${th ? 'กก.' : 'kg'}` : formatCompact(v));

  if (top.length === 0) {
    return <div className="dash-empty" style={{ padding: 0 }}>{th ? 'ไม่มีรายได้ในเดือนนี้' : 'No revenue this month.'}</div>;
  }
  return (
    <div className="dash-cust">
      {top.map((c) => (
        <div className="dash-cust-row" key={c.customerId}>
          <span title={c.customerName}>{c.customerName}</span>
          <div className="dash-bar"><i style={{ width: `${(c.value / maxValue) * 100}%` }} /></div>
          <span className="num">{short(c.value)}</span>
        </div>
      ))}
      {rest.length > 0 ? (
        <div className="dash-cust-row">
          <span>{th ? `อื่นๆ (${rest.length} ราย)` : `Others (${rest.length})`}</span>
          <div className="dash-bar"><i style={{ width: `${(restValue / maxValue) * 100}%`, background: 'var(--color-border-strong)' }} /></div>
          <span className="num">{short(restValue)}</span>
        </div>
      ) : null}
    </div>
  );
}

function CustomerMonthTable({ months, selectedKey, onSelect, language }) {
  const th = language === 'th';
  return (
    <div className="dash-rev-table-wrap">
    <table className="dash-rev-table">
      <thead>
        <tr>
          <th scope="col">{th ? 'เดือน' : 'Month'}</th>
          <th scope="col">{th ? 'บาท' : 'THB'}</th>
          <th scope="col">{th ? 'กก.' : 'kg'}</th>
          <th scope="col">{th ? '฿/กก.' : '฿/kg'}</th>
        </tr>
      </thead>
      <tbody>
        {[...months].reverse().map((m) => {
          const rate = bahtPerKg(m.amount, m.weight);
          const selected = m.monthKey === selectedKey;
          return (
            <tr key={m.monthKey} className={selected ? 'is-selected' : undefined}>
              <th scope="row">
                <button type="button" aria-pressed={selected} onClick={() => onSelect(m.monthKey)}>
                  {monthLabel(m.monthKey, language, { withYear: true })}
                </button>
              </th>
              <td>{formatNumber(m.amount, 2)}</td>
              <td>{formatNumber(m.weight, 0)}</td>
              <td>{rate == null ? '—' : rate.toFixed(2)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}

/**
 * Storage revenue overview: month bars (click to pick a month), filterable by
 * customer and switchable between THB and billed kg, plus that month's
 * customer split (or, for one customer, a month-by-month table). Data from
 * getMonthlyStorageRevenueSummary.
 */
export function RevenueOverview({ data, language = 'th' }) {
  const selectId = useId();
  // Only the unit is remembered. The customer filter resets on each visit, so
  // the next person on a shared PC never gets someone else's filtered view.
  const [customerChoice, setCustomerChoice] = useState(ALL_CUSTOMERS);
  const [metric, setMetric] = useState(() => (readStored(STORAGE_KEY_METRIC, 'amount') === 'weight' ? 'weight' : 'amount'));

  const view = useMemo(() => deriveRevenueView(data, { customerId: customerChoice, metric, language }), [data, customerChoice, metric, language]);
  const { months } = view;

  const currentKey = data?.currentMonth?.monthKey ?? months[months.length - 1]?.monthKey ?? null;
  const [selectedKey, setSelectedKey] = useState(currentKey);
  useEffect(() => { setSelectedKey(currentKey); }, [currentKey]);

  const chooseMetric = (value) => { setMetric(value); writeStored(STORAGE_KEY_METRIC, value); };

  const th = language === 'th';
  const isWeight = metric === 'weight';

  if (!months.length) {
    return (
      <div className="dash-empty">{th ? 'ยังไม่มีข้อมูลรายได้ในช่วงนี้' : 'No revenue data for this period yet.'}</div>
    );
  }

  const selectedIndex = Math.max(0, months.findIndex((m) => m.monthKey === selectedKey));
  const selected = months[selectedIndex] ?? null;
  const previous = selectedIndex > 0 ? months[selectedIndex - 1] : null;
  const selectedPartial = selected ? isCurrentMonth(selected.monthKey) : false;
  const delta = selected && previous && previous.value > 0 && !selectedPartial
    ? ((selected.value - previous.value) / previous.value) * 100
    : null;
  const selectedRate = selected ? bahtPerKg(selected.amount, selected.weight) : null;
  const formatValue = isWeight ? (v) => formatKg(v, language) : formatTHB;
  const monthName = monthLabel(selected?.monthKey, language, { withYear: true });

  const heading = isWeight
    ? (th ? `น้ำหนักที่คิดค่าฝากรายเดือน · ${months.length} เดือนล่าสุด` : `Monthly billed weight · last ${months.length} months`)
    : (th ? `รายได้ค่าฝากรายเดือน · ${months.length} เดือนล่าสุด` : `Monthly storage revenue · last ${months.length} months`);

  const secondary = isWeight
    ? formatTHB(selected?.amount)
    : `${formatKg(selected?.weight, language)}${selectedRate != null ? ` · ฿${selectedRate.toFixed(2)}/${th ? 'กก.' : 'kg'}` : ''}`;

  return (
    <div className="dash-rev">
      <div>
        <div className="dash-rev-controls">
          <div className="dash-rev-field">
            <label htmlFor={selectId}>{th ? 'ลูกค้า' : 'Customer'}</label>
            <select
              id={selectId}
              value={view.customerId}
              onChange={(e) => setCustomerChoice(e.target.value)}
              data-testid="revenue-customer-filter"
            >
              <option value={ALL_CUSTOMERS}>{th ? 'ทุกลูกค้า' : 'All customers'}</option>
              {view.customers.map((c) => (
                <option key={c.customerId} value={c.customerId}>{c.customerName}</option>
              ))}
            </select>
          </div>
          <div className="dash-rev-metric" role="group" aria-label={th ? 'หน่วยที่แสดง' : 'Show as'}>
            <button type="button" aria-pressed={!isWeight} onClick={() => chooseMetric('amount')}>{th ? 'บาท' : 'THB'}</button>
            <button type="button" aria-pressed={isWeight} onClick={() => chooseMetric('weight')}>{th ? 'กก.' : 'kg'}</button>
          </div>
        </div>
        <h4>{heading}</h4>
        {view.isEmpty ? (
          <div className="dash-empty" style={{ padding: 0 }}>
            {th ? 'ไม่มีรายได้ในช่วงนี้' : 'No revenue in this period.'}
          </div>
        ) : (
          <>
            <div className="dash-rev-big">
              <span className="dash-kpi-value" data-testid="revenue-selected-amount">{formatValue(selected?.value)}</span>
              <span className="dash-kpi-helper">
                {monthName}
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
              <span className="dash-kpi-helper dash-rev-secondary" data-testid="revenue-selected-secondary">{secondary}</span>
            </div>
            <RevenueChart months={months} selectedKey={selected?.monthKey} onSelect={setSelectedKey} language={language} metric={metric} />
          </>
        )}
        <p className="dash-note">
          {th
            ? `รวม ${months.length} เดือน ${formatValue(view.total)} · กดที่แท่งเพื่อดูรายละเอียดเดือนนั้น`
            : `${months.length}-month total ${formatValue(view.total)} · click a bar for that month's detail`}
        </p>
      </div>
      <div>
        {view.customerId ? (
          <>
            <h4>{th ? `รายเดือน · ${view.customerName}` : `By month · ${view.customerName}`}</h4>
            <CustomerMonthTable months={months} selectedKey={selected?.monthKey} onSelect={setSelectedKey} language={language} />
          </>
        ) : (
          <>
            <h4>{th ? `แยกตามลูกค้า · ${monthName}` : `By customer · ${monthName}`}</h4>
            <CustomerSplit month={selected} metric={metric} language={language} />
          </>
        )}
        <p className="dash-note" style={{ marginTop: 'auto' }}>
          {th
            ? '* ประมาณการค่าฝากจากอัตราที่ตั้งไว้และประวัติฝาก/เบิกจริง ยังไม่รวมค่าบริการอื่น และยังไม่ใช่ยอดจากใบแจ้งหนี้ที่อนุมัติ น้ำหนัก = น้ำหนักคงเหลือตอนเริ่มรอบบิลที่คิดเงินในเดือนนั้น ไม่รวมช่วงฟรี'
            : '* Storage-fee estimate from configured rates and actual deposit/withdrawal history. Excludes other service charges; not yet reconciled to approved invoices. Weight = weight on hand when each billed cycle began that month, excluding free periods.'}
        </p>
      </div>
    </div>
  );
}
