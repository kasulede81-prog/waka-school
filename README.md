# Waka School ERP

Production-ready Uganda-focused School Management ERP SaaS starter built with React, TypeScript, Vite, TailwindCSS, Supabase, PWA, and Capacitor Android support.

## V1 Scope

- Multi-school SaaS architecture with `organization_id` isolation.
- Mobile-first role-based dashboard for school admins and staff.
- Parent portal with fee balance and mobile money payment actions.
- Uganda-first fee workflows (tuition, boarding, lunch, UNEB, installments).
- Attendance and communication scaffolding.
- Supabase RLS-enabled normalized schema and edge functions.

## Stack

- React + TypeScript + Vite
- TailwindCSS
- Supabase (Auth, Postgres, RLS, Realtime, Edge Functions)
- PWA (`vite-plugin-pwa`)
- Capacitor Android

## Setup

1. Install dependencies: `npm install`
2. Copy envs: create `.env` from `.env.example`
3. Add Supabase values: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
4. Start development: `npm run dev`

## Database and Security

- SQL migration: `supabase/migrations/20260513_waka_school_initial.sql`
- Multi-tenant model: every domain table includes `organization_id`.
- RLS helper functions:
  - `current_user_role()`
  - `current_org_id()`
  - `can_access_org(target_org)`
- Policies enforce tenant isolation and role-aware access.
- Demo data seeding function: `supabase/migrations/20260513_demo_seed_function.sql`
  - Run from SQL editor:
    - `select public.seed_demo_school_data('YOUR_ORGANIZATION_UUID'::uuid);`

## Edge Functions

- `supabase/functions/mobile-money-webhook`: payment callback processing and invoice updates.
- `supabase/functions/send-notification`: stores announcement jobs for SMS/WhatsApp/email/push dispatch pipeline.
- `supabase/functions/initiate-mobile-money`: creates pending payment and sends provider request (MTN/Airtel integration point).

### Mobile Money Secrets (Edge Runtime)

Set these in Supabase project secrets before production deployment:

- `MOBILE_MONEY_WEBHOOK_URL`
- `MTN_MOMO_BASE_URL`
- `MTN_MOMO_API_USER`
- `MTN_MOMO_API_KEY`
- `MTN_MOMO_SUBSCRIPTION_KEY`
- `MTN_MOMO_TARGET_ENV`
- `MTN_MOMO_WEBHOOK_SECRET`
- `AIRTEL_MONEY_BASE_URL`
- `AIRTEL_MONEY_CLIENT_ID`
- `AIRTEL_MONEY_CLIENT_SECRET`
- `AIRTEL_MONEY_WEBHOOK_SECRET`

Webhook security:

- Incoming webhook signature headers are verified using provider-specific HMAC secrets.
- Callback events are stored in `payment_webhook_events` for auditability.
- Invoice reconciliation is idempotent (duplicate successful callbacks do not double-credit).

## Scripts

- `npm run dev` - local development
- `npm run build` - production build
- `npm run pwa:build` - build and sync web assets to Capacitor
- `npm run cap:sync` - sync Capacitor
- `npm run cap:open:android` - open Android project
