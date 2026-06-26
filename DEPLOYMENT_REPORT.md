# Deployment Report — TGD WMS

**Date:** 2026-06-26  
**Target:** Vercel Production

## Deployment Summary

| Field | Value |
|-------|-------|
| Project | `tgc-wms` |
| Team | `tgm1963memo-blips-projects` |
| Deployment ID | `dpl_Gfi2HLEnCSsYH6uPzVMEey9LUCEm` |
| URL | https://tgc-wms.vercel.app |
| Build Command | `npm run build` |
| Output | `dist/` |
| Status | READY |

## Environment Variables (Vercel)

Configured via `scripts/sync-vercel-env-from-local.mjs`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- UAT credentials for Playwright (local only)

## Post-Deploy Verification

- ✅ Production build succeeded on Vercel (iad1)
- ✅ 11/11 inventory balance smoke tests passed against production URL
- ✅ Login + role permission queries complete without HTTP/2 abort

## Rollback

Revert to previous deployment via Vercel dashboard → Deployments → Promote previous `READY` deployment.
