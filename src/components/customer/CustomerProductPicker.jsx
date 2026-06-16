import { useEffect, useState } from 'react';
import { listCustomerProducts } from '../../services/customerProductCatalogService.js';

const MANUAL_VALUE = '__manual__';

export function CustomerProductPicker({
  customerId,
  value,
  onChange,
  disabled = false,
  testId = 'customer-product-picker',
  manualLabel = 'Enter product manually',
  emptyLabel = 'No catalog products — enter manually below',
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    if (!customerId) {
      setProducts([]);
      return undefined;
    }

    setLoading(true);
    listCustomerProducts({ customerId, activeOnly: true }).then((result) => {
      if (!active) return;
      setProducts(result.data ?? []);
      setError(result.error ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [customerId]);

  const selectedId = value?.catalogProductId ?? '';
  const isManual = !selectedId || selectedId === MANUAL_VALUE;

  function handleSelect(event) {
    const nextId = event.target.value;
    if (!nextId || nextId === MANUAL_VALUE) {
      onChange({
        catalogProductId: MANUAL_VALUE,
        customerProductCode: value?.customerProductCode ?? '',
        internalProductCode: value?.internalProductCode ?? '',
        productName: value?.productName ?? '',
        temperatureType: value?.temperatureType ?? 'FROZEN',
        uom: value?.uom ?? '',
      });
      return;
    }

    const product = products.find((row) => row.id === nextId);
    if (!product) return;

    onChange({
      catalogProductId: product.id,
      customerProductCode: product.customer_product_code ?? '',
      internalProductCode: product.internal_product_code ?? '',
      productName: product.product_name ?? '',
      temperatureType: product.temperature_type ?? 'FROZEN',
      uom: product.uom ?? '',
    });
  }

  return (
    <div className="customer-product-picker" data-testid={testId}>
      <label className="form-field">
        <span>Product from catalog</span>
        <select
          className="form-control"
          data-testid={`${testId}-select`}
          disabled={disabled || loading || !customerId}
          onChange={handleSelect}
          value={isManual ? MANUAL_VALUE : selectedId}
        >
          <option value={MANUAL_VALUE}>{manualLabel}</option>
          {products.length === 0 ? (
            <option disabled value="">
              {emptyLabel}
            </option>
          ) : null}
          {products.map((row) => (
            <option key={row.id} value={row.id}>
              {row.customer_product_code} — {row.product_name}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="form-hint form-hint-danger">{error.message}</p> : null}
      {!isManual && value?.productName ? (
        <p className="form-hint" data-testid={`${testId}-summary`}>
          Selected: {value.customerProductCode} / {value.productName}
        </p>
      ) : null}
    </div>
  );
}
