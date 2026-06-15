# CUSTOMER-PORTAL-2F UI Real Data Switch

## 1. Scope

Gate 2F switches customer-facing portal pages from `customerPortalDemoData.js` to live Supabase reads and controlled RPC writes.

Applied prerequisites on UAT:

- Migrations 040, 041, 042, 043
- Migration 044 create/edit RPC hardening

## 2. Service layer

| Service | Responsibility |
| --- | --- |
| `customerDepositRequestService.js` | List/read deposits, create/update draft, upsert/delete lines, submit/review/cancel RPC |
| `customerWithdrawalRequestService.js` | List/read withdrawals, create/update draft, upsert/delete lines, submit/review/cancel RPC |
| `customerDocumentTimelineService.js` | Read timeline events |
| `customerPortalDashboardService.js` | KPI summary from live requests + stock |
| `customerPortalRequestHistoryService.js` | Combined deposit/withdrawal history |
| `customerPortalServiceUtils.js` | Shared RPC payload helpers and role constants |

## 3. UI pages switched to live data

| Page | Mode |
| --- | --- |
| `CustomerPortalDashboardPage` | Live |
| `CustomerDepositRequestPage` | Live RPC draft create + line upsert |
| `CustomerWithdrawalRequestPage` | Live RPC draft create + line upsert |
| `CustomerStockBalancePage` | Live `tgd_stock_balances` via customer scope |
| `CustomerRequestHistoryPage` | Live headers + timeline |
| `CustomerAdminDepositReviewPage` | Live read + review RPC |
| `CustomerAdminWithdrawalReviewPage` | Live read + review RPC |

Warehouse execution preview pages remain demo-only:

- `CustomerWarehouseReceivingDemoPage`
- `CustomerWarehousePickingLoadingDemoPage`
- `CustomerAdminReceivingVerificationPage`

## 4. Write boundary

Customer writes use RPC only:

- Create draft: `tgd_create_customer_*`
- Line edit: `tgd_upsert_customer_*_line`
- Submit: `tgd_submit_customer_*` (available in services; UI may add submit button in later polish)
- Admin review: `tgd_review_customer_*`

No stock movement, receiving post, picking, dispatch, storage upload, email, or billing export is triggered from 2F.

## 5. Role requirements

- Customer create/edit: `customer_admin` or `customer_user` with non-null `customer_id`
- Admin review: `admin` or `accounting`
- Navigation visibility updated to include `customer_admin` / `customer_user`

## 6. Deferred to later gates

| Gate | Item |
| --- | --- |
| 2G | Storage bucket, attachment upload, email notification |
| 2H | Handheld/barcode execution linkage |
| 3B-5 | Bplus export execute (blocked) |
| Execution linkage | Portal deposit → internal receiving spawn |

## 7. Known limitations

- Attachment picker remains browser-only until Storage gate
- Stock balance table shows IDs until product/lot enrichment is added
- Login smoke still requires approved customer credentials on UAT
- Submit-to-customer workflow button not yet exposed on every form (draft save is live)

## 8. Test plan

- `tests/unit/customer-portal-2f-real-data.test.js` — service/doc static checks
- `tests/unit/customer-portal-demo.test.jsx` — live UI flows with mocked services
- Full suite: `npm test -- --run`
- Build: `npm run build`

## 9. UAT verification checklist (user confirmation)

1. Login as `admin.demo@tgd-wms.local` (customer_admin + Demo Customer Alpha)
2. Create deposit draft and confirm `CDR-*` row appears in request history
3. Create withdrawal draft and confirm `CWR-*` row appears
4. Login as `accounting.demo@tgd-wms.local` and review submitted requests
5. Confirm stock movement count unchanged
6. Confirm no file upload/email/export side effects
