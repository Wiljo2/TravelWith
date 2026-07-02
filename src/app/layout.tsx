import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TravelWith · Wonder of the Seas",
  description: "Planificador colaborativo de itinerario · Bahamas & Perfect Day · Nov 28 – Dic 4, 2026",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
