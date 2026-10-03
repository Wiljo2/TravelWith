// Google Maps links: reading a pinned spot out of a link the group pasted, and
// building links to open a place (or directions to it) in the Google Maps app.

export const GOOGLE_MAPS_RE = /https?:\/\/(?:www\.)?(?:google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)\S*/i;
export const isShortGoogleMapsLink = (url: string) => /maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url);

export function findGoogleMapsLink(text: string): string | undefined {
  return text.match(GOOGLE_MAPS_RE)?.[0];
}

const valid = (lat: number, lng: number) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0);

// The place's own pin (!3d…!4d…) wins over the camera position (@lat,lng).
export function coordsFromGoogleMapsUrl(url: string): { lat: number; lng: number } | null {
  const u = decodeURIComponent(url);
  const pin = u.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const param = u.match(/[?&](?:q|query|ll|destination)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  const camera = u.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  for (const m of [pin, param, camera]) {
    if (m && valid(Number(m[1]), Number(m[2]))) return { lat: Number(m[1]), lng: Number(m[2]) };
  }
  return null;
}

// "…/maps/place/Disney+Springs/…" → "Disney Springs".
export function placeNameFromGoogleMapsUrl(url: string): string | undefined {
  const m = url.match(/\/maps\/place\/([^/@?]+)/);
  return m ? decodeURIComponent(m[1].replace(/\+/g, " ")).trim() || undefined : undefined;
}

// Opens the place in Google Maps: searched by name (its listing, reviews,
// hours), or by its coordinates when there's no good name.
export function googleMapsPlaceUrl(p: { lat: number; lng: number; query?: string; name?: string }): string {
  const q = p.query || p.name || `${p.lat},${p.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

// Directions from wherever the phone is, to the exact spot.
export function googleMapsDirectionsUrl(p: { lat: number; lng: number }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
}
