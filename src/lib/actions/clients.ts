"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { queryOne, updateOwned } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { errorMessage } from "@/lib/utils";
import type { ActionResult } from "@/lib/actions/tasks";
import type { ClientRow } from "@/lib/types";

/** Devolve o id: quem cria de dentro de outro formulário precisa dele para já selecionar. */
export type CreateClientResult = { ok: true; id: string } | { ok: false; error: string };

const nameField = z.string().trim().min(1, "Dê um nome ao cliente.").max(200);
const textField = z.string().trim().max(2000).nullable().optional();

// Sem `export`: arquivo "use server" trata todo export como Server Function.
const createClientSchema = z.object({
  name: nameField,
  description: textField,
  contact: textField,
});

// Do zero, e não `.partial()`, pelo mesmo motivo de sempre — ver validation/tasks.ts.
const updateClientSchema = z.object({
  name: nameField.optional(),
  description: textField,
  contact: textField,
});

function revalidate() {
  revalidatePath("/clientes", "layout");
  // O nome do cliente aparece nos seletores e cards de projetos, tarefas e reuniões.
  revalidatePath("/projetos", "layout");
  revalidatePath("/tarefas");
  revalidatePath("/reunioes", "layout");
  revalidatePath("/hoje");
}

export async function createClient(formData: FormData): Promise<CreateClientResult> {
  const parsed = createClientSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || null,
    contact: formData.get("contact") || null,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const userId = await requireUser();

  try {
    const created = await queryOne<{ id: string }>(
      `insert into clients (user_id, name, description, contact)
       values ($1, $2, $3, $4) returning id`,
      [userId, parsed.data.name, parsed.data.description ?? null, parsed.data.contact ?? null],
    );
    revalidate();
    return { ok: true, id: created!.id };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function updateClient(clientId: string, input: unknown): Promise<ActionResult> {
  const parsed = updateClientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const userId = await requireUser();

  const patch: Partial<ClientRow> = {};
  const { data } = parsed;
  if (data.name !== undefined) patch.name = data.name;
  if (data.description !== undefined) patch.description = data.description;
  if (data.contact !== undefined) patch.contact = data.contact;
  if (Object.keys(patch).length === 0) return { ok: true };

  try {
    await updateOwned("clients", clientId, userId, patch);
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }

  revalidate();
  return { ok: true };
}

/** Arquiva o cliente. Projetos, tarefas e reuniões continuam existindo, só perdem o rótulo na lista. */
export async function archiveClient(clientId: string): Promise<ActionResult> {
  const userId = await requireUser();

  try {
    await updateOwned("clients", clientId, userId, { archived_at: new Date().toISOString() });
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }

  revalidate();
  return { ok: true };
}
