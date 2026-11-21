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
Enums: appointment_status (booked, completed, on_hold, cancelled, no_show; `on_hold` exists in live DB, `types.ts` may lag), payment_method (cash, card, bank_transfer), attendance_status, salary_status, treatment_plan_status, clinic_role.
- No-overlap constraint: two active (booked/completed) appointments cannot share a slot on the same date.
- View `appointment_balance` (security_invoker): appointment + `paid_total` + `balance` (+ `discount_amount` used by invoices). Use for all due/pending math.
- `appointments` extra columns (added after scaffold): `discount_amount` int, `extra_service_ids uuid[]` (2nd+ services; first stays in `service_id`), `stage` text (registered, front_desk, received, conducted, approved; default registered).
- **Price model:** booking creates the appointment with `total_amount = 0` = "price not set". `total_amount` is the NET payable (after discount); `discount_amount` stored separately. Pending (`balance`) only exists once price is set (balance 0 while unpriced). Price/discount/advance are set later via `set_appointment_billing`.
- RPCs: `book_appointment` (11 named args incl. `p_discount_amount`, `p_total_amount` may be 0; the old overload with `p_discount_amount` last was dropped, two overloads cause "could not choose best candidate"), `set_appointment_billing(p_appointment_id,p_price,p_discount,p_advance,p_method)` (sets net total + discount, optional advance payment), `set_appointment_extras(p_appointment_id,p_service_ids)`, `set_appointment_stage(p_appointment_id,p_stage)`, `receive_appointment_payment`, `has_role`, `is_active_user`, `create_clinic_profile` (trigger on auth user create). Also used by code, defined in live DB (verify in Lovable if missing): `get_or_create_invoice`, `ping`.
- Trigger `payment_append_only_guard`: payments cannot be edited/deleted, only voided.
- Money is integer PKR. Timezone for "today" is Asia/Karachi (`todayPK()` in `src/lib/format.ts`).

## Pages (`src/routes/_app/`)
- `dashboard.tsx` (owner): revenue/pending/appointment stats (shows first service only).
- `appointments.index.tsx` / `appointments.$id.tsx`: date on top (default today), hourly slots, click free slot -> `BookForm` (NO price fields; name, phone, one or more services, duration). Row shows "Price not set" until priced. Detail page has `BillingPanel` (price, Rs/% discount, receive now + method, live pending). Cancel frees slot, mark completed.
- `patients.index.tsx`: tabs Today / All, search, **Add patient dropdown** = the 5 client stage options (Patient registration -> add form; Front Desk, Received sample, Conduct, Approve -> today's queue sheets via `StageQueue`, with waiting counts). Each row has Make invoice. Click row -> patient detail.
- `patients.$id.tsx`: patient info, visits (service names "A + B", "Set price" button for unpriced visits), payments, receive payment, old `InvoiceDialog`.
- `pending.tsx`: patients with outstanding balance (unchanged; unpriced appts have balance 0 so they drop out automatically).
- `settings.tsx` (owner): hub list (Services, Slots, Users + shortcuts to Staff, Expenses); each opens its own section with back button; services have search.
- `expenses.tsx`, `staff.tsx`, `login.tsx` (logo), `index.tsx`.

## Key components / libs
- `components/book-form.tsx` — booking via `book_appointment` with total 0; service picker + **Add** button builds a chip list (first = primary `service_id`, rest saved via `set_appointment_extras`). Plan and default duration follow the primary service.
- `components/billing-panel.tsx` — sets price/discount/advance via `set_appointment_billing` (default price = sum of service default prices).
- `components/make-invoice.tsx` — invoice dialog (procedures, qty, discount Rs/%, received + method). Looks up patient appointments by phone; if one is linked, Download/Print first saves billing via `set_appointment_billing` (this is what drives Pending), then builds the PDF. "Not linked" = PDF only. "Hide discount on invoice" checkbox (default ON). Can open blank (name/phone empty).
- `components/invoice-dialog.tsx` — invoice from DB visits (`get_or_create_invoice`), same hide-discount checkbox.
- `components/stage-queue.tsx` — `STAGES`, `useStages()` (today's stage map), `StageQueue` sheet (action button advances, Done list with Undo).
- `lib/invoice.ts` — `CLINIC` constants + `buildInvoicePdf`: logo top-left (`/logo.png`, falls back to text), centered "Invoice" title, Invoice No top-right, date under phone, DATE/TIME column first then SERVICE. `hideDiscount` removes price/discount/amount columns, Subtotal and Discount rows (only Total payable, Paid, Balance). Always prints "Payments can't be refunded in any case."
- `lib/shared.tsx` — `useSlots`, `useServices`, `useDayAppts`, `useExtras`, `useSvcLabel` (labels "A + B"), `pageAll`, `chip`, `METHODS`; `lib/format.ts` (`money`, dates, `initials`, `normPhone`).
- Branding in `public/`: `logo.png` (transparent full logo), `logo-mark.png` (sidebar monogram tile), `favicon.png`.
- Extra-service queries use `(supabase as any)` because `types.ts` does not know the new columns/RPCs (stage, extras); `set_appointment_billing` is typed.

## History / what was done
1. Client asked for a full clinic system on the Neo Khata base; Lovable scaffold + feature-by-feature build.
2. Built: private auth + roles, appointments (slots), patients (merged with booking), payments (append-only), pending, expenses, staff/attendance/salaries, settings, dashboard, PDF invoices, mobile + desktop layouts.
3. Scaffold downloaded from Lovable and pushed to GitHub; deployed on Cloudflare Workers, DB on Lovable Cloud, keep-alive GitHub Action added.
4. 19 Nov 2026 client change: Patients page must not show service/paid/due/pending; instead a small **Make invoice** option opening a small invoice form (self-entered data, multiple procedures, discount, print/download, refund line auto-added). Patient click still opens full info. Done (Phase 1).
5. Nov 2026 changes (client requests), each needs SQL in Lovable first:
   - Booking without price; price/discount/advance added later in appointment detail or via Make invoice -> `migration.sql` (also drops old `book_appointment` overload, see above).
   - Multiple services per booking -> `migration2.sql` (`extra_service_ids`, `set_appointment_extras`).
   - Settings as a hub; logo in sidebar/login/favicon/invoice; invoice layout + hide-discount toggle (code only).
   - Add patient dropdown with stage workflow (Patient registration, Front Desk, Received sample, Conduct, Approve) -> `migration3.sql` (`stage`, `set_appointment_stage`). Stage meaning was assumed (queue per stage, today only); confirm with client.
   - Apply order: migration.sql -> migration2.sql -> migration3.sql, then copy code.

## Open / notes
- Dashboard, Pending and `InvoiceDialog` show only the first service name of multi-service bookings.
- Stage is not shown on the appointments list or patient pages yet, only inside the Add patient queues.
- `types.ts` should be regenerated after the SQL changes; `on_hold` type errors in `tsc` are pre-existing.
- Make-invoice PDFs are not stored (number is local `EVG-YYYYMMDD-xxxx`); add an `invoices` table only if the client wants history.
- Billing: editing price later via `set_appointment_billing` is blocked if net < already paid.
- Sidebar label "Patients" unchanged.