export type Tier = "standard" | "deluxe";

export interface Release {
  id: string;
  title: string;
  slug: string;
  artwork: string | null;
  description: string | null;
  release_date: string | null;
  published: boolean;
  stripe_product_id: string | null;
  price_standard_id: string | null;
  price_deluxe_id: string | null;
  price_standard_cents: number | null;
  price_deluxe_cents: number | null;
  download_standard_key: string | null;
  download_deluxe_key: string | null;
  created_at: string;
}

export interface Track {
  id: string;
  release_id: string;
  title: string;
  audio_key: string;
  duration: number | null;
  position: number;
}

export interface Video {
  id: string;
  title: string;
  playback_id: string | null;
  mux_asset_id: string | null;
  thumbnail: string | null;
  published: boolean;
  featured: boolean;
  position: number;
  created_at: string;
}

export interface Film {
  id: string;
  release_id: string;
  title: string;
  playback_id: string | null;
  mux_asset_id: string | null;
  poster: string | null;
  description: string | null;
}

export interface Customer {
  id: string;
  email: string;
  stripe_customer_id: string | null;
  created_at: string;
}

export interface Entitlement {
  id: string;
  customer_id: string;
  release_id: string;
  tier: Tier;
  source: string | null;
  amount_cents: number | null;
  currency: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface BandMember {
  name: string;
  role: string;
  bio: string;
  image: string;
}

export interface SiteSettings {
  tagline: string;
  hero_line: string;
  signup_header: string;
  signup_subtext: string;
  footer_text: string;
  lore_title: string;
  lore_text: string;
  band_members: BandMember[];
}
