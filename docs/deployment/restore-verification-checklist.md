# Restore Verification Checklist

## Verification Items
- [ ] **Database reachable** – can connect to the restored DB instance.
- [ ] **Required tables visible** – all production tables exist.
- [ ] **Master data sample verified** – sample rows in `company`, `location`, etc.
- [ ] **Movement ledger sample verified** – recent ledger entries present.
- [ ] **Stock balance sample verified** – inventory balances match expected snapshot.
- [ ] **Customer inventory sample verified** – customer-owned inventory tables contain sample data.
- [ ] **User role sample verified** – role assignments for test accounts present.
- [ ] **Application can connect to restored environment** – front‑end config points to restored DB.
- [ ] **Dashboard/report loads** – main dashboard and key reports render without errors.
- [ ] **Receiving page loads** – UI for receiving operations opens.
- [ ] **Withdrawal / Picking / Dispatch pages load** – each operation page renders.
- [ ] **Audit trail sample visible** – audit logs show recent actions.
- [ ] **No production write test performed unless approved** – only read‑only verification.
- [ ] **No credentials recorded** – ensure no passwords/tokens appear in evidence.

> **Note:** All items must be marked ✅ before the drill is considered successful.
