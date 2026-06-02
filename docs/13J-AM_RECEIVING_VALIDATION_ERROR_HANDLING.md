# 13J-AM Receiving Validation & Error Handling

## Objective
Improve validation and error handling before UAT / Go Live. Provide friendly error messages and strong frontend validation before calling backend services.

## Validation Rules
### Save Draft Validation
- Customer ID is required.
- Document No is required and must not be empty or whitespace only.
- Document No is automatically trimmed before sending.
- Save Draft button is disabled while saving.
- Save Draft button is disabled after a draft is created.

### Add Line Validation
- Draft document ID is required.
- Product ID is required.
- Lot ID is required.
- Location ID is required.
- Quantity is required, must be numeric, and must be > 0.
- Weight is optional. If provided, must be numeric and >= 0.
- If a lot is selected and it has an associated `product_id`, it must match the selected product ID.
- Add Line button is disabled while adding.

### Confirm/Post Validation
- Draft document ID is required.
- Must have at least one line before Confirm/Post.
- Button is disabled while posting.
- Button is disabled after successful post.

## Manual UUID Fallback Rules
When manual UUID entry is enabled for master lookups (Customer, Product, Lot, Location):
- The input is validated against a standard UUID format (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).
- Validation occurs before any service call.
- Friendly errors are displayed (e.g. "Invalid customer UUID format.") and service call is aborted if invalid.

## Friendly Error Mapping
Technical errors are caught and normalized using `normalizeReceivingError`:
- Unique constraints / Duplicate key: "Duplicate document number."
- Invalid UUID format: "Invalid UUID format."
- Document status CONFIRMED: "Document is already CONFIRMED and cannot be modified."
- Authentication/JWT missing: "Authentication required."
- Missing required DB fields: "Missing required field."
- Fallback: Includes the original error message text for debugging if it doesn't match known patterns.

## Safety Rules
- **RPC-only write rule:** All writes continue through existing RPC wrappers (`createReceivingDocument`, `addReceivingLine`, `postReceivingDocument`).
- **No direct DML:** UI does not use `supabase.from`, `.insert()`, `.update()`, `.delete()`, `.upsert()`.
- **No stock logic change:** No stock movement logic or stock balance logic is changed in this frontend UI validation update.
- **Production locked:** All changes are strictly for staging.
- **No direct RPC call:** `tgd_rpc_post_receiving_document` remains absent from UI component.
