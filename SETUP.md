# Setup & deployment

## 1. Supabase project
Create a project; copy the URL and anon key into `web/.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). **Do not** put any other secret in a `VITE_` variable: it is published to every visitor.

## 2. Database — run in the SQL editor, in this order
1. `web/supabase_schema.sql`, then `web/supabase_notifications.sql` (legacy base; safe to re-run). *Fresh projects only; existing projects already have them.*
2. every file in `web/supabase/migrations/` in filename order (`…20261025000001` → `…09`). All are idempotent and non-destructive.

**Deploy the new frontend and run the migrations together.** The migrations remove the client's ability to write XP directly, so the old frontend stops working against the new database.
`…06_rollout_recalibration.sql` gives existing players a clean slate (no retroactive decay).
In Auth settings, add your site URL and `…/reset-password` to the redirect allow-list. In Database → Replication, ensure `notifications` is published.

### Streak reminders (optional, recommended)
`…07_engagement.sql` ships `private.send_return_nudges()`: one in-app reminder per player per day, 18:00–21:59 local time, only while their streak can still be saved. Schedule it hourly with pg_cron (Database → Extensions → enable `pg_cron`):
```sql
select cron.schedule('streak-nudges', '0 * * * *', $$select private.send_return_nudges()$$);
```
World bosses are created lazily on the first hit of each UTC week; nothing to schedule.

## 3. Edge functions (AI + billing)
```bash
supabase functions deploy oracle billing-checkout billing-portal delete-account
supabase functions deploy stripe-webhook --no-verify-jwt
supabase secrets set GEMINI_API_KEY=… APP_URL=https://your.app ALLOWED_ORIGIN=https://your.app \
  STRIPE_SECRET_KEY=… STRIPE_WEBHOOK_SECRET=… STRIPE_PRICE_PRO_MONTHLY=price_… STRIPE_PRICE_PRO_YEARLY=price_…
```
Point a Stripe webhook at `…/functions/v1/stripe-webhook` for `customer.subscription.created|updated|deleted`.
These functions were written but **not run against live Stripe/Gemini** — test in Stripe test mode first.

## 4. Pricing & limits
Edit the `plans` table (prices, `limits`, `features`). No deploy needed.

## 5. Static hosting
`render.yaml` builds `web/` as a static site with SPA rewrites.

## Before charging money
Rename the product (the name/lore are third-party IP — see `web/src/lib/brand.ts`), complete the legal templates, set a support email, and review the free/pro limits.
