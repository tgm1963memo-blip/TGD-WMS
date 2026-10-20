# Known Issues — TGD WMS v1.0.0

## npm audit (accepted for v1.0.0)

| Package | Severity | Scope | Justification |
|---------|----------|-------|---------------|
| `xlsx` | High | Runtime (Excel export) | No patched version on npm; used only for admin export of trusted internal data; input validated server-side |
| `esbuild` via `vite` | Moderate | Dev only | Affects dev server only; production serves static `dist/` |
| `vitest`/`vite-node` | Moderate | Dev only | Test runner dependency; not shipped to production |

**Action:** Evaluate `sheetjs-ce` or server-side export in v1.1.0.

## Operational

- Production HOLD banner visible until business authorizes final go-live
- Playwright withdrawal picking tests skip when no `ADMIN_ACCEPTED` document in UAT DB

## Performance

- Single JS chunk >500 KB — functional; code-split planned for v1.1.0
