import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listCustomerProducts } from '../../services/customerProductCatalogService.js';

const MANUAL_VALUE = '__manual__';

export function CustomerProductPicker({
  customerId,
  value,
  onChange,
  disabled = false,
  catalogOnly = false,
  testId = 'customer-product-picker',
  manualLabel = 'Enter product manually',
  emptyLabel = 'No catalog products — enter manually below',
  catalogOnlyEmptyLabel = 'No catalog products yet',
  addProductsHint,
  addProductsLinkLabel,
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
  const hasCatalogProducts = products.length > 0;

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
      internalProductCode: product.internal_product_code || product.customer_product_code || '',
      productName: product.product_name ?? '',
      temperatureType: product.temperature_type ?? 'FROZEN',
      uom: product.uom ?? '',
    });
  }

  if (catalogOnly && !loading && !hasCatalogProducts) {
    return (
      <div className="customer-product-picker customer-product-picker--empty" data-testid={testId}>
        <div className="banner banner-warning" role="status" data-testid={`${testId}-empty-banner`}>
          <p>{catalogOnlyEmptyLabel}</p>
          {addProductsHint ? <p>{addProductsHint}</p> : null}
          <Link className="btn btn-secondary" data-testid={`${testId}-add-products-link`} to="/customer/products">
            {addProductsLinkLabel ?? 'Add products'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-product-picker" data-testid={testId}>
      <label className="form-field">
        <span>Product from catalog</span>
        <select
          className="form-control"
          data-testid={`${testId}-select`}
          disabled={disabled || loading || !customerId || (catalogOnly && !hasCatalogProducts)}
          onChange={handleSelect}
          required={catalogOnly}
          value={catalogOnly ? (isManual ? '' : selectedId) : (isManual ? MANUAL_VALUE : selectedId)}
        >
          {catalogOnly ? (
            <option disabled value="">
              {hasCatalogProducts ? 'Select a catalog product' : catalogOnlyEmptyLabel}
            </option>
          ) : (
            <option value={MANUAL_VALUE}>{manualLabel}</option>
          )}
          {!catalogOnly && products.length === 0 ? (
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

export { MANUAL_VALUE as CUSTOMER_PRODUCT_MANUAL_VALUE };
