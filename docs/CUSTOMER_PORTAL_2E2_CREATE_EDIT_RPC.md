# CUSTOMER-PORTAL-2E-2 Create/Edit Draft and Line RPC Hardening

## 1. Why 2E-2 is needed

Migration 043 moved header status transitions and timeline appends behind six
validated RPCs. It intentionally left draft header creation and line editing on
direct authenticated table writes so the Customer Portal UI could remain in demo
mode without a half-controlled write path.

Gate 2E-2 closes that gap before the UI switches to real data. After 044 is
applied, customers create and edit drafts only through RPC contracts that enforce
active profile, role, customer scope, draft status, row locking, and timeline
audit in one transaction.

## 2. Prerequisites

- Migration 040 customer portal source-document schema
- Migration 041 customer roles and source links
- Migration 042 UAT foundation remediation (`set_updated_at`, picking shell)
- Migration 043 transition RPC hardening (applied on UAT)

Migration 044 is a **draft**. Do not apply to UAT without Controller approval.

## 3. RPC list

| RPC | Allowed role | Parent status | Purpose |
| --- | --- | --- | --- |
| `tgd_create_customer_deposit_request` | customer_admin, customer_user | n/a (creates DRAFT) | Create deposit draft header |
| `tgd_update_customer_deposit_request_draft` | customer_admin, customer_user | DRAFT | Update deposit draft header fields |
| `tgd_upsert_customer_deposit_request_line` | customer_admin, customer_user | DRAFT | Insert or update deposit line by id or line_no |
| `tgd_delete_customer_deposit_request_line` | customer_admin, customer_user | DRAFT | Narrow hard-delete of one deposit line |
| `tgd_create_customer_withdrawal_request` | customer_admin, customer_user | n/a (creates WITHDRAWAL_DRAFT) | Create withdrawal draft header |
| `tgd_update_customer_withdrawal_request_draft` | customer_admin, customer_user | WITHDRAWAL_DRAFT | Update withdrawal draft header fields |
| `tgd_upsert_customer_withdrawal_request_line` | customer_admin, customer_user | WITHDRAWAL_DRAFT | Insert or update withdrawal line |
| `tgd_delete_customer_withdrawal_request_line` | customer_admin, customer_user | WITHDRAWAL_DRAFT | Narrow hard-delete of one withdrawal line |

All eight functions use `SECURITY DEFINER`, `search_path = public`, `auth.uid()`,
active profile validation, customer role validation, customer scope validation,
`FOR UPDATE` on the parent header for update/upsert/delete flows, timeline
insert, and `GRANT EXECUTE` to `authenticated` only.

Numbering:

- Deposit: `CDR-YYYYMMDD-NNNN`
- Withdrawal: `CWR-YYYYMMDD-NNNN`

`created_by_display_name` is stored as `NULL` because `tgd_user_profiles` has no
`display_name` column on UAT.

## 4. Draft-only rule

Header create RPCs always insert with status `DRAFT` or `WITHDRAWAL_DRAFT`.
Update and line RPCs reject any parent that is not in the matching draft status.
No RPC in this gate changes status beyond draft creation.

## 5. Line-edit rule

Line upsert RPCs:

- Lock the parent header with `FOR UPDATE`
- Allow insert when `p_line_id` is null (auto `line_no` when omitted)
- Allow update when `p_line_id` matches the parent scope
- Write a timeline event with `INSERT_LINE`, `UPDATE_LINE`, or `DELETE_LINE`
- Include `metadata_json` with `line_id`, `line_no`, and `picking_rule` where relevant

Withdrawal line upsert validates `picking_rule` as one of:

- `FEFO`
- `SPECIFIC_DEPOSIT`
- `SPECIFIC_LOT`

No allocation, stock lookup, picking, or dispatch is performed.

## 6. Direct-write exposure before 044 (UAT post-043)

Repository and UAT review after migration 043:

| Table | authenticated INSERT | authenticated UPDATE | Notes |
| --- | --- | --- | --- |
| `tgd_customer_deposit_requests` | Yes (043 draft-only policy) | No (043 revoked) | admin/accounting and customer roles |
| `tgd_customer_deposit_request_lines` | Yes (parent DRAFT) | Yes (parent DRAFT) | customer + admin/accounting |
| `tgd_customer_withdrawal_requests` | Yes (043 draft-only policy) | No (043 revoked) | admin/accounting and customer roles |
| `tgd_customer_withdrawal_request_lines` | Yes (parent WITHDRAWAL_DRAFT) | No (043 revoked + no policy) | insert only |
| `tgd_customer_document_timeline_events` | No (043 revoked) | Privilege may exist | no INSERT policy; RPC-only append |

### Who can direct-write today

1. **Header INSERT:** `authenticated` users passing 043 policies — customer roles
   for own customer draft headers; `admin`/`accounting` for any customer draft header.
2. **Deposit line INSERT/UPDATE:** customer roles on own DRAFT parents;
   `admin`/`accounting` on any DRAFT parent.
