# Admin Editable Document Branding

## Purpose

Sprint 11C creates an admin-editable document branding foundation for TGD WMS generated documents.

The foundation lets Admin / Controller users prepare a local preview draft for company names, addresses, contact details, logo reference, footer notes, and signature labels without saving to the database.

## Scope

Included:

- Editable frontend draft state
- Pure branding validation
- Logo reference validation
- Thai and English preview
- Reusable document header/footer preview
- Admin page for preview-only editing

Not included:

- Database persistence
- Supabase Storage integration
- Logo file upload
- PDF export
- Invoice generation
- Accounting post
- ERP connector
- Inventory sync
- Warehouse workflow changes

## Current Preview-only Foundation

Sprint 10A introduced default document branding and reusable `DocumentHeader` / `DocumentFooter` components.

Sprint 11C extends this with editable local draft behavior. The draft is held in React state only and is not persisted.

## Editable Branding Fields

- Thai company name
- English company name
- Thai company address
- English company address
- Tax ID
- Phone
- Email
- Website
- Logo reference / URL
- Thai footer note
- English footer note
- Thai prepared-by label
- English prepared-by label
- Thai approved-by label
- English approved-by label
- Effective date
- Document version

## Logo Reference Rules

The logo field accepts a URL, path, or reference string only.

Rules:

- No file object upload in Sprint 11C
- No base64 image stored in config
- Unsafe `javascript:` references are rejected
- Service-role-like values are rejected
- Empty logo is allowed and uses text fallback

## Why File Upload Is Not Enabled Yet

Logo upload requires security design for:

- Storage bucket permissions
- File type validation
- File size validation
- Public/private access decision
- Malware and unsafe content review
- Admin-only upload permission
- Audit evidence

## Why Database Persistence Is Not Enabled Yet

Persistence requires:

- Database schema design
- RLS policy design
- Admin-only write enforcement
- Audit log behavior
- Rollback behavior
- Production approval

Sprint 11C intentionally avoids database writes.

## Security Considerations

- Branding validation is pure and local.
- No service role key should ever appear in branding fields.
- Logo references must not use unsafe script schemes.
- Base64 images are not accepted in config.
- Future storage integration must be reviewed by security before use.

## Future Persistence Plan

Recommended future steps:

1. Design branding config table.
2. Define admin-only RLS policies.
3. Add audit logging for branding updates.
4. Add read service for active branding config.
5. Add controlled admin save action after security review.

## Future Supabase Storage Plan

Recommended future steps:

1. Define logo storage bucket.
2. Decide public or signed URL access.
3. Add file type and size validation.
4. Restrict upload to admin.
5. Add logo replacement audit trail.

## Documents That Should Consume Branding Later

- Receiving documents
- Putaway documents
- Transfer documents
- Adjustment documents
- Stock Count documents
- Customer Withdrawal documents
- Picking documents
- Dispatch / Goods Issue documents
- Monthly Storage Billing Summary
- Accounting Charge Review handoff draft

## Out-of-scope Items

- Invoice generation
- Accounting post
- ERP connector
- ERP inventory sync
- Express sync
- PDF export
- Warehouse workflow change
