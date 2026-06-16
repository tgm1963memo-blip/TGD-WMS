import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { getCustomers } from '../../services/masterDataService.js';
import { getCurrentUserProfile } from '../../services/userProfileService.js';
import {
  deactivateCustomerProduct,
  listCustomerProducts,
  upsertCustomerProduct,
} from '../../services/customerProductCatalogService.js';
import { canWriteCustomerCatalog } from '../../security/userManagementPermissions.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

const EMPTY_FORM = {
  productId: '',
  customerId: '',
  customerProductCode: '',
  productName: '',
  internalProductCode: '',
  uom: '',
  temperatureType: 'FROZEN',
  note: '',
};

export function CustomerProductCatalogAdminPage() {
  const t = useTranslation();
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [canWrite, setCanWrite] = useState(false);

  const customerMap = useMemo(
    () => Object.fromEntries(customers.map((row) => [row.id, `${row.customer_code} — ${row.customer_name}`])),
    [customers],
  );

  const columns = [
    {
      key: 'customer_id',
      header: t('catalog_col_customer'),
      render: (row) => customerMap[row.customer_id] ?? row.customer_id,
    },
    { key: 'customer_product_code', header: t('catalog_col_customer_code') },
    { key: 'product_name', header: t('catalog_col_product_name') },
    { key: 'internal_product_code', header: t('catalog_col_internal_code') },
    { key: 'uom', header: t('catalog_col_uom') },
    { key: 'temperature_type', header: t('catalog_col_temperature') },
    { key: 'is_active', header: t('catalog_col_status'), render: (row) => <StatusBadge value={row.is_active} /> },
    {
      key: 'actions',
      header: t('catalog_col_actions'),
      render: (row) => (
        <div className="action-row">
          <button className="btn btn-secondary btn-sm" onClick={() => startEdit(row)} type="button">{t('edit')}</button>
          {row.is_active ? (
            <button className="btn btn-secondary btn-sm" disabled={saving} onClick={() => handleDeactivate(row.id)} type="button">
              {t('catalog_deactivate')}
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  async function loadProducts(customerId = filterCustomerId) {
    setLoading(true);
    setError('');

    const filters = {};
    if (customerId) filters.customerId = customerId;

    const result = await listCustomerProducts(filters);
    if (result.error) {
      setError(result.error.message ?? t('catalog_load_error'));
      setProducts([]);
    } else {
      setProducts(result.data ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    let active = true;

    Promise.all([getCurrentUserProfile(), getCustomers()]).then(([profileResult, customerResult]) => {
      if (!active) return;
      setCanWrite(canWriteCustomerCatalog(profileResult.data?.role ?? ''));
      setCustomers(customerResult.data ?? []);
    });

    loadProducts();

    return () => {
      active = false;
    };
  }, []);

  function startCreate() {
    setForm({ ...EMPTY_FORM, customerId: filterCustomerId });
    setSuccess('');
    setError('');
  }

  function startEdit(row) {
    setForm({
      productId: row.id,
      customerId: row.customer_id,
      customerProductCode: row.customer_product_code ?? '',
      productName: row.product_name ?? '',
      internalProductCode: row.internal_product_code ?? '',
      uom: row.uom ?? '',
      temperatureType: row.temperature_type ?? 'FROZEN',
      note: row.note ?? '',
    });
    setSuccess('');
    setError('');
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setSuccess('');
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const result = await upsertCustomerProduct({
      productId: form.productId || null,
      customerId: form.customerId || null,
      customerProductCode: form.customerProductCode,
      productName: form.productName,
      internalProductCode: form.internalProductCode,
      uom: form.uom,
      temperatureType: form.temperatureType,
      note: form.note,
      isActive: true,
    });

    setSaving(false);

    if (result.error) {
      setError(result.error.message ?? t('catalog_save_error'));
      return;
    }

    setSuccess(t('catalog_save_success'));
    setForm(EMPTY_FORM);
    await loadProducts();
  }

  async function handleDeactivate(productId) {
    setSaving(true);
    setError('');
    setSuccess('');

    const result = await deactivateCustomerProduct(productId);
    setSaving(false);

    if (result.error) {
      setError(result.error.message ?? t('catalog_save_error'));
      return;
    }

    setSuccess(t('catalog_deactivate_success'));
    await loadProducts();
  }

  if (!loading && !canWrite) {
    return (
      <section className="page-shell" data-testid="customer-product-catalog-admin-page">
        <PageHeader title={t('catalog_admin_title')} description={t('catalog_admin_description')} />
        <div className="banner banner-warning" role="status">{t('catalog_admin_only')}</div>
      </section>
    );
  }

  return (
    <section className="page-shell" data-testid="customer-product-catalog-admin-page">
      <PageHeader
        title={t('catalog_admin_title')}
        description={t('catalog_admin_description')}
        actions={(
          <button className="btn btn-primary" data-testid="catalog-admin-create-button" onClick={startCreate} type="button">
            {t('catalog_create')}
          </button>
        )}
      />

      <div className="form-grid filter-row">
        <label className="form-field">
          <span>{t('catalog_filter_customer')}</span>
          <select
            className="form-control"
            data-testid="catalog-admin-customer-filter"
            onChange={(e) => {
              setFilterCustomerId(e.target.value);
              loadProducts(e.target.value);
            }}
            value={filterCustomerId}
          >
            <option value="">{t('catalog_all_customers')}</option>
            {customers.map((row) => (
              <option key={row.id} value={row.id}>{row.customer_code} — {row.customer_name}</option>
            ))}
          </select>
        </label>
      </div>

      {error ? <div className="banner banner-danger" role="alert">{error}</div> : null}
      {success ? <div className="alert-success-panel" role="status">{success}</div> : null}

      <form className="form-card" data-testid="catalog-admin-form" onSubmit={handleSubmit}>
        <h3>{form.productId ? t('catalog_edit_title') : t('catalog_create_title')}</h3>
        <div className="form-grid">
          <label className="form-field">
            <span>{t('catalog_col_customer')}</span>
            <select
              className="form-control"
              data-testid="catalog-admin-customer"
              onChange={(e) => updateField('customerId', e.target.value)}
              required
              value={form.customerId}
            >
              <option value="">{t('user_mgmt_select_customer')}</option>
              {customers.map((row) => (
                <option key={row.id} value={row.id}>{row.customer_code} — {row.customer_name}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>{t('catalog_col_customer_code')}</span>
            <input
              className="form-control"
              data-testid="catalog-admin-product-code"
              onChange={(e) => updateField('customerProductCode', e.target.value)}
              required
              value={form.customerProductCode}
            />
          </label>
          <label className="form-field">
            <span>{t('catalog_col_product_name')}</span>
            <input
              className="form-control"
              data-testid="catalog-admin-product-name"
              onChange={(e) => updateField('productName', e.target.value)}
              required
              value={form.productName}
            />
          </label>
          <label className="form-field">
            <span>{t('catalog_col_internal_code')}</span>
            <input
              className="form-control"
              onChange={(e) => updateField('internalProductCode', e.target.value)}
              value={form.internalProductCode}
            />
          </label>
          <label className="form-field">
            <span>{t('catalog_col_uom')}</span>
            <input className="form-control" onChange={(e) => updateField('uom', e.target.value)} value={form.uom} />
          </label>
          <label className="form-field">
            <span>{t('catalog_col_temperature')}</span>
            <select className="form-control" onChange={(e) => updateField('temperatureType', e.target.value)} value={form.temperatureType}>
              <option value="FROZEN">FROZEN</option>
              <option value="CHILLED">CHILLED</option>
              <option value="AMBIENT">AMBIENT</option>
            </select>
          </label>
          <label className="form-field form-field-span-2">
            <span>{t('catalog_col_note')}</span>
            <textarea className="form-control" onChange={(e) => updateField('note', e.target.value)} rows={2} value={form.note} />
          </label>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={startCreate} type="button">{t('close')}</button>
          <button className="btn btn-primary" data-testid="catalog-admin-save-button" disabled={saving} type="submit">
            {saving ? t('catalog_saving') : t('save')}
          </button>
        </div>
      </form>

      <DataTable
        columns={columns}
        data={products}
        emptyMessage={t('catalog_empty')}
        error={null}
        loading={loading}
        testId="catalog-admin-table"
      />
    </section>
  );
}
