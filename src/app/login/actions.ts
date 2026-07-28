"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
  // Só aceito caminho relativo. Um "next" vindo da URL é entrada do usuário:
  // sem esta checagem, /login?next=https://outro-site vira um redirect aberto
  // que empresta a credibilidade do domínio para uma página de phishing.
  next: z
    .string()
    .optional()
    .transform((value) => (value?.startsWith("/") && !value.startsWith("//") ? value : "/hoje")),
});

export type LoginState = { error: string | null };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // A mensagem do Supabase vem em inglês e é genérica de propósito, para não
    // revelar se o e-mail existe. Mantenho essa propriedade ao traduzir.
    return { error: "E-mail ou senha incorretos." };
  }

  revalidatePath("/", "layout");
  redirect(parsed.data.next);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
