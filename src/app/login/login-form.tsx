"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { login, signup, type LoginState } from "./actions";

type Mode = "entrar" | "criar";

function SubmitButton({ mode }: { mode: Mode }) {
  const { pending } = useFormStatus();
  const label = mode === "entrar" ? "Entrar" : "Criar conta";
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (mode === "entrar" ? "Entrando..." : "Criando...") : label}
    </Button>
  );
}

export function LoginForm({ requiresCode }: { requiresCode: boolean }) {
  const searchParams = useSearchParams();
  const [mode, setMode] = React.useState<Mode>("entrar");

  const [loginState, loginAction] = useActionState<LoginState, FormData>(login, { error: null });
  const [signupState, signupAction] = useActionState<LoginState, FormData>(signup, { error: null });

  const state = mode === "entrar" ? loginState : signupState;

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <ModeSwitch mode={mode} onChange={setMode} />

        {/* `key` força o React a remontar o formulário ao trocar de modo. Sem
            isso os campos preenchidos permanecem, e a senha digitada para
            entrar seria reenviada como senha nova no cadastro. */}
        <form
          key={mode}
          action={mode === "entrar" ? loginAction : signupAction}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="next" value={searchParams.get("next") ?? "/hoje"} />

          {mode === "criar" && (
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" autoComplete="name" maxLength={120} required autoFocus />
            </div>
          )}

          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              autoFocus={mode === "entrar"}
            />
          </div>

          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "entrar" ? "current-password" : "new-password"}
              minLength={mode === "criar" ? 8 : undefined}
              required
            />
            {mode === "criar" && (
              <p className="text-ink-muted mt-1.5 text-xs">Ao menos 8 caracteres.</p>
            )}
          </div>

          {mode === "criar" && requiresCode && (
            <div>
              <Label htmlFor="code">Código de convite</Label>
              <Input id="code" name="code" required />
            </div>
          )}

          {state.error && <p className="text-danger text-sm">{state.error}</p>}
          {state.message && (
            <p className="border-line bg-paper-sunk text-ink-2 rounded-[var(--radius-sm)] border p-3 text-sm">
              {state.message}
            </p>
          )}

          <SubmitButton mode={mode} />
        </form>
      </CardContent>
    </Card>
  );
}

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Entrar ou criar conta"
      className="border-line bg-paper-sunk flex gap-1 rounded-[var(--radius-sm)] border p-1"
    >
      {(["entrar", "criar"] as const).map((value) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={mode === value}
          onClick={() => onChange(value)}
          className={cn(
            "flex-1 rounded-[calc(var(--radius-sm)-2px)] px-3 py-1.5 text-sm font-medium transition-colors",
            mode === value
              ? "bg-surface text-ink shadow-[0_1px_2px_rgba(20,20,15,0.06)]"
              : "text-ink-muted hover:text-ink",
          )}
        >
          {value === "entrar" ? "Entrar" : "Criar conta"}
        </button>
      ))}
    </div>
  );
}
