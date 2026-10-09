"use client";
import { useLayoutEffect, useState, type ReactNode } from "react";
import App from "@/App";
import { LOCAL_MODE_ENABLED } from "@/data/localMode";
import { isOffline, lastSnapshotCode } from "@/lib/offline";
import { shouldEnterApp } from "@/components/landing/entry";

function readStorageKeys(): string[] {
  try {
    return Object.keys(localStorage);
  } catch {
    return [];
  }
}

export default function EntryGate({ landing }: { landing: ReactNode }) {
  const [enter, setEnter] = useState(false);

  useLayoutEffect(() => {
    const go = shouldEnterApp({
      search: window.location.search,
      storageKeys: readStorageKeys(),
      offline: isOffline(),
      hasSnapshot: lastSnapshotCode() !== null,
      standalone: window.matchMedia("(display-mode: standalone)").matches,
      localModeEnabled: LOCAL_MODE_ENABLED,
    });
    if (go) setEnter(true);
    else delete document.documentElement.dataset.entry;
  }, []);

  return enter ? <App /> : <div data-landing>{landing}</div>;
}
