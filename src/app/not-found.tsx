import { LinkButton } from "@/components/ui/link-button";

export default function NotFound() {
  return (
    <div className="bg-paper flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="bg-accent flex h-10 w-10 items-center justify-center rounded-[10px]">
        <span className="h-4 w-4 rounded-[3px] bg-white" />
      </span>
      <h1 className="font-display text-ink text-2xl font-medium tracking-tight">
        Página não encontrada
      </h1>
      <p className="text-ink-muted max-w-sm text-sm">
        O que você procura não existe ou foi removido.
      </p>
      <LinkButton href="/hoje">Voltar para o início</LinkButton>
    </div>
  );
}
