import { isSupabaseConfigured } from "./env";
import { db } from "./supabase";
import type { BandMember, SiteSettings } from "./types";

export const DEFAULT_BAND: BandMember[] = [
  { name: "TSAPHON", role: "Bass — The Watcher", bio: "Eyes on every horizon. Holds the low end down like a vow.", image: "" },
  { name: "MIPTACH", role: "Keys — The Key", bio: "Every locked door in Mainey City opens to the right chord. He knows them all.", image: "" },
  { name: "RA'AM", role: "Drums — The Thunder", bio: "Storm patterns from the year 4009. You feel him before you hear him.", image: "" },
  { name: "DATA ZAKAR", role: "Lead Guitar — The Time Traveler", bio: "Six strings across four thousand years. He remembers the future.", image: "" },
  { name: "DROOPITER", role: "The Astral Architect — Host & Builder", bio: "Voice of the takeover. Built the tower, runs the signal, keeps the lights on.", image: "" },
];

export const DEFAULT_SETTINGS: SiteSettings = {
  tagline: "All frequencies. One signal.",
  hero_line: "Fighting hate with love. Broadcasting from nowhere. Heard everywhere.",
  signup_header: "Become a BlakHart.",
  signup_subtext: "No anger. No blades. Wake somebody up.",
  footer_text: "BLakHarts. Stay Human.",
  lore_title: "The Year 4009",
  lore_text:
    "The year is 4009. Mainey City runs on silence — every frequency licensed, every song approved, every heart on mute. Then one night the dial glitched. A dead tower on the edge of the grid lit up and would not go dark. BLakHarts took the signal. This is the takeover: a pirate radio broadcast fighting hate with love — from nowhere, heard everywhere.",
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
