import type { NextConfig } from "next";

// script-src keeps 'unsafe-inline' because Next.js injects inline bootstrap
// scripts; moving to nonces needs a proxy and dynamic rendering (plan Phase 15).
// style-src needs it for the data-driven inline styles (calendar positions,
// category colors). 'unsafe-eval' only in development (React Refresh).
const isDev = process.env.NODE_ENV !== "production";

// REST/Auth over https and Realtime over wss, for whatever host the project uses.
function supabaseOrigins(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return "https://*.supabase.co wss://*.supabase.co";
  const { host } = new URL(raw);
  return `https://${host} wss://${host}`;
}

// Third parties the app loads directly in the browser:
// - Google avatars (sign-in)
// - trip map: OpenFreeMap style/tiles/glyphs and Wikimedia place photos
// - idea covers from TikTok/YouTube CDNs (the /thumb route is the same-origin fallback)
// - the TikTok/YouTube players embedded in the idea viewer
const MAP_TILES = "https://tiles.openfreemap.org";
const PLACE_PHOTOS = "https://upload.wikimedia.org";
const COVERS = "https://*.tiktokcdn.com https://*.tiktokcdn-us.com https://i.ytimg.com";
const PLAYERS = "https://www.tiktok.com https://www.youtube.com";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://lh3.googleusercontent.com ${MAP_TILES} ${PLACE_PHOTOS} ${COVERS}`,
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigins()} ${MAP_TILES} ${PLACE_PHOTOS}`,
  "worker-src 'self' blob:",
  `frame-src ${PLAYERS}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
