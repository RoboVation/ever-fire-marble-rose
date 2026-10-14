create table if not exists profiles (
  user_id text primary key,
  display_name text,
  language text not null default 'en',
  notify_approach boolean not null default true,
  text_size text not null default 'normal',
  theme text not null default 'system',
  home_key text,
  work_key text,
  created_at timestamptz not null default now()
);

create table if not exists saved_places (
  id text primary key,
  user_id text not null,
  place_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, place_key)
);
create index if not exists saved_places_user_idx on saved_places (user_id);

create table if not exists saved_journeys (
  id text primary key,
  user_id text not null,
  title text not null,
  journey_json text not null,
  created_at timestamptz not null default now()
);
create index if not exists saved_journeys_user_idx on saved_journeys (user_id);

create table if not exists tickets (
  id text primary key,
  user_id text not null,
  status text not null check (status in ('pending_payment', 'paid', 'failed', 'refunded', 'redeemed')),
  summary_json text not null,
  rides_json text not null,
  amount_lkr integer not null,
  currency text not null default 'LKR',
  fare_model text not null,
  idempotency_key text not null,
  provider text not null default 'sandbox',
  provider_ref text,
  paid_at timestamptz,
  redeemed_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index if not exists tickets_user_idx on tickets (user_id, created_at desc);

create table if not exists staff_roles (
  user_id text primary key,
  role text not null check (role in ('operator')),
  created_at timestamptz not null default now()
);

create table if not exists operator_invites (
  code_hash text primary key,
  created_by text not null,
  created_at timestamptz not null default now(),
  used_by text,
  used_at timestamptz
);

create table if not exists service_alerts (
  id text primary key,
  severity text not null check (severity in ('info', 'disruption')),
  route_id text,
  active boolean not null default true,
  title_en text not null,
  title_si text not null,
  title_ta text not null,
  body_en text not null,
  body_si text not null,
  body_ta text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists feedback (
  id text primary key,
  user_id text not null,
  kind text not null,
  message text not null,
  ref_id text,
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_idx on feedback (created_at desc);

create table if not exists arrival_reports (
  id text primary key,
  user_id text not null,
  stop_id text not null,
  route_id text not null,
  note text,
  status text not null default 'unverified' check (status in ('unverified', 'verified', 'rejected')),
  created_at timestamptz not null default now()
);
create index if not exists arrival_reports_stop_idx on arrival_reports (stop_id, created_at desc);

create table if not exists route_overrides (
  route_id text primary key,
  headway_min integer,
  active boolean not null default true,
  note text,
  updated_by text not null,
  updated_at timestamptz not null default now()
);

create table if not exists audit_log (
  id text primary key,
  actor_id text not null,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on audit_log (created_at desc);

create table if not exists trip_shares (
  id text primary key,
  user_id text not null,
  journey_json text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

insert into service_alerts (
  id, severity, route_id, active,
  title_en, title_si, title_ta,
  body_en, body_si, body_ta,
  created_by
)
select
  'seed-demo-alert',
  'info',
  null,
  true,
  'Sample network only',
  'නියැදි ජාලය පමණි',
  'மாதிரி வலையமைப்பு மட்டும்',
  'This notice is seeded demonstration copy. It is not a live operator disruption. Routes, times, and vehicle positions in Gaman are sample data.',
  'මෙය නියැදි දැනුම්දීමකි. සජීවී මෙහෙයුම් බාධාවක් නොවේ. ගමන් මාර්ග, වේලාවන් සහ වාහන ස්ථාන නියැදි දත්තයි.',
  'இது ஒரு மாதிரி அறிவிப்பு. நேரடி இயக்குநர் இடையூறு அல்ல. வழிகள், நேரங்கள், வண்டி நிலைகள் மாதிரி தரவு.',
  'seed'
where not exists (select 1 from service_alerts where id = 'seed-demo-alert');
