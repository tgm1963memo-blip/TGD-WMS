import { useTableSort } from '../../hooks/useTableSort.js';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { listCustomerPortalRequestHistory } from '../../services/customerPortalRequestHistoryService.js';
import { listCustomerDocumentTimelineEvents } from '../../services/customerDocumentTimelineService.js';
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

const REQUEST_TYPE_OPTIONS = ['ALL', 'DEPOSIT', 'WITHDRAWAL'];
const STATUS_OPTIONS = [
  'ALL',
  'DRAFT',
  'WITHDRAWAL_DRAFT',
  'SUBMITTED_BY_CUSTOMER',
  'ADMIN_REVIEWING',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
];

function statusBadgeClass(status) {
  if (status === 'DRAFT' || status === 'WITHDRAWAL_DRAFT') return 'draft';
  if (status === 'SUBMITTED_BY_CUSTOMER' || status === 'ADMIN_REVIEWING') return 'open';
  return 'hold';
}

function RequestTimelineCell({ documentType, documentId }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let active = true;
    if (!documentId) return undefined;

    listCustomerDocumentTimelineEvents(documentType, documentId).then((result) => {
      if (!active) return;
      setEvents(result.data ?? []);
    });

    return () => {
      active = false;
    };
  }, [documentId, documentType]);

  if (!events.length) {
    return <span>-</span>;
  }

  return (
    <ol className="customer-request-mini-timeline" data-testid="customer-request-status-timeline">
      {events.map((event) => (
        <li key={event.id}>{event.action} ({event.to_status ?? event.from_status ?? '-'})</li>
      ))}
    </ol>
  );
}

