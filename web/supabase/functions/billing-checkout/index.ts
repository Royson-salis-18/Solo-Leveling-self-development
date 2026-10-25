// Starts a Stripe Checkout session for the Pro plan.
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_YEARLY, APP_URL
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders, json } from "../_shared/cors.ts";
import { stripe } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Sign in required." }, 401);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return json({ error: "Sign in required." }, 401);

  const { interval } = await req.json().catch(() => ({ interval: "month" }));
  const price = interval === "year" ? Deno.env.get("STRIPE_PRICE_PRO_YEARLY") : Deno.env.get("STRIPE_PRICE_PRO_MONTHLY");
  if (!price) return json({ error: "Billing is not configured." }, 503);
  const app = Deno.env.get("APP_URL")!;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: sub } = await admin.from("subscriptions").select("provider_customer_id").eq("user_id", u.user.id).maybeSingle();
  let customer = sub?.provider_customer_id as string | undefined;
  if (!customer) {
    const c = await stripe("/customers", { email: u.user.email ?? "", "metadata[user_id]": u.user.id });
    customer = c.id;
    await admin.from("subscriptions").upsert({ user_id: u.user.id, provider: "stripe", provider_customer_id: customer }, { onConflict: "user_id" });
  }
  const session = await stripe("/checkout/sessions", {
    mode: "subscription", customer: customer!, "line_items[0][price]": price, "line_items[0][quantity]": "1",
    success_url: `${app}/settings?billing=success`, cancel_url: `${app}/pricing`,
    client_reference_id: u.user.id, "subscription_data[metadata][user_id]": u.user.id,
  });
  return json({ url: session.url });
});
