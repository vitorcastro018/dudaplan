"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

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

export type LoginState = { error: string | null; message?: string | null };

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

const signupSchema = credentialsSchema.safeExtend({
  name: z.string().trim().min(1, "Diga como quer ser chamado.").max(120),
  // O Supabase recusa senha curta, mas com uma mensagem em inglês e só depois
  // da ida ao servidor. Checar aqui dá o retorno na hora e em português.
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres."),
  code: z.string().optional(),
});

export async function signup(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    code: formData.get("code") ?? undefined,
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // Trava opcional de cadastro. O app fica num domínio público, e sem isto
  // qualquer pessoa que descubra a URL cria uma conta. Não vaza dado — o RLS dá
  // a cada conta o seu próprio workspace — mas enche o projeto de gente que você
  // não convidou. Definindo APP_SIGNUP_CODE, só quem tem o código entra.
  if (env.APP_SIGNUP_CODE && parsed.data.code !== env.APP_SIGNUP_CODE) {
    return { error: "Código de convite inválido." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name } },
  });

  if (error) {
    // "User already registered" é a mensagem do Supabase e vaza a existência da
    // conta. Aqui isso é aceitável e útil: é um app pessoal, e a alternativa
    // seria deixar você travado sem entender por que o cadastro não completa.
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "Já existe uma conta com esse e-mail. Tente entrar." };
    }
    return { error: error.message };
  }

  // Sem sessão na resposta, o projeto exige confirmação por e-mail. Dizer isso
  // é melhor que redirecionar para uma tela que vai rejeitar o acesso.
  if (!data.session) {
    return {
      error: null,
      message:
        "Conta criada. Confirme pelo link enviado ao seu e-mail para entrar. " +
        "Se o e-mail não chegar, desligue a confirmação em Authentication > " +
        "Providers > Email, no painel do Supabase.",
    };
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
