import type { NextConfig } from "next";

// Domínios de onde as Server Actions podem ser chamadas.
//
// O Next compara o `Origin` da requisição com o `Host` (ou `X-Forwarded-Host`)
// e rejeita divergência, como proteção contra CSRF. Atrás do proxy do Coolify o
// container não enxerga o domínio público diretamente: se o proxy não repassar
// o cabeçalho, a checagem falha e **nenhuma** mutação funciona — nem login, nem
// criar tarefa — com um erro que não diz que a causa é essa.
//
// Normalmente o Traefik repassa e nada disso é necessário. Esta variável existe
// para o caso em que não repassa, e para domínio adicional (staging, apex +
// www). Aceita lista separada por vírgula: "app.exemplo.com,*.exemplo.com".
const allowedOrigins = (process.env.APP_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  output: "standalone",
  ...(allowedOrigins.length > 0
    ? { experimental: { serverActions: { allowedOrigins } } }
    : {}),
};

export default nextConfig;
