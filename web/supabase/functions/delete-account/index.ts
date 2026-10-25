// Cancels any live subscription, then calls delete_my_account() as the player.
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

  const { data: sub } = await sb.from("subscriptions").select("provider_subscription_id, status").maybeSingle();
  if (sub?.provider_subscription_id && sub.status !== "canceled") {
    try { await stripe(`/subscriptions/${sub.provider_subscription_id}`, undefined, "DELETE"); }
    catch (e) { return json({ error: `Could not cancel billing: ${(e as Error).message}. Account NOT deleted.` }, 502); }
  }
  const { error } = await sb.rpc("delete_my_account");
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});
