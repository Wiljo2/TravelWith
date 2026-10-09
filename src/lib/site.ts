// Public origin for absolute URLs (Open Graph, sitemap). Vercel provides the
// production domain; NEXT_PUBLIC_SITE_URL overrides it (e.g. a custom domain).
export function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}

export const SITE_TITLE = "TravelWith · Planea viajes en grupo";
export const SITE_DESCRIPTION =
  "Itinerario, presupuesto, pendientes y un asistente con IA para planear viajes en grupo, todos en tiempo real.";
