import { useCallback, useEffect, useState } from "react";
import { findIdeaUrls } from "@/utils/ideas";

const KEY = "tw-shared-link";
const PARAMS = ["share", "shareText", "shareTitle"];

// A link shared to the app from the phone: Android's share sheet (manifest
// share_target) or the iOS Shortcut open "/?share=…". It is kept for the tab
// (signing in redirects away and back) until the member adds or dismisses it.
export function useSharedLink() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incoming = PARAMS.map((p) => params.get(p) ?? "").join(" ").trim();
    if (findIdeaUrls(incoming).length > 0) {
      try { sessionStorage.setItem(KEY, incoming); } catch { /* storage blocked: keep it in memory */ }
      const url = new URL(window.location.href);
      for (const p of PARAMS) url.searchParams.delete(p);
      window.history.replaceState(null, "", url.toString());
      setText(incoming); // eslint-disable-line react-hooks/set-state-in-effect -- read once from the URL
      return;
    }
    try { setText(sessionStorage.getItem(KEY)); } catch { /* storage blocked */ }
  }, []);

  const clear = useCallback(() => {
    setText(null);
    try { sessionStorage.removeItem(KEY); } catch { /* storage blocked */ }
  }, []);

  return { text, clear };
}
