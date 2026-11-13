export const APP_NAME = "Zemon Tele";
export const APP_TITLE = "Zemon Tele — voice-following teleprompter";
export const APP_DESCRIPTION =
  "A minimal teleprompter that follows your voice. Auto-scroll, mirror mode and full styling controls, in English, Hindi and Hinglish.";

/**
 * Absolute site URL, used to resolve Open Graph / Twitter image URLs.
 * Set NEXT_PUBLIC_SITE_URL for a custom domain; on Vercel the production URL is used automatically.
 */
export function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL(`http://localhost:${process.env.PORT ?? 3000}`);
}
