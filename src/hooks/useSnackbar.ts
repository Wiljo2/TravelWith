import { useCallback, useEffect, useState } from "react";

export interface SnackInput {
  message: string;
  action?: { label: string; run: () => void };
}

export interface Snack extends SnackInput {
  id: number;
}

export type Notify = (snack: SnackInput) => void;

const PLAIN_MS = 4000;
const ACTION_MS = 6000;

export function snackDuration(snack: SnackInput): number {
  return snack.action ? ACTION_MS : PLAIN_MS;
}

export function nextSnack(current: Snack | null, input: SnackInput): Snack {
  return { ...input, id: (current?.id ?? 0) + 1 };
}

export function useSnackbar() {
  const [snack, setSnack] = useState<Snack | null>(null);

  const notify = useCallback<Notify>((input) => setSnack((cur) => nextSnack(cur, input)), []);
  const dismiss = useCallback(() => setSnack(null), []);

  const id = snack?.id;
  const ms = snack ? snackDuration(snack) : 0;
  useEffect(() => {
    if (id === undefined) return;
    const timer = setTimeout(dismiss, ms);
    return () => clearTimeout(timer);
  }, [id, ms, dismiss]);

  return { snack, notify, dismiss };
}
