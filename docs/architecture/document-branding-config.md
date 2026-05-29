# Document Branding Config Foundation

## Purpose

Sprint 10A creates a reusable document branding foundation for future system-generated TGD WMS documents. The foundation supports company logo, company names, address, contact details, document header, document footer, prepared-by label, approved-by label, version, and effective date.

TGD WMS remains a Cold Storage, Goods Deposit, Storage, Customer Withdrawal, and Dispatch / Goods Issue system. This foundation does not create invoice generation, accounting post, ERP connector, or inventory sync.

## Config Fields

- `company_name_th`
- `company_name_en`
- `company_address_th`
- `company_address_en`
- `tax_id`
- `phone`
- `email`
- `website`
- `logo_url`
- `document_footer_note_th`
- `document_footer_note_en`
- `prepared_by_label_th`
- `prepared_by_label_en`
- `approved_by_label_th`
- `approved_by_label_en`
- `effective_date`
- `document_version`

## Logo Handling

The reusable header component displays the logo when `logo_url` is configured. If no logo is configured, the component shows a safe text fallback. Sprint 10A does not add logo upload, file storage, or asset management.

## Header / Footer Reuse

- `DocumentHeader.jsx` renders company branding, document title, document number, and document date.
- `DocumentFooter.jsx` renders footer note plus prepared-by and approved-by labels.
- Future document pages should reuse these components instead of hardcoding headers in every page.

## Thai / English Behavior

Branding supports Thai and English company names, addresses, footer notes, and signature labels. The `language` prop controls which language is displayed, with safe fallback to Thai/English values when needed.

## Current Limitation

- Default config is static and read-only.
- No database persistence.
- No admin save action.
- No logo upload.
- No file storage integration.
- No generated PDF/export engine.

## Future Admin Editable Config

A future sprint may add an admin configuration screen where permitted users can update company branding values after backend storage and permission rules are approved.

## Future Logo Upload / Storage

A future sprint may add controlled logo upload and storage. That work must define file size, file type, storage location, access rules, and audit behavior before implementation.

## Documents That Should Use Branding Later

- Receiving document print/preview
- Putaway document print/preview
- Transfer document print/preview
- Adjustment document print/preview
- Stock count document print/preview
- Customer Withdrawal document print/preview
- Picking document print/preview
- Dispatch / Goods Issue document print/preview
- Monthly Storage Billing Summary review document
- Accounting Charge Review draft
