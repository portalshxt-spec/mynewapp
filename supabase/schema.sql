-- BLakHarts — Supabase schema
-- Run this whole file in the Supabase SQL editor (or `supabase db push`).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- releases
create table if not exists releases (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  artwork text,                     -- public URL of uploaded artwork
  description text,
  release_date date,
  published boolean not null default false,
  stripe_product_id text,
  price_standard_id text,           -- Stripe price id (album access)
  price_deluxe_id text,             -- Stripe price id (album + film)
  price_standard_cents integer,
  price_deluxe_cents integer,
  download_standard_key text,       -- zip in the private "downloads" bucket
  download_deluxe_key text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ tracks
create table if not exists tracks (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references releases(id) on delete cascade,
  title text not null,
  audio_key text not null,          -- path in the private "audio" bucket
  duration integer,                 -- seconds
  position integer not null default 0
);
create index if not exists tracks_release_idx on tracks(release_id, position);

-- ------------------------------------------------------------------ videos
create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  playback_id text,                 -- Mux public playback id
  mux_asset_id text,
  thumbnail text,                   -- optional custom thumbnail URL
  published boolean not null default false,
  featured boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------- films
create table if not exists films (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null unique references releases(id) on delete cascade,
  title text not null,
  playback_id text,                 -- Mux SIGNED playback id
  mux_asset_id text,
  poster text,                      -- public URL of uploaded poster
  description text
);

-- --------------------------------------------------------------- customers
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------ entitlements
create table if not exists entitlements (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  release_id uuid not null references releases(id) on delete cascade,
  tier text not null check (tier in ('standard','deluxe')),
  source text,                      -- Stripe payment_intent id, or 'admin'
  amount_cents integer,
  currency text default 'usd',
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists entitlements_customer_idx on entitlements(customer_id);
create index if not exists entitlements_source_idx on entitlements(source);

-- ----------------------------------------------------------------- signups
create table if not exists signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- settings
create table if not exists settings (
  key text primary key,
  value text not null
);

-- ------------------------------------------------------------ magic_tokens
create table if not exists magic_tokens (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_hash text not null unique,
  purpose text not null check (purpose in ('member','admin')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists magic_tokens_hash_idx on magic_tokens(token_hash);

-- --------------------------------------------------- lock everything down.
-- The app talks to the database with the service-role key only.
alter table releases enable row level security;
alter table tracks enable row level security;
alter table videos enable row level security;
alter table films enable row level security;
alter table customers enable row level security;
alter table entitlements enable row level security;
alter table signups enable row level security;
alter table settings enable row level security;
alter table magic_tokens enable row level security;

-- ------------------------------------------------------------------ storage
-- artwork: public images (covers, posters, thumbnails, band photos)
-- audio: private album tracks, served via short-lived signed URLs
-- downloads: private zips, served via short-lived signed URLs
insert into storage.buckets (id, name, public)
values ('artwork', 'artwork', true),
       ('audio', 'audio', false),
       ('downloads', 'downloads', false)
on conflict (id) do nothing;

-- ------------------------------------------------------------ default copy
insert into settings (key, value) values
  ('tagline', 'All frequencies. One signal.'),
  ('hero_line', 'Fighting hate with love. Broadcasting from nowhere. Heard everywhere.'),
  ('signup_header', 'Become a BlakHart.'),
  ('signup_subtext', 'No anger. No blades. Wake somebody up.'),
  ('footer_text', 'BLakHarts. Stay Human.'),
  ('lore_title', 'The Year 4009'),
  ('lore_text', 'The year is 4009. Mainey City runs on silence — every frequency licensed, every song approved, every heart on mute. Then one night the dial glitched. A dead tower on the edge of the grid lit up and would not go dark. BLakHarts took the signal. This is the takeover: a pirate radio broadcast fighting hate with love — from nowhere, heard everywhere.'),
  ('band_members', '[{"name":"TSAPHON","role":"Bass — The Watcher","bio":"Eyes on every horizon. Holds the low end down like a vow.","image":""},{"name":"MIPTACH","role":"Keys — The Key","bio":"Every locked door in Mainey City opens to the right chord. He knows them all.","image":""},{"name":"RA''AM","role":"Drums — The Thunder","bio":"Storm patterns from the year 4009. You feel him before you hear him.","image":""},{"name":"DATA ZAKAR","role":"Lead Guitar — The Time Traveler","bio":"Six strings across four thousand years. He remembers the future.","image":""},{"name":"DROOPITER","role":"The Astral Architect — Host & Builder","bio":"Voice of the takeover. Built the tower, runs the signal, keeps the lights on.","image":""}]')
on conflict (key) do nothing;
