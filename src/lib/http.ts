import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function ok<T>(data: T, init?: number) {
  return NextResponse.json({ data }, { status: init ?? 200 });
}

export function fail(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export function unauthorized() {
  return fail(401, "unauthorized", "Sessão inválida ou expirada.");
}

export function notFound(message = "Recurso não encontrado.") {
  return fail(404, "not_found", message);
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return fail(error.status, error.code, error.message);
  }
  if (error instanceof ZodError) {
    return fail(400, "validation_error", "Dados inválidos.", error.flatten());
  }
  console.error(error);
  return fail(500, "internal_error", "Erro interno inesperado.");
}
