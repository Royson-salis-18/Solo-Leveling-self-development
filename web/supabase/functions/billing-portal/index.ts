// Opens the Stripe customer portal (manage / cancel). Secrets: STRIPE_SECRET_KEY, APP_URL
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
  const { data: sub } = await sb.from("subscriptions").select("provider_customer_id").maybeSingle();
  if (!sub?.provider_customer_id) return json({ error: "No billing account yet." }, 404);
  const s = await stripe("/billing_portal/sessions", { customer: sub.provider_customer_id, return_url: `${Deno.env.get("APP_URL")}/settings` });
  return json({ url: s.url });
});
