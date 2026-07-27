import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { signSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session";
import { checkLoginRateLimit, resetLoginRateLimit } from "@/lib/auth/rate-limit";
import { ok, fail, handleApiError } from "@/lib/http";

export const runtime = "nodejs";

const loginSchema = z.object({ password: z.string().min(1) });

function timingSafeEqual(a: string, b: string) {
  const digestA = crypto.createHash("sha256").update(a).digest();
  const digestB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "local";
    const rateLimit = checkLoginRateLimit(ip);
    if (!rateLimit.allowed) {
      return fail(429, "rate_limited", "Muitas tentativas. Tente novamente em alguns minutos.");
    }

    const body = loginSchema.parse(await request.json());

    if (!timingSafeEqual(body.password, env.APP_PASSWORD)) {
      return fail(401, "invalid_password", "Senha incorreta.");
    }

    resetLoginRateLimit(ip);
    const token = await signSession();
    const response = ok({ success: true });
    response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
