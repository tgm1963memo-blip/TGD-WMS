import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, FileDown, FileUp, Package, Receipt, Search } from 'lucide-react';
import { navigationGroups } from '../../app/navigation.js';
import { getNavigationItemIcon } from '../../app/navigationSections.js';
import { isNavigationGroupVisible, isNavigationItemVisible } from '../../config/navigationPresentation.js';
import { useUserRole } from '../../features/auth/UserRoleProvider.jsx';
import { useLanguage, useTranslation } from '../../i18n/languageProvider.jsx';
import {
  filterNavigationGroupsForRole,
  isInternalRole,
  isNavigationPathVisibleForRole,
} from '../../security/navigationPermissions.js';
import { MIN_SEARCH_LENGTH, searchRecords } from '../../services/globalSearchService.js';
import { Modal } from '../ui/Modal.jsx';

const DEBOUNCE_MS = 250;
const MAX_MENU_RESULTS = 8;

const TYPE_META = {
  deposit: { icon: FileDown, th: 'ใบฝาก', en: 'Deposit' },
  withdrawal: { icon: FileUp, th: 'ใบเบิก', en: 'Withdrawal' },
  lot: { icon: Package, th: 'Lot / รหัสติดตาม', en: 'Lot / tracking' },
  invoice: { icon: Receipt, th: 'ใบแจ้งหนี้', en: 'Invoice' },
  customer: { icon: Building2, th: 'ลูกค้า', en: 'Customer' },
};

const toCamelCase = (str) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

/**
 * Which record sources this role may search: internal staff only, and only
 * the sources whose page the role can open. Customer roles get menu jump
 * alone, so the box can never surface another customer's documents.
 */
export function getSearchSourcesForRole(role) {
  if (!isInternalRole(role)) return [];
  const sources = [];
  if (isNavigationPathVisibleForRole(role, '/customer/admin/deposit-review/x')) sources.push('deposit');
  if (isNavigationPathVisibleForRole(role, '/customer/admin/withdrawal-review')) sources.push('withdrawal');
  if (isNavigationPathVisibleForRole(role, '/billing/invoice-drafts/x')) sources.push('invoice');
  if (isNavigationPathVisibleForRole(role, '/master/customers')) sources.push('customer');
  return sources;
}

export function CommandPalette({ isOpen, onClose }) {
  const navigate = useNavigate();
  const t = useTranslation();
  const { language } = useLanguage();
  const { role, allowedMenuKeys } = useUserRole();
  const th = language === 'th';
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState({ data: [], failed: false, loading: false });
  const [active, setActive] = useState(0);

  const sources = useMemo(() => getSearchSourcesForRole(role), [role]);

  const menuItems = useMemo(() => filterNavigationGroupsForRole(
    navigationGroups.filter((group) => isNavigationGroupVisible(group.key)),
    role,
    allowedMenuKeys,
  ).flatMap((group) => group.items)
    .filter((item) => isNavigationItemVisible(item.key) && !item.disabled)
    .map((item) => ({
      key: item.key,
      path: item.path,
      label: t(`nav.${toCamelCase(item.key)}`) || item.label,
      altLabel: item.label,
    })), [role, allowedMenuKeys, t]);

  useEffect(() => {
    if (!isOpen) return undefined;
    setQuery('');
    setActive(0);
    setRecords({ data: [], failed: false, loading: false });
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [isOpen]);

  useEffect(() => {
    const text = query.trim();
    if (!isOpen || text.length < MIN_SEARCH_LENGTH || sources.length === 0) {
      setRecords({ data: [], failed: false, loading: false });
      return undefined;
    }
    let stale = false;
    setRecords((prev) => ({ ...prev, loading: true }));
    const id = setTimeout(() => {
      searchRecords(text, { sources }).then((result) => {
        if (!stale) setRecords({ ...result, loading: false });
      });
    }, DEBOUNCE_MS);
    return () => { stale = true; clearTimeout(id); };
  }, [query, isOpen, sources]);

  const menuMatches = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return menuItems.slice(0, MAX_MENU_RESULTS);
    return menuItems
      .filter((item) => `${item.label} ${item.altLabel}`.toLowerCase().includes(text))
      .slice(0, MAX_MENU_RESULTS);
  }, [menuItems, query]);

  const results = useMemo(() => [
    ...records.data.map((row) => ({ ...row, optionId: `${row.type}-${row.id}` })),
    ...menuMatches.map((item) => ({ type: 'menu', optionId: `menu-${item.key}`, title: item.label, path: item.path, key: item.key })),
  ], [records.data, menuMatches]);

  useEffect(() => { setActive(0); }, [results.length, query]);

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  function choose(result) {
    if (!result) return;
    onClose();
    navigate(result.path);
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[active]);
    }
  }

  const hint = sources.length
    ? (th ? 'ค้นหาเลขใบฝาก ใบเบิก Lot รหัสติดตาม ลูกค้า หรือชื่อเมนู' : 'Search documents, lots, tracking codes, customers or menus')
    : (th ? 'ค้นหาชื่อเมนู' : 'Search menus');
  const showEmpty = query.trim().length > 0 && results.length === 0 && !records.loading;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={th ? 'ค้นหา' : 'Search'} size="sm">
      <div className="cmdk" data-testid="command-palette">
        <div className="cmdk-input">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-results"
            aria-activedescendant={results[active] ? `cmdk-${results[active].optionId}` : undefined}
            aria-label={hint}
            placeholder={hint}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            data-testid="command-palette-input"
          />
        </div>

        <div role="status" className="cmdk-status">
          {records.loading ? (th ? 'กำลังค้นหา...' : 'Searching...') : null}
          {!records.loading && records.failed ? (th ? 'ค้นหาบางส่วนไม่สำเร็จ ผลลัพธ์อาจไม่ครบ ลองค้นหาอีกครั้ง' : 'Part of the search failed, so results may be incomplete. Try again.') : null}
        </div>

        <ul id="cmdk-results" role="listbox" className="cmdk-list" ref={listRef} aria-label={th ? 'ผลการค้นหา' : 'Search results'}>
          {results.map((result, index) => {
            const meta = TYPE_META[result.type];
            const Icon = meta?.icon ?? getNavigationItemIcon(result.key);
            return (
              <li
                key={result.optionId}
                id={`cmdk-${result.optionId}`}
                role="option"
                aria-selected={index === active}
                className={`cmdk-item${index === active ? ' cmdk-item--active' : ''}`}
                onMouseMove={() => setActive(index)}
                onClick={() => choose(result)}
              >
                <Icon size={16} aria-hidden="true" className="cmdk-item-icon" />
                <span className="cmdk-item-text">
                  <span className={`cmdk-item-title${meta ? ' num' : ''}`}>{result.title}</span>
                  {result.subtitle ? <span className="cmdk-item-sub">{result.subtitle}</span> : null}
                </span>
                <span className="cmdk-item-type">{meta ? meta[language] ?? meta.th : (th ? 'เมนู' : 'Menu')}</span>
              </li>
            );
          })}
        </ul>

        {showEmpty ? (
          <p className="cmdk-empty">{th ? `ไม่พบ "${query.trim()}"` : `No results for "${query.trim()}"`}</p>
        ) : null}
      </div>
    </Modal>
  );
}

export function isCommandPaletteShortcut(e) {
  return Boolean(e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && String(e.key).toLowerCase() === 'k';
}
