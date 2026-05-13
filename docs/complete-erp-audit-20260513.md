# Complete ERP Audit - Stabilization Pass

## Critical (fixed in this pass)

- Overly broad write access on sensitive finance tables (`payments`, `invoices`, `journal_entries`, `journal_lines`, `refunds`, `payroll`) allowed any tenant member to mutate finance records.
  - **Fix:** Added restricted finance RLS policies in `supabase/migrations/20260513_stabilize_and_consolidate.sql` based on role and/or `has_permission()` checks.
- Cross-tenant/cross-org data corruption risk in linked financial records.
  - **Fix:** Added `validate_finance_links()` trigger to enforce organization consistency for `payments` and `journal_lines`.
- Missing immutable trail for high-impact record changes.
  - **Fix:** Added `record_audit_event()` triggers for `students`, `attendance`, `invoices`, `payments`, `journal_entries`, `journal_lines`.

## High (fixed in this pass)

- Inconsistent enterprise permissions model between pages and backend.
  - **Fix:** Expanded role model and added route-level `requiredPermissions` support in `ProtectedRoute`.
- Missing operational audit visibility for admin users.
  - **Fix:** Added `AdminOpsPage` and route `/dashboard/admin-ops` backed by `listAuditLogs()`.
- Missing export/print logging and weak evidence trail for data extract operations.
  - **Fix:** Added `data_exports` table + `logDataExport()` service and wired exports in Students, Attendance, Academics, Fees, Finance pages.
- Missing desktop-heavy table workflows (search/export/bulk).
  - **Fix:** Added unified `ErpToolbar` pattern and bulk student status actions.
- Performance gaps for institutional workloads.
  - **Fix:** Added targeted indexes on students, attendance, marks, journals, approvals, and audit logs.

## Medium (open)

- Reporting engine not yet fully normalized across all modules (inventory, payroll, transport, boarding, library).
- Fee reconciliation UI/workflow still not fully complete (cashier close, statement aging bands, bank reconciliation panel).
- Approval workflow table exists, but broader multi-step approvals per module still partial.
- Archival policy lifecycle (hot/warm/archive partitioning) not yet implemented.
- Offline synchronization and replay diagnostics still incomplete.

## Low (open)

- Some role/permission seed defaults for newly added roles need environment-specific provisioning scripts.
- Minor visual inconsistencies remain across older module forms and table density.

## Consolidation decisions applied

- Use snake_case DB naming consistently and keep frontend mapping localized in service layer.
- Keep tenant enforcement anchored to `organization_id` + RLS checks.
- Keep finance write operations permission-aware both in frontend guards and DB policy checks.
- Log both record mutations (`audit_logs`) and export operations (`data_exports`) for auditability.

## Remaining prototype signals

- Not all modules have desktop-grade bulk workflows yet.
- Not all modules have complete print/PDF templates.
- Full archival/disaster-recovery automation is still pending operational rollout.