3. **Withdrawal line INSERT:** customer roles on own WITHDRAWAL_DRAFT parents;
   `admin`/`accounting` on any WITHDRAWAL_DRAFT parent.
4. **Withdrawal line UPDATE:** blocked at privilege level since 043.
5. **Timeline INSERT:** blocked since 043.

## 7. Direct-write revoke plan (migration 044)

After the create/edit RPCs exist, 044:

- Drops temporary INSERT/UPDATE RLS policies on deposit headers, withdrawal headers,
  deposit lines, and withdrawal lines
- Revokes `INSERT` on deposit and withdrawal headers from `anon`, `authenticated`
- Revokes `INSERT` and `UPDATE` on deposit lines from `anon`, `authenticated`
- Revokes `INSERT` on withdrawal lines from `anon`, `authenticated`
- Keeps `SELECT` policies from 040
- Keeps `DELETE` revoked on all customer portal tables from 040
- Keeps timeline INSERT revoked from 043; RPCs write timeline as `SECURITY DEFINER`

### Remaining exposure after 044

| Path | Status | Reason / risk |
| --- | --- | --- |
| Header direct INSERT/UPDATE | Revoked | Covered by create/update RPCs |
| Deposit line direct INSERT/UPDATE | Revoked | Covered by upsert/delete RPCs |
| Withdrawal line direct INSERT | Revoked | Covered by upsert/delete RPCs |
| Withdrawal line direct UPDATE | Already revoked in 043 | Covered by upsert RPC |
| Timeline direct INSERT | Already revoked in 043 | Unchanged |
| Attachment metadata INSERT | Still available from 040 | Storage gate deferred; no bucket/upload in this gate |
| Admin/accounting draft create via direct SQL | Revoked with customers | Admin backfill must use service workflow or later internal RPC gate |

Unit tests assert the revoke statements and document attachment exposure above.

## 8. Role and scope validation

Every RPC:

- Requires `auth.uid()` and `tgd_current_user_is_active()`
- Loads the active `tgd_user_profiles` row
- Restricts mutation to `customer_admin` or `customer_user`
- Rejects `customer_id IS NULL` on the profile
- Compares `v_profile.customer_id` to the parent document `customer_id`
- Uses `FOR UPDATE` before parent or line mutation on update/upsert/delete flows

Customer `customer_id` always comes from the current profile on create; clients
cannot supply a foreign customer id on create.

## 9. Timeline audit behavior

Each successful RPC appends one `tgd_customer_document_timeline_events` row in the
same transaction:

| RPC action | Timeline `action` |
| --- | --- |
| Create deposit/withdrawal draft | `CREATE_DRAFT` |
| Update draft header | `UPDATE_DRAFT` |
| Insert line | `INSERT_LINE` |
| Update line | `UPDATE_LINE` |
| Delete line | `DELETE_LINE` |

Events capture document type/id, customer, from/to status, actor profile fields,
optional comment, and line metadata where applicable.

## 10. What remains blocked

- Stock balance or inventory movement changes
- Receiving, picking, withdrawal execution, or dispatch creation/confirmation
- Allocation against live stock
- File bucket creation or file upload
- Email sending
- Bplus export execution and Gate 3B-5
- Mark BILLED / Bplus Invoice No workflow
- Auth user, password, or profile bulk update changes
- `service_role` in frontend/client code

Known limitation: no storage integration, no stock movement, and no execution
document linkage in this gate.

## 11. UAT apply plan

1. Obtain Controller approval for migration 044 checksum/diff.
2. Capture UAT grants and policies immediately before apply.
3. Apply only to UAT (`tgd-wms-staging`) in one transaction.
4. Verify eight function signatures, `prosecdef`, `search_path`, and grants.
5. Verify direct header/line INSERT and deposit line UPDATE are denied to
   `authenticated` clients.
6. Smoke create draft, update draft, upsert line, delete line with approved
   customer credentials (`admin.demo` profile).
7. Confirm timeline rows append atomically and no stock movement rows change.
8. Record evidence; do not promote beyond UAT in this gate.

## 12. Test plan

### Static (this gate)

- `tests/unit/customer-portal-2e2-create-edit-rpc.test.js`
- Full suite: `npm test -- --run`
- Build: `npm run build`

### After apply approval

- Integration tests for allowed/denied role, customer mismatch, non-draft parent,
  concurrent parent lock, invalid `picking_rule`, and timeline atomicity
- Customer login smoke with approved credentials
- UI real-data switch only after RPC path is verified

## 13. Narrow line delete approval

`tgd_delete_customer_deposit_request_line` and
`tgd_delete_customer_withdrawal_request_line` perform a scoped
`DELETE FROM ... WHERE id = p_line_id AND parent_id = v_document.id` only while
the parent remains in draft status. This is approved for Gate 2E-2 because line
tables have no soft-delete column and parent `DELETE` remains blocked from clients.
