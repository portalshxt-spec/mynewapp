import { isSupabaseConfigured } from "./env";
import { db } from "./supabase";
import type { BandMember, SiteSettings } from "./types";

export const DEFAULT_BAND: BandMember[] = [
  { name: "TSAPHON", role: "Bass — The Watcher", bio: "First to sense trouble, last to power down. He sees what is coming, and his low end is the floor the whole broadcast stands on.", image: "" },
  { name: "MIPTACH", role: "Keys — The Key", bio: "He opened every door they locked. When the Corporation seals a system, MIPTACH finds the chord it was waiting for.", image: "" },
  { name: "RA'AM", role: "Drums — The Thunder", bio: "He does not talk much. His kick registers on seismographs, and while he plays, nobody can trace the signal.", image: "" },
  { name: "DATA ZAKAR", role: "Lead Guitar — The Time Traveler", bio: "Every style, every era, every legend they tried to erase. He carries them all, and brings them back to air.", image: "" },
  { name: "DROOPITER", role: "The Astral Architect", bio: "Overseer of the tech. Builder of the records. The voice of the broadcast, hosting from somewhere they will never find.", image: "" },
];

export const DEFAULT_SETTINGS: SiteSettings = {
  tagline: "All frequencies. One signal.",
  hero_line: "Fighting hate with love. Broadcasting from nowhere. Heard everywhere.",
  signup_header: "Become a BlakHart.",
  signup_subtext: "No anger. No blades. Wake somebody up.",
  footer_text: "BLakHarts. Stay Human.",
  lore_title: "The Year 4009",
  lore_text:
    "The year is 4009. Two cities are all that is left of the Bay: Utopia City, the Corporation's spotless showroom, and Mainey City, where the old world still runs on recycled fuel and real memories. Every station on every dial belongs to T.H.E. Corporation, playing songs about nothing to a city kept comfortable and asleep. Then one night, every frequency changed at once. The BLakHarts took the airwaves to play songs about something: the truth. Fighting hate with love. No anger, no blades. And every listener who wakes up is one of us.",
  band_members: DEFAULT_BAND,
};

export async function getSettings(): Promise<SiteSettings> {
  if (!isSupabaseConfigured()) return DEFAULT_SETTINGS;
  try {
    const { data } = await db().from("settings").select("key, value");
    const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
    let band = DEFAULT_BAND;
    if (map.band_members) {
      try {
        band = JSON.parse(map.band_members);
      } catch {
        /* keep default */
      }
    }
    return {
      tagline: map.tagline ?? DEFAULT_SETTINGS.tagline,
      hero_line: map.hero_line ?? DEFAULT_SETTINGS.hero_line,
      signup_header: map.signup_header ?? DEFAULT_SETTINGS.signup_header,
      signup_subtext: map.signup_subtext ?? DEFAULT_SETTINGS.signup_subtext,
      footer_text: map.footer_text ?? DEFAULT_SETTINGS.footer_text,
      lore_title: map.lore_title ?? DEFAULT_SETTINGS.lore_title,
      lore_text: map.lore_text ?? DEFAULT_SETTINGS.lore_text,
      band_members: band,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(entries: Record<string, string>): Promise<void> {
  const rows = Object.entries(entries).map(([key, value]) => ({ key, value }));
  const { error } = await db().from("settings").upsert(rows);
  if (error) throw new Error(`Failed to update settings: ${error.message}`);
}
