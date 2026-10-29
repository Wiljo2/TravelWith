import type { LatLng } from "@/components/landing/globe/geo";

export interface Traveler {
  initial: string;
  city: string;
  from: LatLng;
  color: string;
}

export const DESTINATION: LatLng & { name: string } = { name: "Cartagena", lat: 10.39, lng: -75.51 };

export const TRAVELERS: Traveler[] = [
  { initial: "A", city: "CDMX", from: { lat: 19.43, lng: -99.13 }, color: "--chart-1" },
  { initial: "M", city: "Madrid", from: { lat: 40.42, lng: -3.7 }, color: "--chart-2" },
  { initial: "L", city: "Nueva York", from: { lat: 40.71, lng: -74.01 }, color: "--chart-3" },
  { initial: "S", city: "Buenos Aires", from: { lat: -34.6, lng: -58.38 }, color: "--chart-5" },
];

// Keeps the routes left of center so the South Atlantic stays free for the itinerary card.
export const VIEW_CENTER: LatLng = { lat: 8, lng: -42 };
