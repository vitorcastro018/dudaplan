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
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
