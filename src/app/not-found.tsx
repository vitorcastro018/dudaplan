import { LogoMark } from "@/components/brand/logo";
import { LinkButton } from "@/components/ui/link-button";

export default function NotFound() {
  return (
    <div className="bg-paper flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <LogoMark className="h-12 w-12" />
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
