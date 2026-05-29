# Backup / Restore Drill Execution Record

## Drill ID
- **Purpose**: Verify that backup and restore procedures for the production database function correctly and meet RTO/RPO requirements.
- **Scope**: Full production database backup, secure storage of backup artefacts, and restoration to a test environment for validation.

## Environment
- **System**: Production PostgreSQL instance hosted on Supabase.
- **Backup Destination**: Secure cloud storage bucket (access restricted to Operations Team).
- **Restore Target**: Isolated staging environment mirroring production schema.

## Responsible Person
- **Owner**: Operations Team Lead (Name & Contact).
- **Participants**: Backup Engineer, Restore Engineer, Security Reviewer.

## Evidence References
- Backup logs (timestamps, checksum).
- Restore logs (verification steps, checksum comparison).
- Screenshots of backup artefact listing and restore console output.

## Backup Execution
1. Initiate full database dump using Supabase backup utilities.
2. Verify dump completion and record checksum.
3. Upload dump to secure storage bucket.
4. Record storage location and access permissions.

## Restore Execution
1. Retrieve backup artefact from storage.
2. Load dump into staging environment.
3. Validate schema integrity and data consistency.
4. Run post‑restore data verification scripts.

## Data Verification
- Compare row counts and checksums between production snapshot and restored database.
- Run application‑level sanity checks (e.g., login, basic CRUD operations).

## Application Smoke Test
- Deploy the application against the restored database.
- Verify critical user flows (authentication, inventory lookup, order creation).

## RTO / RPO Record
- **RTO (Recovery Time Objective)**: **XX minutes** (actual measured: ___ minutes).
- **RPO (Recovery Point Objective)**: **XX minutes** (actual measured: ___ minutes).

## Issues and Corrective Actions
- Document any failures, root‑cause analysis, and remediation steps.
- Update backup/restore SOPs accordingly.

## Secret handling confirmation
- Verify that no secret keys (e.g., `service_role` keys) are exposed in logs or artefacts.
- Confirm that all secret handling follows the masking rules defined in the readiness UI.

## Reviewer Sign‑off
- **Reviewer**: ________________________
- **Date**: _____________________________
- **Signature**: ______________________

## Current Status
- **Actual drill execution is pending.**
- **PROD‑GAP‑004 remains Partially Closed.**
