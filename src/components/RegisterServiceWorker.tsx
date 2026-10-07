"use client";
import { useEffect } from "react";
import { MAPLIBRE_FILES } from "@/lib/maplibreFiles";

// Installs public/sw.js so the app opens without internet. Production only:
// in development it would serve stale bundles over hot reload.
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const sw = navigator.serviceWorker;
    sw.register("/sw.js").catch(() => { /* the app still works online */ });

    // The map's code loads on demand, so the worker would only store it if the
    // map were opened online after each deploy. Fetch it through the worker now.
    const storeMapCode = () => {
      if (!navigator.onLine) return;
      setTimeout(() => {
        void import("@/components/map/TripMap").catch(() => undefined);
        void import("maplibre-gl").catch(() => undefined);
        for (const url of MAPLIBRE_FILES) void fetch(url).catch(() => undefined);
      }, 3000);
    };
    if (sw.controller) storeMapCode();
    else sw.addEventListener("controllerchange", storeMapCode, { once: true });
  }, []);
  return null;
}
