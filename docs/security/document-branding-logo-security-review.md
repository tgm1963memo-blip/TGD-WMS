# Document Branding Logo Security Review

## Purpose

This document records the security review considerations for document branding logo references and future logo upload support.

## Logo Reference Risks

Logo references can create risk if they contain:

- Unsafe script schemes
- Secret-like values
- Private system URLs
- Untrusted external references
- Base64 payloads hidden in config

## Unsafe URL Risk

Unsafe `javascript:` references must be rejected because they can introduce script execution risk when rendered in a browser.

Allowed future references should be limited to approved URL, path, or storage reference patterns.

## Base64 Storage Risk

Base64 images are not allowed in Sprint 11C config because they:

- Can make configuration difficult to inspect
- Can hide large payloads
- Can bypass future file size controls
- Are harder to scan and audit than managed storage objects

## Service Role Exposure Risk

Logo reference fields must not contain service role keys, private tokens, passwords, or database URLs.

Service role keys must never be exposed to frontend code or user-editable branding configuration.

## Storage Bucket Future Requirements

Before enabling logo upload, define:

- Storage bucket name
- Public/private access model
- Admin-only upload permission
- Read access behavior for document rendering
- Object naming and replacement rules
- Deletion and retention rules

## Upload Permission Future Requirements

Only approved admin users should upload or replace logo files.

Future upload actions should be:

- Authenticated
- Authorized by backend/RLS or storage policy
- Audited
- Reversible through clear replacement process

## File Type Validation Future Requirements

Future upload should allow only approved image types, such as:

- PNG
- JPG / JPEG
- SVG only if security-reviewed and sanitized

## File Size Validation Future Requirements

Future upload should enforce a maximum file size appropriate for document headers.

Recommended initial limit should be defined during implementation and tested before production.

## Public / Private Logo Access Decision

The project must decide whether document logos are:

- Publicly readable static assets
- Authenticated storage objects
- Signed URL assets

This decision affects document rendering, caching, and security.

## Recommended Future Controls

1. Keep Sprint 11C as preview-only.
2. Reject unsafe logo references.
3. Reject base64 image values.
4. Reject service-role-like values.
5. Design storage bucket policies before upload.
6. Require admin-only upload and audit logging.
7. Validate file type and size server-side before persistence.
