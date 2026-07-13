import { createPrivateKey } from "crypto";
import { SignJWT } from "jose";
import { env, optionalEnv } from "./env";

const MUX_API = "https://api.mux.com";

function authHeader(): string {
  const id = env("MUX_TOKEN_ID");
  const secret = env("MUX_TOKEN_SECRET");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

export function isMuxConfigured(): boolean {
  return Boolean(optionalEnv("MUX_TOKEN_ID") && optionalEnv("MUX_TOKEN_SECRET"));
}

async function muxFetch(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${MUX_API}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Mux API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

/** Create a direct upload URL the browser can PUT a video file to. */
export async function createDirectUpload(policy: "public" | "signed", corsOrigin: string) {
  const json = await muxFetch("/video/v1/uploads", {
    method: "POST",
    body: JSON.stringify({
      cors_origin: corsOrigin,
      new_asset_settings: {
        playback_policy: [policy],
        video_quality: "plus",
      },
    }),
  });
  return { uploadId: json.data.id as string, url: json.data.url as string };
}

/** Create an asset by ingesting a remote video URL. */
export async function createAssetFromUrl(url: string, policy: "public" | "signed") {
  const json = await muxFetch("/video/v1/assets", {
    method: "POST",
    body: JSON.stringify({
      input: [{ url }],
      playback_policy: [policy],
      video_quality: "plus",
    }),
  });
  return json.data as { id: string; status: string };
}

export async function getUpload(uploadId: string) {
  const json = await muxFetch(`/video/v1/uploads/${uploadId}`);
  return json.data as { id: string; status: string; asset_id?: string };
}

export async function getAsset(assetId: string) {
  const json = await muxFetch(`/video/v1/assets/${assetId}`);
  return json.data as {
    id: string;
    status: string;
    playback_ids?: { id: string; policy: string }[];
    duration?: number;
  };
}

export async function deleteAsset(assetId: string): Promise<void> {
  await fetch(`${MUX_API}/video/v1/assets/${assetId}`, {
    method: "DELETE",
    headers: { Authorization: authHeader() },
  });
}

/**
 * Sign a playback token for a signed-policy playback id (the paywalled film).
 * aud: v = video, t = thumbnail, s = storyboard.
 */
export async function signPlaybackTokens(
  playbackId: string,
  expiresInSeconds = 6 * 60 * 60
): Promise<{ playback: string; thumbnail: string; storyboard: string }> {
  const keyId = env("MUX_SIGNING_KEY_ID");
  const raw = env("MUX_SIGNING_KEY_PRIVATE");
  // Accept the key base64-encoded (as Mux hands it out) or as a raw PEM.
  const pem = raw.includes("-----BEGIN") ? raw : Buffer.from(raw, "base64").toString("utf8");
  // createPrivateKey handles both PKCS1 (BEGIN RSA PRIVATE KEY) and PKCS8 PEMs.
  const key = createPrivateKey({ key: pem });

  async function sign(aud: "v" | "t" | "s"): Promise<string> {
    return new SignJWT({ aud, sub: playbackId })
      .setProtectedHeader({ alg: "RS256", kid: keyId })
      .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
      .sign(key);
  }

  const [playback, thumbnail, storyboard] = await Promise.all([sign("v"), sign("t"), sign("s")]);
  return { playback, thumbnail, storyboard };
}
