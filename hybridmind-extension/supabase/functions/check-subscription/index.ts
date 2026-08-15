// HybridMind Cloud Pro: subscription status check.
//
// The extension calls this with the user's Supabase JWT (from the magic-link
// sign-in, see src/cloud/cloudAuth.ts) to find out whether Cloud Pro is
// active, replacing the old client-side "trust a substring in the license
// key" logic that a prior security review found was a complete bypass (see
// licenseManager.ts's history). This function is the only source of truth;
// the extension never decides Pro status on its own.
//
// Deploy: supabase functions deploy check-subscription
// (this one DOES require a valid Supabase JWT -- default deploy behavior,
// no --no-verify-jwt flag, unlike the Stripe webhook.)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Client bound to the caller's own JWT so RLS applies -- this function
  // can only ever read the subscription_status row for whoever is actually
  // signed in, it doesn't use the service-role key.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: subscription, error: subError } = await supabase
    .from('subscription_status')
    .select('status, current_period_end')
    .eq('profile_id', userData.user.id)
    .maybeSingle();

  if (subError) {
    console.error('Error reading subscription_status:', subError);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const active = subscription?.status === 'active';

  return new Response(
    JSON.stringify({
      active,
      status: subscription?.status ?? 'inactive',
      currentPeriodEnd: subscription?.current_period_end ?? null,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
