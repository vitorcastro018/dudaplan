import { Suspense } from "react";
import { env } from "@/lib/env";
import { LoginForm } from "./login-form";

// Renderiza a cada requisição: se fosse estática, a decisão de exigir código
// ficaria congelada no valor que a variável tinha durante o build.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="bg-paper flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="bg-accent flex h-10 w-10 items-center justify-center rounded-[10px]">
            <span className="h-4 w-4 rounded-[3px] bg-white" />
          </span>
          <h1 className="font-display text-ink text-2xl font-medium tracking-tight">DudaPlan</h1>
          <p className="text-ink-muted text-sm">Controle de projetos, tarefas e reuniões.</p>
        </div>
        <Suspense>
          <LoginForm requiresCode={Boolean(env.APP_SIGNUP_CODE)} />
        </Suspense>
      </div>
    </div>
  );
}
