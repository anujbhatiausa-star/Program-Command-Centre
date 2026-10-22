# Program Command Center

A program management dashboard for a Salesforce delivery program billed by **accepted story points**, where Algoworks bills **only its own share** of each story. Built as an interview demo.

> **Sample data.** Every person, story and figure is fictional. No Jira or other external system is connected.

**Stack:** Next.js 15 (App Router) + TypeScript, Tailwind CSS, Supabase (Postgres, Auth, Realtime), Recharts, Vitest.

**Branding:** no `assets/algoworks-logo.*` was supplied, so the header uses a plain text "Algoworks" wordmark and a neutral palette. To use a logo, add it under `public/` and swap `Wordmark` in `components/Brand.tsx`.

---

## Setup (about 10 minutes)

You need Node.js 20+ and a free Supabase account.

1. **Create a new Supabase project** at <https://supabase.com/dashboard>. Use a new, dedicated project; never reuse another project's database or keys.
2. **Copy the keys.** In Supabase: Project Settings → API. Then:
   ```bash
   cp .env.example .env.local
   ```
   Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. `.env.local` is git-ignored; never commit it.
3. **Create the schema.** In Supabase: SQL Editor → New query. Paste all of `supabase/migrations/001_schema.sql` and click **Run**. This creates the tables, indexes, row-level security policies and workflow triggers, and adds `stories` to Realtime.
4. **Install, seed and create the demo users**, in this order:
   ```bash
   npm install
   node scripts/seed.mjs               # sample data; safe to run again at any time
   node scripts/create-demo-users.mjs  # the 4 logins below; safe to run again
   ```
5. **Run it:**
   ```bash
   npm run dev     # http://localhost:3000
   npm test        # billing unit tests
   ```

### Demo logins (password `demo123`)

| Email | Role | Sees |
|---|---|---|
| `pm@algoworks.demo` | Algoworks delivery lead (PM) | Everything incl. cost and margin; closes sprints, invoices, RAID, gates, reset |
| `ba@algoworks.demo` | Algoworks business analyst | Backlog and board, releases, RAID, team; no financials |
| `sponsor@customer.demo` | Customer executive sponsor | Overview, billing statement, releases, RAID; no cost or margin |
| `po@customer.demo` | Customer product owner | Same as sponsor plus the **Acceptance queue** (accept / reject) |

### Optional: deploy to Vercel

1. Push this folder to its own GitHub repo, then on <https://vercel.com/new> import it (framework preset: Next.js).
2. Add the same three environment variables from `.env.local` in Vercel → Settings → Environment Variables.
3. Deploy. No Supabase URL settings are needed, because sign-in is email and password.

---

## 2-minute demo script

Use two browsers, or one normal window and one private window.

| Time | Who | Do and say |
|---|---|---|
| 0:00 | **Browser A: PM** | Sign in as `pm@algoworks.demo`. *"A bank moved this Salesforce program to us after the previous vendor left. We bill $900 per accepted point, but only for our share of each story."* Point at the **Sample data** badge and the green **Live** dot. |
| 0:20 | A | Overview tiles: billable points this sprint (3.5), cash at risk, margin 14.8% vs a 25% target. Velocity chart: *"Sprint 1 was the handover and ran at a loss; the dashed line is break-even."* Hover any ⓘ for its definition. |
| 0:40 | A | **Billing** → open **INV-S06**. *"SF-121 was rejected in sprint 5 and accepted in sprint 6, so it bills in sprint 6, and only 70% of it. SF-124 was built by the bank's own developer, so it bills $0."* Point at the plain-language rules box. |
| 1:00 | **Browser B: PO** | Sign in as `po@customer.demo` → **Acceptance queue**. Show the countdown (one story is overdue). **Accept SF-132** (13 points, 70/30). |
| 1:10 | A | Within seconds a toast appears: *"Story SF-132 accepted: +9.1 billable points ($8,190)"*. Billable this sprint goes from 3.5 to 12.6. |
| 1:20 | B | **Reject SF-133** with a reason. *"It goes back to In progress and earns nothing."* In A, open **Backlog & board** to see the reason on the card. |
| 1:35 | A | **Billing** → **Close Sprint 8** → draft **INV-S08** for 12.6 points ($11,340) → **Mark sent**. Unaccepted stories roll into sprint 9. |
| 1:50 | B | Sign out, then sign in as `sponsor@customer.demo`. *"The customer sees the statement and per-story split, never cost or margin, and never our drafts. That's enforced in the database with row-level security, not just hidden in the UI."* |
| 2:00 | A | **Reset demo data** to run it again. |

