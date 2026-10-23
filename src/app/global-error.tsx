"use client";
import "./globals.css";
import ErrorFallback from "@/components/ErrorFallback";

// Replaces the root layout when it fails, so it brings its own document and styles.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="es">
      <body>
        <ErrorFallback error={error} retry={retry} context="app/global-error" />
      </body>
    </html>
  );
}
