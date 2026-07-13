# BLakHarts — Official Website

**All frequencies. One signal.**

A direct-to-fan storefront and media platform: public visitors watch full music
videos and buy releases; buyers enter a paywalled member area with a full album
streaming player (THE RADIO), download zips, and a full-length film. The owner
runs everything from a no-code admin panel (CONTROL ROOM).

## Stack

| Concern | Service |
| --- | --- |
| App | Next.js (App Router) on Vercel |
| Database | Supabase Postgres (service-role access only, RLS locked) |
| Audio + images + zips | Supabase Storage (`artwork` public; `audio`, `downloads` private) |
| All video | Mux — public policy for music videos, **signed** policy for the film |
| Payments | Stripe Checkout + webhooks |
| Email (magic links) | Resend |
| Auth | Passwordless magic links → 30-day session cookie. No accounts, no passwords. |

## One-time setup

### 1. Supabase
1. Create a project at supabase.com.
2. Open the SQL editor and run the entire `supabase/schema.sql` file. This creates
   all tables, locks them with RLS, creates the three storage buckets, and seeds
   the default site copy and band cards.
3. Copy from Project Settings → API: the project URL, the `anon` key, and the
   `service_role` key.

### 2. Stripe
1. Grab your secret key (`sk_live_…` or `sk_test_…`).
2. Add a webhook endpoint pointing at `https://YOUR-DOMAIN/api/webhooks/stripe`
   subscribed to `checkout.session.completed` and `charge.refunded`.
3. Copy the webhook signing secret (`whsec_…`).

You never create products or prices by hand — saving a release in the admin
panel creates/updates them via the API.

### 3. Mux
1. Create an API access token (Settings → Access Tokens) with Mux Video permissions.
2. Create a **signing key** (Settings → Signing Keys). Store the key id and the
   base64 private key — these sign the film's playback tokens.

### 4. Resend
1. Verify your sending domain and create an API key.
2. Set `EMAIL_FROM` to something like `BLakHarts <signal@yourdomain.com>`.

### 5. Deploy on Vercel
1. Import this repo, framework preset Next.js.
2. Set every variable from `.env.example` in Project Settings → Environment
   Variables. Generate `SESSION_SECRET` with `openssl rand -hex 32`. Put the
   owner's email in `ADMIN_EMAILS`.
3. Deploy. Visit `/admin/login`, enter the allowlisted email, click the magic
   link — you're in the CONTROL ROOM.

## Owner workflow (no code)

1. **RELEASES** → “+ NEW RELEASE”: title, artwork, description, date, Standard
   and Deluxe prices, publish toggle. Saving syncs Stripe automatically.
2. **TRACKS**: bulk-select audio files inside a release — titles come from
   filenames, durations are read automatically. Drag to reorder, click to
   rename, ✕ to delete. Built for 80+ track albums.
3. **DOWNLOAD ZIPS**: upload one prepared zip per tier.
4. **THE FILM**: upload the film file (goes to Mux with a signed policy), set
   poster + description. Always Deluxe-gated.
5. **VIDEOS**: upload music videos or paste a URL for Mux to ingest, toggle
   published, drag to reorder, and mark exactly one FEATURED — that's the
   homepage hero.
6. **PAGES**: every line of site copy, the lore blurb, and the five band cards.
7. **SALES / BLAKHARTS LIST**: tables with one-click CSV export.

## How the paywall works

- Buy button → Stripe Checkout → `checkout.session.completed` webhook →
  customer + entitlement rows are written and a single-use magic link
  (24 h expiry) is emailed. Clicking it sets a 30-day session cookie.
- Returning buyers use `/access` with just their email.
- `charge.refunded` revokes the matching entitlement automatically.
- Album audio streams through 10-minute signed Supabase URLs minted per track,
  per request, after an entitlement check (`/api/player/track-url`).
- Download zips redirect through 10-minute signed URLs (`/api/member/download`).
- The film streams with Mux signed playback tokens (RS256, 6 h expiry) that are
  generated server-side only for verified Deluxe owners. Nothing paywalled is
  ever publicly addressable.

## Phase 2 hooks (The Tuner)

The player is split into a core and skins: `components/player/PlayerProvider.tsx`
owns the queue, gapless preloading, and signed-URL fetching; `RadioBar` and
`RadioSection` are pure UI over the `usePlayer()` context. The Tuner dial skin
can be added as a third consumer of the same context — station blocks are just
index ranges over the queue, and a ghost frequency is one more entry the skin
chooses to reveal.

## Local development

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev
```

The site renders with placeholder copy even before Supabase is configured;
checkout/media features light up as each service's env vars are set.