---

## Billing rules (`lib/billing.ts`)

1. Each story has points, a cloud/area and assignments (person + share %); shares total 100. This is enforced by a database constraint trigger.
2. Each person belongs to `algoworks` or `customer`.
3. **Billable points = story points × Algoworks share ÷ 100.** Customer shares count as delivered capacity, never billed.
4. Only **Accepted** stories bill, and only the customer product owner can accept. Ready-for-acceptance points show as *awaiting acceptance*. A rejection sends the story back to In progress.
5. A story bills in the sprint it was **accepted** in (`stories.accepted_sprint_id`, stamped by the database at acceptance).
6. Revenue = billable points × rate. Cost = Algoworks people only (cost per sprint × allocation).
7. Closing a sprint creates a **Draft** invoice with a per-story split. Invoices move Draft → Sent → Paid.
8. Break-even billable points = sprint cost ÷ rate.

**Metric definitions**

| Metric | Definition |
|---|---|
| Acceptance rate | Accept decisions ÷ all accept-or-reject decisions |
| Cash at risk | Awaiting-acceptance value + sent, unpaid invoices |
| Margin to date | Closed sprints only, because the active sprint has full cost but partial revenue |

`tests/billing.test.ts` covers:
- a 100% Algoworks story, a 70/30 split, a fully customer story (bills 0), and an unaccepted story (bills 0)
- rejected-then-accepted (bills once, in the acceptance sprint) and acceptance in a later sprint
- a loss sprint, break-even, and cost counted for Algoworks people only
- share validation and the customer redaction

`tests/seed-and-metrics.test.ts` checks the sample data and the customer view.

## Security model

- **RLS on every table.**
  - Program data (stories, assignments, sprints, RAID, environments, invoices) is readable by any signed-in user.
  - Draft invoices are PM-only.
- **Cost, margin and internal rate card** live in separate tables, `person_costs` and `finance_config`, readable only when `profiles.role = 'pm'`. The contract rate per point is in `program_config` because it is printed on every invoice.
- **Story workflow trigger** (`enforce_story_workflow`):
  - Only `product_owner` can accept or reject.
  - Accept is allowed only from Ready for acceptance; reject needs a reason.
  - Accepted stories are locked.
  - Only PM/BA can change anything else.
- **Invoices and sprints:** only `pm` can insert or update them; an invoice-status trigger allows only Draft → Sent → Paid.
- **Route handlers** (`app/api/**`) check the role again and return 403. Customer pages never query cost tables, and the overview payload for non-PM users passes through `redactFinancials` (unit-tested).
- **Service-role key** is used only by the scripts and by the PM-only reset route, after the PM role has been verified from the user's own session.

## Project layout

```
app/(app)/            pages: overview, billing (+ invoice), board, acceptance, releases, raid, team
app/api/              route handlers: accept, reject, advance, close sprint, invoice status, RAID, gates, reset
lib/billing.ts        pure billing rules (unit-tested)
lib/metrics.ts        overview and sprint metrics built on billing.ts
lib/seed-data.ts      sample dataset (pure; invoices computed with billing.ts)
lib/seed.ts           idempotent seeding used by scripts/seed.mjs and the reset route
supabase/migrations/  001_schema.sql
scripts/              seed.mjs, create-demo-users.mjs
```

## Troubleshooting

- **The "Live" dot stays grey.** Check that the migration's last statement ran: Database → Publications → `supabase_realtime` should include `stories`.
- **"Invalid login credentials".** Run `node scripts/create-demo-users.mjs` again.
- **Login page says Supabase is not configured.** Fill in `.env.local`, then restart `npm run dev`.
- **Want the data back to its starting state?** Sign in as PM → **Reset demo data**, or run `node scripts/seed.mjs`.
