"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="border-line bg-surface flex flex-col items-center justify-center gap-4 rounded-[var(--radius-lg)] border px-6 py-16 text-center">
      <h2 className="font-display text-ink text-xl font-medium">Algo deu errado</h2>
      <p className="text-ink-muted max-w-sm text-sm">
        Ocorreu um erro inesperado ao carregar esta página. Você pode tentar novamente.
      </p>

      {/* This is a single-user app, so the person seeing this is the person who
          can fix it. Next.js scrubs server-side messages in production and
          leaves only a digest — printing it here saves a round trip to the
          container logs, where the full stack is recorded under the same id. */}
      {(error.message || error.digest) && (
        <div className="border-line bg-paper-sunk mt-2 max-w-xl rounded-[var(--radius-sm)] border p-3 text-left">
          {error.message && (
            <p className="text-ink-2 font-mono text-xs break-words">{error.message}</p>
          )}
          {error.digest && (
            <p className="text-ink-muted mt-2 font-mono text-[11px]">digest: {error.digest}</p>
          )}
        </div>
      )}

      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
