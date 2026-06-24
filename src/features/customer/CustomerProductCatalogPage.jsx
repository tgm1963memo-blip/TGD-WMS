import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { CsvImportExportToolbar } from '../../components/customer/CsvImportExportToolbar.jsx';
import {
  deactivateCustomerProduct,
  listCustomerProducts,
  upsertCustomerProduct,
} from '../../services/customerProductCatalogService.js';
import {
  downloadCustomerProductTemplate,
  exportCustomerProductsCsv,
  normalizeCatalogBarcode,
  parseCustomerProductImportRows,
  resolveBarcodeCode,
} from '../../utils/customerProductCsvUtils.js';
import { readCsvFile } from '../../utils/csvFileUtils.js';
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

const EMPTY_FORM = {
  productId: '',
  customerProductCode: '',
  productName: '',
  barcodeCode: '',
  uom: '',
  temperatureType: 'FROZEN',
  note: '',
};

function RequiredLabel({ children }) {
  return (
    <span>
      {children}
      {' '}
      <span aria-hidden="true" className="field-required">*</span>
    </span>
  );
}

export function CustomerProductCatalogPage() {
  const t = useTranslation();
  const { customerId, canWriteCustomerRequests } = useCustomerPortalProfile();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const columns = [
    { key: 'customer_product_code', header: t('catalog_col_customer_code') },
    { key: 'product_name', header: t('catalog_col_product_name') },
    {
      key: 'barcode_code',
      header: t('catalog_col_barcode'),
      render: (row) => normalizeCatalogBarcode(row),
    },
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

  async function loadProducts() {
    if (!customerId) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const result = await listCustomerProducts({ customerId });
    if (result.error) {
      setError(result.error.message ?? t('catalog_load_error'));
      setProducts([]);
    } else {
      setProducts(result.data ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadProducts();
  }, [customerId]);

  function startCreate() {
    setForm(EMPTY_FORM);
    setSuccess('');
    setError('');
  }

  function startEdit(row) {
    setForm({
      productId: row.id,
      customerProductCode: row.customer_product_code ?? '',
      productName: row.product_name ?? '',
      barcodeCode: row.internal_product_code ?? '',
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

    if (!canWriteCustomerRequests) {
      setError(t('customer_portal_no_customer_scope'));
      return;
    }

    if (!form.customerProductCode.trim() || !form.productName.trim()) {
      setError(t('catalog_required_fields_error'));
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    const result = await upsertCustomerProduct({
      productId: form.productId || null,
      customerId,
      customerProductCode: form.customerProductCode.trim(),
      productName: form.productName.trim(),
      internalProductCode: resolveBarcodeCode(form.customerProductCode, form.barcodeCode),
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
    if (!canWriteCustomerRequests) {
      setError(t('customer_portal_no_customer_scope'));
      return;
    }

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

  async function handleImportFile(file) {
    if (!canWriteCustomerRequests) {
      setError(t('customer_portal_no_customer_scope'));
      return;
    }

    setImporting(true);
    setError('');
    setSuccess('');

    try {
      const text = await readCsvFile(file);
      const { rows, errors } = parseCustomerProductImportRows(text);

      if (errors.length) {
        setError(errors.join(' '));
        return;
      }

      if (!rows.length) {
        setError(t('csv_import_empty'));
        return;
      }

      let imported = 0;
      for (const row of rows) {
        const result = await upsertCustomerProduct({
          customerId,
          customerProductCode: row.customerProductCode,
          productName: row.productName,
          internalProductCode: row.internalProductCode,
          uom: row.uom,
          temperatureType: row.temperatureType,
          note: row.note,
          isActive: true,
        });

        if (result.error) {
          setError(result.error.message ?? t('catalog_save_error'));
          await loadProducts();
          return;
        }

        imported += 1;
      }

      setSuccess(`${imported} ${t('csv_import_success')}`);
      await loadProducts();
    } catch (importError) {
      setError(importError.message ?? t('csv_import_error'));
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-product-catalog-page">
      <PageHeader
        title={t('catalog_customer_title')}
        description={t('catalog_customer_description')}
        actions={<Link className="btn btn-secondary" to="/customer">{t('customer_portal_title')}</Link>}
      />
      <CustomerPortalLiveBanner />

      {!customerId ? (
        <div className="banner banner-warning" role="status">{t('customer_portal_no_customer_scope')}</div>
      ) : null}

      {error ? <div className="banner banner-danger" role="alert">{error}</div> : null}
      {success ? <div className="alert-success-panel" role="status">{success}</div> : null}

      <div className="table-card">
        <div className="table-card-header">
          <h3>{t('catalog_customer_list_title')}</h3>
          <CsvImportExportToolbar
            disabled={!canWriteCustomerRequests || importing}
            exportTestId="catalog-export-button"
            importTestId="catalog-import-input"
            onExport={() => exportCustomerProductsCsv(products)}
            onImportFile={handleImportFile}
            onTemplate={downloadCustomerProductTemplate}
            templateTestId="catalog-template-button"
          />
        </div>
        <DataTable
          columns={columns}
          data={products}
          emptyMessage={t('catalog_empty')}
          error={null}
          loading={loading}
          testId="catalog-customer-table"
        />
      </div>

      {canWriteCustomerRequests ? (
        <form className="form-card customer-portal-form" data-testid="catalog-customer-form" onSubmit={handleSubmit}>
          <h3>{form.productId ? t('catalog_edit_title') : t('catalog_create_title')}</h3>
          <p className="form-helper">{t('catalog_required_fields_hint')}</p>
          <div className="form-grid">
            <label className="form-field">
              <span><RequiredLabel>{t('catalog_col_customer_code')}</RequiredLabel></span>
              <input
                className="form-control"
                data-testid="catalog-customer-product-code"
                onChange={(e) => updateField('customerProductCode', e.target.value)}
                required
                value={form.customerProductCode}
              />
            </label>
            <label className="form-field">
              <span><RequiredLabel>{t('catalog_col_product_name')}</RequiredLabel></span>
              <input
                className="form-control"
                data-testid="catalog-customer-product-name"
                onChange={(e) => updateField('productName', e.target.value)}
                required
                value={form.productName}
              />
            </label>
            <label className="form-field">
              <span>{t('catalog_col_barcode')}</span>
              <input
                className="form-control"
                data-testid="catalog-customer-barcode"
                onChange={(e) => updateField('barcodeCode', e.target.value)}
                placeholder={t('catalog_barcode_placeholder')}
                value={form.barcodeCode}
              />
            </label>
            <label className="form-field">
              <span>{t('catalog_col_uom')}</span>
              <input className="form-control" onChange={(e) => updateField('uom', e.target.value)} value={form.uom} />
            </label>
            <label className="form-field">
              <span><RequiredLabel>{t('catalog_col_temperature')}</RequiredLabel></span>
              <select className="form-control" onChange={(e) => updateField('temperatureType', e.target.value)} required value={form.temperatureType}>
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
          <div className="action-row customer-portal-form-actions">
            <button className="btn btn-secondary" onClick={startCreate} type="button">{t('close')}</button>
            <button className="btn btn-primary" data-testid="catalog-customer-save-button" disabled={saving || importing} type="submit">
              {saving ? t('catalog_saving') : t('save')}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
