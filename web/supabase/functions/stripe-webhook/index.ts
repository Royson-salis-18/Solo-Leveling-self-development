// Stripe -> subscriptions. Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// Deploy with --no-verify-jwt (Stripe calls it, not a signed-in user); the signature is the auth.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { verifyStripeSignature } from "../_shared/stripe.ts";

const STATUS: Record<string, string> = { active: "active", trialing: "trialing", past_due: "past_due", canceled: "canceled", unpaid: "past_due", incomplete: "incomplete", incomplete_expired: "canceled" };

Deno.serve(async (req) => {
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  if (!(await verifyStripeSignature(payload, sig, Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? ""))) {
    return new Response("bad signature", { status: 400 });
  }
  const event = JSON.parse(payload);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  if (event.type.startsWith("customer.subscription.")) {
    const s = event.data.object;
    const deleted = event.type === "customer.subscription.deleted";
    // Resolve the user from metadata, falling back to the stored customer id.
    let userId: string | undefined = s.metadata?.user_id;
    if (!userId) {
      const { data } = await admin.from("subscriptions").select("user_id").eq("provider", "stripe").eq("provider_customer_id", s.customer).maybeSingle();
      userId = data?.user_id;
    }
    if (!userId) return new Response("unknown user", { status: 202 });
    await admin.from("subscriptions").upsert({
      user_id: userId, plan_id: deleted ? "free" : "pro", status: deleted ? "canceled" : (STATUS[s.status] ?? "incomplete"),
      provider: "stripe", provider_customer_id: s.customer, provider_subscription_id: s.id,
      current_period_end: s.current_period_end ? new Date(s.current_period_end * 1000).toISOString() : null,
      cancel_at_period_end: !!s.cancel_at_period_end, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  }
  return new Response("ok");
});
