"use client";
import ErrorFallback from "@/components/ErrorFallback";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorFallback error={error} retry={retry} context="app/error" />;
}
