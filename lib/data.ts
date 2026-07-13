import { isSupabaseConfigured } from "./env";
import { db } from "./supabase";
import type { Film, Release, Track, Video } from "./types";

export async function getPublishedReleases(): Promise<Release[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data } = await db()
      .from("releases")
      .select("*")
      .eq("published", true)
      .order("release_date", { ascending: false, nullsFirst: false });
    return (data as Release[]) ?? [];
  } catch {
    return [];
  }
}

export async function getReleaseBySlug(slug: string): Promise<Release | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data } = await db().from("releases").select("*").eq("slug", slug).maybeSingle();
    return (data as Release) ?? null;
  } catch {
    return null;
  }
}

export async function getReleaseById(id: string): Promise<Release | null> {
  const { data } = await db().from("releases").select("*").eq("id", id).maybeSingle();
  return (data as Release) ?? null;
}

export async function getTracks(releaseId: string): Promise<Track[]> {
  const { data } = await db()
    .from("tracks")
    .select("*")
    .eq("release_id", releaseId)
    .order("position", { ascending: true });
  return (data as Track[]) ?? [];
}

export async function getPublishedVideos(): Promise<Video[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data } = await db()
      .from("videos")
      .select("*")
      .eq("published", true)
      .not("playback_id", "is", null)
      .order("position", { ascending: true });
    return (data as Video[]) ?? [];
  } catch {
    return [];
  }
}

export async function getFeaturedVideo(): Promise<Video | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data } = await db()
      .from("videos")
      .select("*")
      .eq("published", true)
      .eq("featured", true)
      .not("playback_id", "is", null)
      .limit(1)
      .maybeSingle();
    return (data as Video) ?? null;
  } catch {
    return null;
  }
}

export async function getFilmForRelease(releaseId: string): Promise<Film | null> {
  const { data } = await db().from("films").select("*").eq("release_id", releaseId).maybeSingle();
  return (data as Film) ?? null;
}
