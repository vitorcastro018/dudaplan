import { z } from "zod";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

const envSchema = z.object({
  // Conexão com o Postgres. Opcional: sem ela o driver usa as variáveis PG*
  // (PGHOST, PGUSER, PGPASSWORD, PGDATABASE), que é o que o docker-compose
  // define. Em desenvolvimento local, uma URL é mais prático.
  DATABASE_URL: z.string().url().optional(),
  APP_TIMEZONE: z.string().default("America/Sao_Paulo"),
  // Se definida, a tela de cadastro passa a exigir este código. Deixe vazia
  // para cadastro aberto. Ver o comentário em src/app/login/actions.ts.
  APP_SIGNUP_CODE: z.string().min(1).optional(),
  UPLOAD_DIR: z.string().default("./data/uploads"),
  MAX_UPLOAD_MB: z.coerce.number().default(200),
  // Resumo com IA das reuniões. Sem chave o botão continua na tela e avisa o que
  // falta, em vez de o recurso simplesmente sumir.
  OPENAI_API_KEY: z.string().min(1).optional(),
  // `whisper-1` por padrão: não tem teto de duração (só os 25 MB do arquivo),
  // ao contrário dos modelos gpt-4o-transcribe.
  OPENAI_TRANSCRIBE_MODEL: z.string().default("whisper-1"),
  OPENAI_SUMMARY_MODEL: z.string().default("gpt-4o-mini"),
});

// `next build` importa cada módulo de rota para coletar os dados das páginas, o
// que avalia este arquivo mesmo sem nenhuma requisição acontecer — então ele não
// pode explodir só porque os segredos ainda não estão presentes. Nas outras
// fases a validação é pra valer.
const isBuildPhase = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD;

const buildPlaceholders = {};

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
