"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/reportError";

// What the error boundaries (app/error.tsx, app/global-error.tsx) show.
export default function ErrorFallback({ error, retry, context }: { error: Error; retry: () => void; context: string }) {
  useEffect(() => {
    reportClientError(error, context);
  }, [error, context]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <h1 className="text-lg font-semibold text-foreground">Algo salió mal</h1>
      <p className="max-w-sm text-sm text-muted-foreground">Lo que ya se guardó está a salvo. Intenta de nuevo o recarga la página.</p>
      <div className="flex gap-2">
        <Button onClick={retry}>Reintentar</Button>
        <Button variant="outline" onClick={() => location.reload()}>Recargar</Button>
      </div>
    </main>
  );
}
