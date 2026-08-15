// HybridMind Cloud Pro: Stripe webhook handler.
//
// This is the ONLY place subscription_status is ever written. Per IThero's
// standing Stripe pattern, the client-side checkout success redirect is
// never trusted as proof of payment -- only a verified webhook event is.
//
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
// (this endpoint is called by Stripe, not by an authenticated user, so it
// can't require a Supabase JWT -- it authenticates via the Stripe signature
// instead, checked below).
//
// Required env vars (set via `supabase secrets set`):
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SIGNING_SECRET
//   SUPABASE_URL (auto-provided by the Edge Functions runtime)
//   SUPABASE_SERVICE_ROLE_KEY (needed to write subscription_status, which
//     RLS deliberately blocks for the anon/authenticated roles)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@17?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2025-01-27.acacia',
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET')!;

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  // Durable idempotency check against a real table, not an in-memory Set --
  // an Edge Function has no shared memory across cold starts/instances.
  // Checked (not recorded) up front so a request that was already fully
  // handled short-circuits immediately.
  const { data: existing } = await supabaseAdmin
    .from('stripe_webhook_events')
    .select('event_id')
    .eq('event_id', event.id)
    .maybeSingle();

  if (existing) {
    return new Response('Already processed', { status: 200 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const profileId = session.client_reference_id;
        if (!profileId) {
          console.error('checkout.session.completed with no client_reference_id, cannot link to a profile');
          break;
        }

        await supabaseAdmin.from('subscription_status').upsert({
          profile_id: profileId,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          status: 'active',
          updated_at: new Date().toISOString(),
        });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await supabaseAdmin
          .from('subscription_status')
          .update({
            status: subscription.status === 'active' || subscription.status === 'trialing' ? 'active' : subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await supabaseAdmin
          .from('subscription_status')
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }

      default:
        // Ignore anything not explicitly handled above.
        break;
    }

    // Only recorded as processed after the handler above actually
    // succeeded. If it threw, we fall to the catch block below and return
    // 500 without recording this event, so Stripe's retry reaches the real
    // handler again instead of being swallowed by the dedupe check. The
    // subscription_status writes above are themselves idempotent
    // (upsert / update-by-id), so the narrow race window where two
    // concurrent deliveries of the same event both pass the check above
    // before either finishes is harmless -- worst case is reapplying the
    // same values twice, not corrupting state.
    await supabaseAdmin.from('stripe_webhook_events').insert({ event_id: event.id });

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('Error handling webhook event:', err);
    return new Response('Internal error', { status: 500 });
  }
});
