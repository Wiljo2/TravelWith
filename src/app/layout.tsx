import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";
import { ENTRY_SCRIPT } from "@/components/landing/entryScript";
import { SITE_DESCRIPTION, SITE_TITLE, siteUrl } from "@/lib/site";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: "TravelWith",
  appleWebApp: {
    capable: true,
    title: "TravelWith",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    locale: "es_CO",
    siteName: "TravelWith",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
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
      <head>
        <script dangerouslySetInnerHTML={{ __html: ENTRY_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
