# CLAUDE.md — Evergrace Clinic System

Read this first. Project = clinic management web app for **Evergrace Aesthetics Clinic** (skin clinic: Hydra Facial, Laser, PRP, Chemical Peel; Township, Block 8, Sector B1, Lahore). Built by Fassih (GenZ Developerz) for a paying client. Based on the Neo Khata / GymKhata pattern. Scaffolded in Lovable, now maintained as a normal GitHub repo.

> **Accuracy note:** This file is a best-effort summary, NOT 100% accurate. Code, DB and deployment may have changed since it was written. Always verify against the actual files (`src/`, `package.json`, `wrangler.jsonc`, `drizzle/`) before acting, and trust the code over this file. If something here conflicts with the code, follow the code and tell the user.

## Working rules (user preferences)
- User writes Roman Urdu. Reply short and precise, max ~3 lines after each step. No long explanations or summaries.
- Do NOT rewrite the whole project. Give only changed files with their paths.
- One phase at a time. Say "Phase X done" and wait.
- Ask questions only if blocked; otherwise assume and state the assumption in one line.
- Give 3-4 short test steps per phase.
- Mobile first, must also look good on laptop.

## Stack
- TanStack Start (React 19, file routes in `src/routes`, `routeTree.gen.ts` is generated — never edit)
- TanStack Query for all data, Tailwind v4 + shadcn/ui (`src/components/ui`), lucide-react, sonner toasts
- Supabase client (`@supabase/supabase-js`) against Lovable Cloud (Supabase under the hood)
- `jspdf` for invoice PDFs (dynamic import in `src/lib/invoice.ts`)
- Vite 8, vitest, eslint, prettier. Scripts: `dev`, `build`, `test`, `lint`
- Fonts/theme: serif headings (`.serif`), jade `#2f7d6b`, dark sidebar `#14211f`, red due `#b4443a`

## Origin and code flow
- Scaffold was generated once in Lovable, then **downloaded as zip and pushed manually to GitHub** (`Ever_Grace`, main). Code is now maintained outside Lovable. There is NO live two-way code sync: Lovable editor will not see repo changes, so never assume it does.
- Repo README/AGENTS contain a Lovable block (leftover from scaffold). Ignore its sync warnings, but history rewriting (force push/rebase) is still bad practice.
- Day-to-day flow: edit code locally -> `npm run build` -> push to GitHub -> Cloudflare deploys.

## Database (Lovable Cloud)
- Backend DB still lives in the original Lovable project (Supabase under the hood, `*.lovable.cloud`, project id `tpstayfnfukspmzzzhip`). Code talks to it via `SUPABASE_URL` + publishable key.
- Schema changes are NOT done from this repo. Do not add `supabase/migrations/` or edit `drizzle/`. Give the user SQL (single idempotent, short comments) or a Lovable prompt, and the user applies it in the Lovable project. `drizzle/migrations/0000_...sql` is only a reference snapshot and may lag the live DB.
- Do not edit auto-generated files (`routeTree.gen.ts`, `integrations/supabase/types.ts`, `drizzle/schema.ts`). After a schema change, `types.ts` must be regenerated/updated by the user.
- Secrets: never commit secret values.

