# Waka School Enterprise Gap Audit

## Completed in this upgrade

- Expanded data model to institutional ERP scope in `supabase/migrations/20260513_enterprise_erp_modules.sql`:
  - multi-campus, subscriptions, usage limits
  - granular RBAC (`permissions`, `roles`, `role_permissions`, `user_role_assignments`)
  - academics (`academic_terms`, `subjects`, `exams`, `marks`)
  - student lifecycle (`student_guardians`, `student_documents`, `student_events`, `discipline_incidents`)
  - transport, boarding, health, library
  - accounting-grade ledger (`ledger_accounts`, `journal_entries`, `journal_lines`, `refunds`, `budgets`)
  - HR extensions (`staff_contracts`, `staff_leaves`, `salary_advances`)
  - operations (`background_jobs`)
- Added strong tenant isolation/RLS policies for all new module tables.
- Added finance integrity control with deferred trigger enforcing balanced journal entries.
- Removed mock dependencies from key operational service paths:
  - students, invoices, attendance, dashboard metrics now require configured Supabase and tenant context.
- Upgraded desktop IA from startup dashboard style to institutional module navigation in `src/components/AppShell.tsx`.
- Added academics operations page (`src/pages/dashboard/AcademicsPage.tsx`) with real marks entry and grading logic.
- Added finance ledger operations page (`src/pages/dashboard/FinancePage.tsx`) with double-entry journal posting.
- Switched dashboard to live tenant metrics (`src/pages/dashboard/DashboardPage.tsx`).
- Switched parent portal balance view to live invoice data (`src/pages/portal/ParentPortalPage.tsx`).
- Added payment hardening migration and provider-safe webhook architecture from previous phase.

## Critical gaps still open (next waves)

1. **Workflow completeness**
   - admission pipeline state machine, student promotion/transfer automation, alumni lifecycle.
2. **Advanced academics**
   - timetable engine, report-card generation, class ranking computations, teacher comments moderation.
3. **Finance completeness**
   - fee structure rules engine, scholarships/discount policies, cashier close-of-day, bank reconciliation UI, refund approval flow UI.
4. **Payroll compliance**
   - PAYE/NSSF calculators, payslip generation, leave accrual logic.
5. **Offline engine**
   - durable local queue (IndexedDB), conflict resolution, replay diagnostics.
6. **Operational SRE**
   - structured telemetry, retry workers for `background_jobs`, incident dashboards, automated backups/restore drills.
7. **Security hardening**
   - edge-function rate limiting, signed upload pipeline, secret rotation workflows, anomaly detection.

## Recommended execution plan

- **Wave 1:** complete finance workflows (fee rules, cashier, reconciliation, refunds) + audit-grade reports.
- **Wave 2:** complete academics workflows (timetable, report cards, ranking, term promotion).
- **Wave 3:** offline sync engine + operations console (jobs, retries, support tooling, tenant lifecycle ops).
- **Wave 4:** compliance hardening (payroll statutory engines, security controls, DR runbooks).

