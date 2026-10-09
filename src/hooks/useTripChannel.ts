import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isAccessDenied, parseTripMessage, type TripMessage } from "@/utils/tripChannel";

export interface TripChannelHandlers {
  onMessage: (message: TripMessage) => void;
  // Broadcast is not a durable log: refetch after every (re)subscribe and
  // when the tab becomes visible again, to recover missed messages.
  onResync: () => void;
  // The realtime.messages policy rejected us: no longer a member.
  onDenied: () => void;
}

// Private Broadcast channel trip:<code>. supabase-js sends the refreshed JWT
// to Realtime on TOKEN_REFRESHED by itself (the 0.1 spike confirmed the
// subscription survives refreshes), so only the first setAuth is explicit.
export function useTripChannel(code: string | null, enabled: boolean, handlers: TripChannelHandlers) {
  const [subscribed, setSubscribed] = useState(false);
  const h = useRef(handlers);
  useEffect(() => {
    h.current = handlers;
  });

  useEffect(() => {
    const client = supabase;
    if (!client || !code || code === "LOCAL" || !enabled) return;
    let cancelled = false;
    let channel: ReturnType<typeof client.channel> | null = null;

    void client.realtime.setAuth().then(() => {
      if (cancelled) return;
      const ch = client
        .channel(`trip:${code}`, { config: { private: true } })
        .on("broadcast", { event: "*" }, ({ payload }) => {
          const message = parseTripMessage(payload);
          if (message) h.current.onMessage(message);
        })
        .subscribe((status, err) => {
          if (status === "SUBSCRIBED") {
            setSubscribed(true);
            h.current.onResync();
            return;
          }
          setSubscribed(false);
          if (status === "CHANNEL_ERROR" && isAccessDenied(err)) {
            void client.removeChannel(ch);
            h.current.onDenied();
          }
        });
      channel = ch;
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") h.current.onResync();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) void client.removeChannel(channel);
      setSubscribed(false);
    };
  }, [code, enabled]);

  return { subscribed };
}
