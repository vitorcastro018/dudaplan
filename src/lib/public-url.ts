/**
 * Origem pública do app — o endereço que o navegador usou para chegar aqui.
 *
 * Atrás do proxy do Coolify o container é alcançado em 0.0.0.0:6555, e o
 * domínio existe só nos cabeçalhos: nem `request.url` nem `request.nextUrl`
 * enxergam o domínio público. Toda URL que sai do servidor para o navegador
 * (redirect de login, link de confirmação de e-mail) precisa ser montada a
 * partir daqui, ou aponta para um endereço interno.
 *
 * Sobre confiar nesses cabeçalhos: quem fala direto com o container pode
 * forjá-los. O pior caso é a pessoa redirecionar a si mesma para outro host.
 * Com APP_ALLOWED_ORIGINS definida, o host precisa estar na lista; sem ela,
 * aceita-se o que o proxy mandou — que é o necessário para funcionar sem
 * configuração extra.
 */
export function resolvePublicOrigin(
  host: string | null,
  forwardedHost: string | null,
  forwardedProto: string | null,
  fallbackOrigin: string,
): string {
  const resolvedHost = forwardedHost ?? host;
  if (!resolvedHost) return fallbackOrigin;

  const allowed = (process.env.APP_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (allowed.length > 0 && !allowed.includes(resolvedHost)) {
    return fallbackOrigin;
  }

  // Sem X-Forwarded-Proto, assume http: é o que o proxy fala com o container.
  // Domínio configurado no Coolify sempre manda o cabeçalho, então na prática
  // o fallback só vale em acesso direto, onde http é o certo mesmo.
  return `${forwardedProto ?? "http"}://${resolvedHost}`;
}
