# CUSTOMER-PORTAL-2E RPC Hardening

## 1. Current 040/041 readiness

Migrations 040 and 041 provide the customer deposit/withdrawal source-document
tables, line tables, timeline, attachment metadata, customer roles, and nullable
links to later warehouse execution documents. The approved UAT remediation 042
supplies missing foundation objects. Migration 043 remains a review draft and is
not applied by this task.

The repository review cannot prove the effective UAT ACL independently of a
database privilege query. It can prove that migration 040 defines authenticated
INSERT/UPDATE RLS policies, so any matching table grants expose those write paths.

## 2. Why RPC hardening is required

Migration 040 allows clients that pass RLS to update header status fields and to
insert timeline events directly. That permits clients to bypass a single,
locked transition contract and potentially forge audit attributes. Customer line
policies also allow changes while a request is already submitted.

Migration 043 moves header transitions and timeline appends behind validated
functions before a real customer write workflow is enabled.

## 3. RPC list

| RPC | Allowed role | Purpose |
| --- | --- | --- |
| `tgd_submit_customer_deposit_request` | customer_admin, customer_user | Submit own deposit draft |
| `tgd_review_customer_deposit_request` | admin, accounting | Start review, accept, or reject |
| `tgd_cancel_customer_deposit_request` | customer roles in own scope; admin/accounting | Cancel an allowed non-terminal request |
| `tgd_submit_customer_withdrawal_request` | customer_admin, customer_user | Submit own withdrawal draft |
| `tgd_review_customer_withdrawal_request` | admin, accounting | Start review, accept, or reject |
| `tgd_cancel_customer_withdrawal_request` | customer roles in own scope; admin/accounting | Cancel an allowed non-terminal request |

All six functions use `SECURITY DEFINER`, `search_path = public`, `auth.uid()`,
an active profile check, role validation, `FOR UPDATE`, an exact ID update, and a
timeline insert. Execute is revoked from `PUBLIC`/`anon` and granted only to
`authenticated`.

## 4. Status transition matrix

| Document | From | Action | To |
| --- | --- | --- | --- |
| Deposit | DRAFT | SUBMIT | SUBMITTED_BY_CUSTOMER |
| Deposit | SUBMITTED_BY_CUSTOMER | REVIEWING | ADMIN_REVIEWING |
| Deposit | ADMIN_REVIEWING | ACCEPT | ADMIN_ACCEPTED |
| Deposit | ADMIN_REVIEWING | REJECT | ADMIN_REJECTED |
| Deposit | DRAFT, SUBMITTED_BY_CUSTOMER | customer CANCEL | CANCELLED |
| Deposit | non-terminal | admin/accounting CANCEL | CANCELLED |
| Withdrawal | WITHDRAWAL_DRAFT | SUBMIT | SUBMITTED_BY_CUSTOMER |
| Withdrawal | SUBMITTED_BY_CUSTOMER | REVIEWING | ADMIN_REVIEWING |
| Withdrawal | ADMIN_REVIEWING | ACCEPT | ADMIN_ACCEPTED |
| Withdrawal | ADMIN_REVIEWING | REJECT | ADMIN_REJECTED |
| Withdrawal | WITHDRAWAL_DRAFT, SUBMITTED_BY_CUSTOMER | customer CANCEL | CANCELLED |
| Withdrawal | non-terminal | admin/accounting CANCEL | CANCELLED |

For this gate, terminal cancellation states are `ADMIN_REJECTED`, `CLOSED`, and
`CANCELLED`. Later business gates should confirm whether operational completion
statuses need an additional cancellation prohibition.

## 5. Role and scope matrix

| Role | Submit | Review | Cancel | Customer scope |
| --- | --- | --- | --- | --- |
| customer_admin | Yes | No | Draft/submitted only | Must match profile customer_id |
| customer_user | Yes | No | Draft/submitted only | Must match profile customer_id |
| admin | No | Yes | Non-terminal | Internal cross-customer |
| accounting | No | Yes | Non-terminal | Internal cross-customer |
| warehouse_manager/staff/viewer | No | No | No | Read policies remain from 040 |

Every customer action rejects a NULL profile customer and a customer mismatch.
Internal review is restricted to `admin` and `accounting`.

## 6. Timeline audit behavior

Each successful RPC inserts one append-only timeline event in the same
transaction. Events capture document type/id, customer, action, prior/new status,
profile ID, email, role, actor customer, optional trimmed comment, and timestamp.
Direct authenticated timeline INSERT is revoked to prevent client-authored audit
history.

## 7. Direct write decision

Recommendation: **Transition-RPC only now**.

Migration 043 revokes direct authenticated UPDATE on both header tables and
direct INSERT on the timeline table. It keeps header draft creation and line
editing temporarily available under existing RLS because create-draft and line
mutation RPC contracts are outside this gate. Customer line INSERT/UPDATE is
narrowed from draft-or-submitted to draft only where 040 already exposed it.
Header INSERT is also narrowed to the correct draft status for all allowed roles.
Withdrawal-line UPDATE remains unavailable; 043 does not add that path.

Remaining exposure:

- Direct header INSERT remains possible when table grants exist and 040 RLS passes.
- Direct deposit line INSERT/UPDATE and withdrawal line INSERT remain possible
  for customer drafts and for admin/accounting under the retained policies.
- Direct withdrawal line UPDATE remains revoked.
- Attachment metadata INSERT remains as defined by 040; no storage operation is
  enabled.

Create-draft, update-draft, and line mutation RPCs should be designed in Gate
2E-2/2F before the portal UI switches from demo mode. At that point, revoke
direct INSERT/UPDATE on headers and lines for a full RPC-only boundary.

## 8. Explicitly blocked

- Stock balance or inventory movement changes
- Receiving, picking, withdrawal execution, or dispatch creation/confirmation
- File bucket creation or file upload
- Email sending
- Bplus export execution and Gate 3B-5
- Auth user, password, profile bulk update, or privileged frontend key changes

## 9. UAT apply plan

1. Obtain Controller approval for the exact migration 043 checksum/diff.
2. Capture UAT table/function grants and policy definitions before apply.
3. Apply only to UAT in one transaction.
4. Verify six function signatures, owner, `prosecdef`, `proconfig`, and grants.
5. Verify header UPDATE and timeline INSERT are denied to authenticated clients.
6. Exercise rollback-safe transition cases with dedicated approved test records.
7. Confirm no warehouse execution or inventory rows change.
8. Record evidence; do not promote beyond UAT in this gate.

## 10. Testing plan

- Static unit tests verify function names, transition checks, roles, scope,
  locking, timeline writes, search path, grants, direct-write decision, and
  prohibited operations.
- Run the full Vitest suite with `npm test -- --run`.
- Run `npm run build`.
- After apply approval, add database integration tests for allowed/denied role,
  customer mismatch, stale status, concurrent lock, and timeline atomicity cases.
- Customer login smoke remains blocked until approved credentials are available.
