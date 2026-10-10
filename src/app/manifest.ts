import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TravelWith",
    short_name: "TravelWith",
    description: "Planificador colaborativo de viajes en grupo",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F7F6F2",
    theme_color: "#F7F6F2",
    lang: "es",
    // Android: TravelWith appears in the share sheet; the link lands on the
    // ideas of the open trip (useSharedLink). iOS uses a Shortcut instead.
    share_target: {
      action: "/",
      method: "GET",
      params: { title: "shareTitle", text: "shareText", url: "share" },
    },
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
