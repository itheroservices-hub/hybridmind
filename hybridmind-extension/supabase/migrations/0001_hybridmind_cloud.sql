-- HybridMind Cloud Pro: baseline schema.
-- Follows IThero's standing auth pattern (profiles extends auth.users 1:1)
-- and Stripe pattern (subscription_status written only by the webhook, never
-- trusted from the client). Apply via the Supabase MCP's apply_migration
-- once the project is provisioned, then run get_advisors immediately after.

-- Core profile, one row per auth.users row.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Subscription status. Written ONLY by the stripe-webhook Edge Function
-- (service-role key, bypasses RLS on write) after verifying a Stripe
-- signature. The client can read its own row but never write it directly --
-- this is the whole point: subscription state is never client-trusted.
create table public.subscription_status (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'inactive', -- 'active' | 'past_due' | 'canceled' | 'inactive'
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscription_status enable row level security;

create policy "Users can view their own subscription status"
  on public.subscription_status for select
  using (auth.uid() = profile_id);

-- Deliberately no insert/update/delete policy for authenticated users --
-- only the service-role key (used by the webhook function) can write here.

-- Synced chain/workflow templates. This is the actual product: local-only
-- today, this table is what makes them follow the user across machines.
create table public.synced_chain_templates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  template_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.synced_chain_templates enable row level security;

create policy "Users manage their own chain templates"
  on public.synced_chain_templates for all
  using (auth.uid() = profile_id);

-- Synced agent configuration (autonomy level, permission defaults, etc).
create table public.synced_agent_configs (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  config_json jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.synced_agent_configs enable row level security;

create policy "Users manage their own agent config"
  on public.synced_agent_configs for all
  using (auth.uid() = profile_id);

-- Synced chat session history. Kept lightweight (JSON blob per session)
-- rather than a fully normalized message schema -- the extension already
-- has a message shape it serializes locally; this just mirrors it.
create table public.synced_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  messages_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.synced_chat_sessions enable row level security;

create policy "Users manage their own chat sessions"
  on public.synced_chat_sessions for all
  using (auth.uid() = profile_id);

-- Idempotency tracking for the stripe-webhook function. Serverless Edge
-- Functions don't share in-memory state across cold starts / instances, so
-- "already processed this event" has to be durable, not a process-local Set.
create table public.stripe_webhook_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

-- No RLS policies at all here on purpose -- only the service-role key
-- (used by the webhook function) ever touches this table; it should be
-- completely unreachable from the client.
alter table public.stripe_webhook_events enable row level security;

-- Team tier (v2, schema only -- not wired into the extension this pass).
-- Mirrors IThero's standard org pattern so a team can share a template
-- library without a schema rewrite later.
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid references public.organizations(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  role text not null default 'member', -- 'owner' | 'member'
  primary key (organization_id, profile_id)
);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create policy "Members can view their organization"
  on public.organizations for select
  using (id in (select organization_id from public.organization_members where profile_id = auth.uid()));

create policy "Members can view their own membership rows"
  on public.organization_members for select
  using (profile_id = auth.uid());