## Deployment
- Hosted on **Cloudflare Workers** (project `ever-grace`, `wrangler.jsonc`, `nodejs_compat`). Live URL: `ever-grace.webstudio880.workers.dev`.
- Build output: `.output/server/index.mjs` + `.output/public` (assets binding `ASSETS`).
- `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are in `wrangler.jsonc` `vars` (publishable key only).
- `.github/workflows/keep-alive.yml`: every 3 days pings DB via RPC `ping` (repo secrets `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`) so the free DB does not pause.

## Auth and roles
- Email/password, private (no public signup). Roles enum: `owner`, `manager`. `profiles` (full_name, is_active) + `user_roles`.
- `src/lib/auth.ts` `useMe()` loads profile + role; inactive or role-less users are signed out.
- `src/routes/_app.tsx` = protected layout (sidebar desktop, nav mobile). Owner-only pages: Dashboard, Settings (`OwnerOnly` wrapper + NAV `owner: true`).
- Owner creates managers / toggles active via server functions in `src/lib/users.functions.ts` (`createManager`, `setUserActive`).
- RLS enabled on every table; helper fns `has_role`, `is_active_user`.

## Database (public schema)
Tables: `profiles`, `user_roles`, `services` (name, default_price, default_slots 1-3, active), `slots` (label, start/end time, sort_order, active), `patients` (name, phone unique `^03\d{9}$`), `treatment_plans`, `appointments` (patient, service, appt_date, start_slot, slots_count 1-3, total_amount, status, cancel_reason, plan_id), `payments` (append-only, voidable), `expenses`, `staff`, `attendance`, `salaries`.
Enums: appointment_status (booked, completed, cancelled, no_show), payment_method (cash, card, bank_transfer), attendance_status, salary_status, treatment_plan_status, clinic_role.
- No-overlap constraint: two active (booked/completed) appointments cannot share a slot on the same date.
- View `appointment_balance` (security_invoker): appointment + `paid_total` + `balance` (+ `discount_amount` used by invoices). Use for all due/pending math.
- RPCs: `book_appointment` (creates/links patient by phone + appointment in one step), `receive_appointment_payment`, `has_role`, `is_active_user`, `create_clinic_profile` (trigger on auth user create). Also used by code, defined in live DB (verify in Lovable if missing): `get_or_create_invoice`, `ping`.
- Trigger `payment_append_only_guard`: payments cannot be edited/deleted, only voided.
- Money is integer PKR. Timezone for "today" is Asia/Karachi (`todayPK()` in `src/lib/format.ts`).

## Pages (`src/routes/_app/`)
- `dashboard.tsx` (owner): revenue/pending/appointment stats.
- `appointments.tsx`: date on top (default today), hourly slots 10-11 to 3-4, click free slot -> `BookForm` (patient name+phone+service+duration), booked slot shows, cancel frees slot, mark completed.
- `patients.index.tsx`: tabs Today / All, search by name or phone, "Add patient" (walk-in booking via `BookForm`), each row has **Make invoice** button (replaced the old service/paid/due/pending columns on client request, 19 Nov 2026). Click row -> patient detail.
- `patients.$id.tsx`: full patient info, visit history, payments, receive payment, old per-visit `InvoiceDialog`.
- `pending.tsx`: patients with outstanding balance.
- `expenses.tsx`, `staff.tsx` (staff, attendance, salaries), `settings.tsx` (services, slots, users; owner only).
- `login.tsx`, `index.tsx` (redirect).

## Key components / libs
- `components/book-form.tsx` — booking (RPC `book_appointment`), booking and patient record merged, no double entry.
- `components/receive-payment.tsx` — payment via RPC.
- `components/invoice-dialog.tsx` — old invoice from completed DB visits (number via `get_or_create_invoice`).
- `components/make-invoice.tsx` — NEW free-form invoice dialog: prefilled name/phone, date, any number of procedures (name/price/qty, suggestions from `services`), discount (Rs or %), received + method, Download PDF, Print (opens PDF in new tab). Not saved to DB; number is local `EVG-YYYYMMDD-xxxx`.
- `lib/invoice.ts` — `CLINIC` constants (name, address, phone, footer) + `buildInvoicePdf`. Supports `extraDiscount`. Every PDF auto-prints **"Payments can't be refunded in any case."** above the footer.
- `lib/shared.tsx` (hooks `useSlots`, `useServices`, `useDayAppts`, `pageAll`, `chip`), `lib/format.ts` (`money`, dates, `initials`).

## History / what was done
1. Client asked for a full clinic system on the Neo Khata base; Lovable scaffold + feature-by-feature build.
2. Built: private auth + roles, appointments (slots), patients (merged with booking), payments (append-only), pending, expenses, staff/attendance/salaries, settings, dashboard, PDF invoices, mobile + desktop layouts.
3. Scaffold downloaded from Lovable and pushed to GitHub; deployed on Cloudflare Workers, DB on Lovable Cloud, keep-alive GitHub Action added.
4. 19 Nov 2026 client change: Patients page must not show service/paid/due/pending; instead a small **Make invoice** option opening a small invoice form (self-entered data, multiple procedures, discount, print/download, refund line auto-added). Patient click still opens full info. Done (Phase 1).

## Open / notes
- Dashboard and Pending pages still use appointment-based pending data; confirm with client whether they stay.
- Sidebar label "Patients" unchanged.
- Make-invoice invoices are not stored; add an `invoices` table via Lovable only if the client wants history.
- Code from the 19 Nov change was not run/typechecked in the sandbox (no node_modules); run `npm i && npm run build` locally.