import { useEffect, useState } from 'react';
import { getCustomers } from '../../services/masterDataService.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function CustomerRequestCustomerPicker({
  value,
  onChange,
  disabled = false,
  required = true,
  testId = 'customer-request-proxy-customer-select',
}) {
  const t = useTranslation();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getCustomers().then((result) => {
      if (!active) return;
      const rows = (result.data ?? [])
        .filter((customer) => customer.is_active !== false)
        .sort((left, right) => String(left.customer_name ?? '').localeCompare(String(right.customer_name ?? '')));
      setCustomers(rows);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <label className="form-field">
      <span>
        {t('customer_request_proxy_customer_label')}
        {required ? <span className="field-required"> *</span> : null}
      </span>
      <select
        className="form-control"
        data-testid={testId}
        disabled={disabled || loading}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      >
        <option value="">{t('customer_request_proxy_customer_placeholder')}</option>
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.customer_name ?? customer.customer_code ?? customer.id}
          </option>
        ))}
      </select>
      {loading ? <span className="form-helper">{t('customer_portal_loading')}</span> : null}
    </label>
  );
}
