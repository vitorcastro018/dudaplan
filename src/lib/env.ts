import { z } from "zod";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

const envSchema = z.object({
  // Conexão com o Postgres. Em produção aponta para o serviço `db` do
  // docker-compose (postgres://usuario:senha@db:5432/dudaplan).
  DATABASE_URL: z.string().url(),
  APP_TIMEZONE: z.string().default("America/Sao_Paulo"),
  // Se definida, a tela de cadastro passa a exigir este código. Deixe vazia
  // para cadastro aberto. Ver o comentário em src/app/login/actions.ts.
  APP_SIGNUP_CODE: z.string().min(1).optional(),
  UPLOAD_DIR: z.string().default("./data/uploads"),
  MAX_UPLOAD_MB: z.coerce.number().default(200),
});

// `next build` importa cada módulo de rota para coletar os dados das páginas, o
// que avalia este arquivo mesmo sem nenhuma requisição acontecer — então ele não
// pode explodir só porque os segredos ainda não estão presentes. Nas outras
// fases a validação é pra valer.
const isBuildPhase = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD;

const buildPlaceholders = {
  DATABASE_URL: "postgres://placeholder:placeholder@localhost:5432/placeholder",
};

// Uma plataforma de deploy entrega string vazia para uma variável registrada mas
// sem valor, em vez de deixá-la ausente — o Coolify faz isso tanto em build arg
// quanto no ambiente do container. O `.default()` do Zod só preenche
// `undefined`, então a string vazia passa direto e chega no app como "": um
// APP_TIMEZONE vazio faz o Intl.DateTimeFormat lançar "Invalid time zone
// specified", e um MAX_UPLOAD_MB vazio vira 0 e rejeita todo upload. Normalizar
// vazio para ausente deixa os defaults fazerem o trabalho deles.
function withoutEmptyValues(source: NodeJS.ProcessEnv): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ""));
}

export const env = envSchema.parse(
  isBuildPhase
    ? { ...buildPlaceholders, ...withoutEmptyValues(process.env) }
    : withoutEmptyValues(process.env),
);