function filterRequestHistoryRows(rows = [], filters = {}) {
  const search = String(filters.search ?? '').trim().toLowerCase();

  return rows.filter((row) => {
    if (filters.requestType && filters.requestType !== 'ALL' && row.request_type !== filters.requestType) {
      return false;
    }

    if (filters.status && filters.status !== 'ALL' && row.status !== filters.status) {
      return false;
    }

    if (filters.dateFrom && row.requested_date && row.requested_date < filters.dateFrom) {
      return false;
    }

    if (filters.dateTo && row.requested_date && row.requested_date > filters.dateTo) {
      return false;
    }

    if (search) {
      const haystack = [
        row.request_no,
        row.request_type,
        row.status,
        row.note,
        row.latest_action_note,
      ].join(' ').toLowerCase();

      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}

function getRequestDetailPath(row) {
  if (!row?.id) return null;
  return row.request_type === 'WITHDRAWAL'
    ? `/customer/withdrawal-request/${row.id}`
    : `/customer/deposit-request/${row.id}`;
}

export function CustomerRequestHistoryPage() {
  const t = useTranslation();
  const { customerId, loading: profileLoading } = useCustomerPortalProfile();
  const [state, setState] = useState({ rows: [], loading: true, error: null });
  const { sortedData, requestSort, getSortIndicator } = useTableSort(state.rows);
  const [filters, setFilters] = useState({
    search: '',
    requestType: 'ALL',
    status: 'ALL',
    dateFrom: '',
    dateTo: '',
  });

  useEffect(() => {
    let active = true;

    if (profileLoading) return undefined;

    if (!customerId) {
      setState({ rows: [], loading: false, error: null });
      return undefined;
    }

    setState((current) => ({ ...current, loading: true, error: null }));

    listCustomerPortalRequestHistory(customerId).then((result) => {
      if (!active) return;
      setState({
        rows: result.data ?? [],
        loading: false,
        error: result.error ?? null,
      });
    });

    return () => {
      active = false;
    };
  }, [customerId, profileLoading]);

  const filteredRows = useMemo(
    () => filterRequestHistoryRows(sortedData, filters),
    [sortedData, filters],
  );

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function resetFilters() {
    setFilters({
      search: '',
      requestType: 'ALL',
      status: 'ALL',
      dateFrom: '',
      dateTo: '',
    });
  }

  if (profileLoading || state.loading) {
    return (
      <section className="page-shell customer-portal-page" data-testid="customer-request-history-page">
        <LoadingState message={t('customer_portal_loading')} />
      </section>
    );
  }

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-request-history-page">
      <PageHeader title={t('customer_request_history_title')} description={t('customer_request_history_description')} />
      <CustomerPortalLiveBanner />

      {!customerId ? (
        <div className="banner banner-warning" role="status">{t('customer_portal_no_customer_scope')}</div>
      ) : null}

      {state.error ? (
        <div className="banner banner-danger" role="alert">{state.error.message ?? t('customer_portal_load_error')}</div>
      ) : null}

      <div className="table-card">
        <div className="table-card-header">
          <h3>{t('customer_request_history_table_title')}</h3>
          <span className="status-badge status-badge--open">{t('customer_live_data_badge')}</span>
        </div>

        <div className="customer-history-filter-panel" data-testid="customer-request-history-filters">
          <div className="form-grid">
            <label className="form-field">
              <span>{t('customer_history_search')}</span>
              <input
                className="form-control"
                data-testid="customer-history-search-input"
                onChange={(event) => updateFilter('search', event.target.value)}
                placeholder={t('customer_history_search_placeholder')}
                value={filters.search}
              />
            </label>
            <label className="form-field">
              <span>{t('customer_col_request_type')}</span>
              <select
                className="form-control"
                data-testid="customer-history-type-filter"
                onChange={(event) => updateFilter('requestType', event.target.value)}
                value={filters.requestType}
              >
                {REQUEST_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option === 'ALL' ? t('filter_all') : option}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>{t('customer_col_status')}</span>
              <select
                className="form-control"
                data-testid="customer-history-status-filter"
                onChange={(event) => updateFilter('status', event.target.value)}
                value={filters.status}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option === 'ALL' ? t('filter_all') : option}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>{t('customer_history_date_from')}</span>
              <input
                className="form-control"
                data-testid="customer-history-date-from"
                onChange={(event) => updateFilter('dateFrom', event.target.value)}
                type="date"
                value={filters.dateFrom}
              />
            </label>
            <label className="form-field">
              <span>{t('customer_history_date_to')}</span>
              <input
                className="form-control"
                data-testid="customer-history-date-to"
                onChange={(event) => updateFilter('dateTo', event.target.value)}
                type="date"
                value={filters.dateTo}
              />
            </label>
          </div>
          <div className="action-row">
            <button className="btn btn-secondary" data-testid="customer-history-reset-filters" onClick={resetFilters} type="button">
              {t('filter_reset')}
            </button>
            <span className="form-helper" data-testid="customer-history-filter-count">
              {filteredRows.length} / {sortedData.length} {t('customer_history_results_label')}
            </span>
          </div>
        </div>

        <div className="responsive-table">
          <table className="data-table" data-testid="customer-request-history-table">
            <thead>
              <tr>
                <th onClick={() => requestSort('request_no')} style={{ cursor: 'pointer' }}>{t('customer_col_request_no')} {getSortIndicator('request_no')}</th>
                <th>{t('customer_col_request_type')}</th>
                <th onClick={() => requestSort('status')} style={{ cursor: 'pointer' }}>{t('customer_col_status')} {getSortIndicator('status')}</th>
                <th>{t('customer_col_requested_date')}</th>
                <th onClick={() => requestSort('note')} style={{ cursor: 'pointer' }}>{t('customer_col_note')} {getSortIndicator('note')}</th>
                <th onClick={() => requestSort('updated_at')} style={{ cursor: 'pointer' }}>{t('customer_history_latest_action')} {getSortIndicator('updated_at')}</th>
                <th>{t('customer_history_status_timeline')}</th>
                <th>{t('catalog_col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length ? filteredRows.map((row) => (
                <tr key={`${row.request_type}-${row.request_no}`}>
                  <td>{row.request_no}</td>
                  <td>{row.request_type}</td>
                  <td><span className={`status-badge status-badge--${statusBadgeClass(row.status)}`}>{row.status}</span></td>
                  <td>{row.requested_date}</td>
                  <td>{row.note || '-'}</td>
                  <td>
                    {row.latest_action_note}
                    <br />
                    <small>{row.last_updated_at ? new Date(row.last_updated_at).toLocaleString() : '-'}</small>
                  </td>
                  <td>
                    <RequestTimelineCell documentId={row.id} documentType={row.document_type} />
                  </td>
                  <td>
                    {getRequestDetailPath(row) ? (
                      <Link className="btn btn-secondary btn-sm" to={getRequestDetailPath(row)}>
                        {t('customer_request_view_button')}
                      </Link>
                    ) : '-'}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8}>{t('customer_history_no_results')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
