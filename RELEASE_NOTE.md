# Release Notes — TGD WMS v1.0.0-go-live

**Release Date:** 2026-06-26

## Highlights

### Storage Aging Report
- Full expiry classification (NO_EXPIRY, EXPIRED, NEAR_EXPIRY, GOOD)
- Single source of truth: summary KPIs computed from same rows as table
- Fixed loading race when customer/product filter options load asynchronously

### Inventory Balance
- Stock shown as deposits minus completed withdrawals
- Zero-balance rows filtered from admin view
- Customer portal balance consistency with admin RPC

### Withdrawal Review
- Human-readable Thai status labels (no raw enums in UI)
- Role guards for warehouse_staff vs admin actions
- Line picking status derived from `picked_at` and document status

### Auth & Permissions
- Improved role permission cache invalidation
- Customer portal proxy customer selection (`getAdminPortalCustomerId`)

## Deployment

Production: https://tgc-wms.vercel.app

## Upgrade Notes

No breaking API changes for end users. Database `COUNT_VARIANCE` deposit review decision restored/verified.
