"use client";
import { useEffect } from "react";

// Installs public/sw.js so the app opens without internet. Production only:
// in development it would serve stale bundles over hot reload.
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => { /* the app still works online */ });
  }, []);
  return null;
}
