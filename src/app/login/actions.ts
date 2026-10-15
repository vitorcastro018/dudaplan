"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { env } from "@/lib/env";
import { queryOne } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/session";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.string().email("Informe um e-mail válido.")),
  password: z.string().min(1, "Informe a senha."),
  // Só aceito caminho relativo. Um "next" vindo da URL é entrada do usuário:
  // sem esta checagem, /login?next=https://outro-site vira um redirect aberto
  // que empresta a credibilidade do domínio para uma página de phishing.
  next: z
    .string()
    .optional()
    .transform((value) => (value?.startsWith("/") && !value.startsWith("//") ? value : "/hoje")),
});

// Hash de uma senha que ninguém tem. Quando o e-mail não existe, o login ainda
// gasta o mesmo tempo de um scrypt de verdade — sem isso, a resposta mais
// rápida denunciaria quais e-mails têm conta.
const DUMMY_HASH = "scrypt$131072$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==";

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

  const user = await queryOne<{ id: string; password_hash: string }>(
    "select id, password_hash from users where email = $1",
    [parsed.data.email],
  );

  const valid = await verifyPassword(parsed.data.password, user?.password_hash ?? DUMMY_HASH);

  // Mensagem única para "e-mail não existe" e "senha errada", para não revelar
  // quais e-mails têm conta.
  if (!user || !valid) return { error: "E-mail ou senha incorretos." };

  await createSession(user.id);

  revalidatePath("/", "layout");
  redirect(parsed.data.next);
}

const signupSchema = credentialsSchema.safeExtend({
  name: z.string().trim().min(1, "Diga como quer ser chamado.").max(120),
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
  // qualquer pessoa que descubra a URL cria uma conta. Não vaza dado — cada
  // conta só enxerga o que é dela — mas enche o banco de gente que você não
  // convidou. Definindo APP_SIGNUP_CODE, só quem tem o código entra.
  if (env.APP_SIGNUP_CODE && parsed.data.code !== env.APP_SIGNUP_CODE) {
    return { error: "Código de convite inválido." };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  // `on conflict do nothing` e não um select antes: dois cadastros simultâneos
  // com o mesmo e-mail não passam os dois pela checagem. É um app pessoal, então
  // dizer que o e-mail já existe é útil e não um vazamento relevante.
  const created = await queryOne<{ id: string }>(
    `insert into users (email, name, password_hash) values ($1, $2, $3)
     on conflict (email) do nothing returning id`,
    [parsed.data.email, parsed.data.name, passwordHash],
  );

  if (!created) return { error: "Já existe uma conta com esse e-mail. Tente entrar." };

  await createSession(created.id);

  revalidatePath("/", "layout");
  redirect(parsed.data.next);
}

export async function logout() {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/login");
}
