# Sprint 0B Implementation Notes

## What Was Created

- React + Vite project foundation
- Small `src/app/App.jsx` that only composes providers and router
- Router separated into `src/app/router.jsx`
- Route constants in `src/constants/routes.js`
- Layout components under `src/components/layout/`
- Shared page shell under `src/components/ui/`
- Barcode placeholder component under `src/components/barcode/`
- Placeholder feature pages under `src/features/`
- Safe Supabase client shell under `src/services/supabaseClient.js`
- Basic Vitest render test

## Routes Created

- `/`
- `/customers`
- `/products`
- `/locations`
- `/receiving`
- `/inventory`
- `/movement-ledger`
- `/picking`
- `/transfer`
- `/adjustment`
- `/audit`

## Dependencies Added

- `react`
- `react-dom`
- `vite`
- `@vitejs/plugin-react`
- `react-router-dom`
- `@supabase/supabase-js`
- `vitest`
- `jsdom`
- `@testing-library/react`
- `@testing-library/jest-dom`

## Intentionally Not Implemented

- No WMS business logic
- No inventory movement logic
- No stock balance calculation
- No Supabase queries
- No database migrations
- No Express sync
- No legacy code imports
- No copied legacy `App.jsx` logic

## OneDrive Caution

This project is inside OneDrive. Avoid syncing `node_modules` if possible, do not manually edit files while Codex is running, and watch for file lock issues during install, build, and test commands.

