import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "TravelWith",
  description: "Planificador colaborativo de viajes en grupo · itinerario, presupuesto y tareas en tiempo real",
  applicationName: "TravelWith",
  appleWebApp: {
    capable: true,
    title: "TravelWith",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F7F6F2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Browsers and extensions (Grammarly, ColorZilla, password managers…) inject
    // attributes on <html>/<body> before hydration. This only silences attribute
    // diffs on these two elements, not on their children.
    <html lang="es" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
