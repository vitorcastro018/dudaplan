import { z } from "zod";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

// Por que nenhuma variável do Supabase leva o prefixo NEXT_PUBLIC_:
//
// O Next substitui `process.env.NEXT_PUBLIC_X` pelo valor literal durante o
// `next build`. Num build de Docker os segredos de runtime ainda não existem —
// só build args — então o bundle do navegador sairia com o placeholder gravado
// dentro e o app iria pro ar apontando para "placeholder.supabase.co", sem
// nenhum erro no build para avisar. Exigir que a URL e a chave sejam build args
// resolveria, mas amarra o deploy a acertar build arg, que já foi fonte de
// falha silenciosa aqui (variável registrada e vazia sobrescrevendo o default).
//
// Como todo acesso a dados acontece em Server Component ou Server Action, o
// navegador nunca precisa da chave. Assim estas ficam sendo variáveis de
// runtime comuns: mudar uma delas é reiniciar o container, não rebuildar.
const envSchema = z
  .object({
    SUPABASE_URL: z.string().url(),
    // O painel renomeou a chave pública de "anon" para "publishable", e
    // projetos criados em épocas diferentes mostram uma ou outra. As duas
    // servem no mesmo parâmetro do cliente, então aceito qualquer uma em vez de
    // exigir que o nome bata com a versão do painel que você tem na tela.
    SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
    SUPABASE_ANON_KEY: z.string().min(1).optional(),
    APP_TIMEZONE: z.string().default("America/Sao_Paulo"),
    // Opcional enquanto as reuniões estiverem fora (fatia 1). Exigir uma chave
    // que nada usa só criaria um motivo a mais para o container não subir.
    // Volta a ser obrigatória quando o pipeline de IA voltar.
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_TRANSCRIBE_MODEL: z.string().default("gpt-4o-transcribe"),
    OPENAI_ANALYSIS_MODEL: z.string().default("gpt-4o-mini"),
    UPLOAD_DIR: z.string().default("./data/uploads"),
    MAX_UPLOAD_MB: z.coerce.number().default(200),
  })
  .transform((value, ctx) => {
    const key = value.SUPABASE_PUBLISHABLE_KEY ?? value.SUPABASE_ANON_KEY;

    if (!key) {
      ctx.addIssue({
        code: "custom",
        message:
          "Defina SUPABASE_PUBLISHABLE_KEY (ou SUPABASE_ANON_KEY). " +
          "A chave está em Project Settings > API Keys no painel do Supabase. " +
          "Use a publicável, nunca a service_role — ela ignora o RLS.",
        path: ["SUPABASE_PUBLISHABLE_KEY"],
      });
      return z.NEVER;
    }

    return { ...value, SUPABASE_KEY: key };
  });

// `next build` importa cada módulo de rota para coletar os dados das páginas, o
// que avalia este arquivo mesmo sem nenhuma requisição acontecer — então ele não
// pode explodir só porque os segredos ainda não estão presentes. Nas outras
// fases a validação é pra valer.
const isBuildPhase = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD;

const buildPlaceholders = {
  SUPABASE_URL: "https://placeholder.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "placeholder",
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
