import { useCallback, useEffect, useState } from "react";
import { normalizeRoomCode } from "@/lib/validate";
import { JOIN_PARAM, parsePendingJoin, serializePendingJoin } from "@/utils/invite";

const KEY = "tw-pending-join";

function store(value: string | null) {
  try {
    if (value === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, value);
  } catch { /* storage blocked: the invitation lives in memory for this page */ }
}

function stored(): string | null {
  try {
    return parsePendingJoin(localStorage.getItem(KEY), Date.now());
  } catch {
    return null;
  }
}

// An invitation link (`/?join=CODE`). Kept in localStorage, not sessionStorage, so it
// survives the sign-in redirect and email-confirmation links that open in a new tab.
// `invalid`: the link carried a malformed code (e.g. cut off when pasted).
export function usePendingJoin() {
  const [code, setCode] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has(JOIN_PARAM)) {
      const incoming = normalizeRoomCode(url.searchParams.get(JOIN_PARAM) ?? "");
      url.searchParams.delete(JOIN_PARAM);
      window.history.replaceState(null, "", url.toString());
      store(incoming && serializePendingJoin(incoming, Date.now()));
      /* eslint-disable react-hooks/set-state-in-effect -- read once from the URL */
      setCode(incoming);
      setInvalid(!incoming);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    const pending = stored();
    if (!pending) store(null);
    setCode(pending); // eslint-disable-line react-hooks/set-state-in-effect -- read once from storage
  }, []);

  const clear = useCallback(() => {
    setCode(null);
    setInvalid(false);
    store(null);
  }, []);

  return { code, invalid, clear };
}
