import { Skeleton } from "@/components/ui/empty-state";

/**
 * Fallback de carregamento para toda página dentro de `(app)`.
 *
 * O Next pré-carrega este esqueleto, então ao clicar num link a troca de página
 * é imediata — a barra lateral continua interativa e a área de conteúdo mostra o
 * esqueleto enquanto o servidor renderiza a página de verdade e faz as consultas.
 * Sem isto, a navegação fica congelada na tela antiga até o servidor responder,
 * que é o que se sente como "demorou pra trocar de página".
 *
 * Um único arquivo neste nível cobre todas as rotas do app; o formato genérico
 * (cabeçalho + algumas linhas) serve para qualquer uma delas.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-32" />
        <div className="border-line bg-surface divide-line divide-y rounded-[var(--radius-lg)] border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <Skeleton className="h-4 w-4 shrink-0 rounded-[4px]" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-16 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
