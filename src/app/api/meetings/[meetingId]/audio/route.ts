import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { createClient, getAuthClaims } from "@/lib/supabase/server";
import { getMeetingRecording } from "@/lib/data/meetings";
import { deleteMeetingAudioDir, resolveAudioPath, saveMeetingAudio } from "@/lib/storage/audio";
import { fail, handleApiError, notFound, ok, unauthorized } from "@/lib/http";

export const runtime = "nodejs";

/**
 * Por que o áudio entra por uma Route Handler e não por uma Server Action:
 * o corpo de uma Server Action é limitado a 1 MB por padrão, e `MAX_UPLOAD_MB`
 * vale 200. Subir esse limite ainda esbarraria no fato de que a Server Action
 * recebe o arquivo inteiro em memória, enquanto aqui `file.stream()` vai
 * direto para o disco.
 *
 * Esta rota também está **fora** do matcher de `src/proxy.ts`, de propósito:
 * quando o proxy roda, o Next clona e bufferiza o corpo em memória com teto de
 * 10 MB e, acima disso, **trunca em silêncio** — um m4a de 30 MB chegaria pela
 * metade sem erro nenhum. Em troca, a checagem de sessão é feita aqui dentro.
 */

const EXTENSION_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "m4a",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

const ALLOWED_EXTENSIONS = new Set(["webm", "ogg", "m4a", "mp3", "wav", "mp4"]);

/**
 * Extensão do arquivo, pelo MIME quando ele é conhecido.
 *
 * O nome é a segunda opção porque o navegador nem sempre manda um `type` útil
 * (um `.m4a` no Firefox costuma chegar como string vazia). A lista fechada
 * existe para que nada além de áudio seja gravado: `saveMeetingAudio` monta o
 * caminho com o valor devolvido aqui, e aceitar "php" seria escrever um arquivo
 * executável dentro do volume.
 */
function resolveExtension(file: File): string | null {
  const byMime = EXTENSION_BY_MIME[file.type.toLowerCase()];
  if (byMime) return byMime;

  const byName = file.name.split(".").pop()?.toLowerCase();
  return byName && ALLOWED_EXTENSIONS.has(byName) ? byName : null;
}

/** Sessão + reunião visível. O `select` já passa pelo RLS, então uma reunião de
 *  outro workspace volta como "não encontrada". */
async function requireMeeting(meetingId: string) {
  const claims = await getAuthClaims();
  if (!claims) return { error: unauthorized() as NextResponse };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select("id")
    .eq("id", meetingId)
    .maybeSingle();

  if (error) return { error: fail(500, "meeting_read_failed", error.message) };
  if (!data) return { error: notFound("Reunião não encontrada.") };

  return { supabase };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  try {
    const { meetingId } = await params;
    const guard = await requireMeeting(meetingId);
    if (guard.error) return guard.error;
    const supabase = guard.supabase;

    const formData = await request.formData();
    const file = formData.get("file");
    const durationRaw = formData.get("durationSeconds");

    if (!(file instanceof File)) {
      return fail(400, "missing_file", "Nenhum arquivo de áudio enviado.");
    }

    if (file.size === 0) {
      return fail(400, "empty_file", "O arquivo de áudio está vazio.");
    }

    if (file.size > env.MAX_UPLOAD_MB * 1024 * 1024) {
      return fail(413, "file_too_large", `O arquivo excede o limite de ${env.MAX_UPLOAD_MB}MB.`);
    }

    const extension = resolveExtension(file);
    if (!extension) {
      return fail(
        415,
        "unsupported_type",
        "Formato não suportado. Envie mp3, m4a, wav, ogg ou webm.",
      );
    }

    // Apaga a gravação anterior antes de escrever: só há uma por reunião, e o
    // arquivo velho pode ter outra extensão, então sobrescrever não bastaria —
    // sobrariam dois áudios no disco com um só na tabela.
    const previous = await getMeetingRecording(meetingId);
    if (previous) {
      await supabase.from("recordings").delete().eq("id", previous.id);
      await deleteMeetingAudioDir(meetingId);
    }

    const { relativePath, sizeBytes } = await saveMeetingAudio(meetingId, file.stream(), extension);

    const duration = durationRaw ? Number(durationRaw) : NaN;

    const { error } = await supabase.from("recordings").insert({
      meeting_id: meetingId,
      storage_path: relativePath,
      mime_type: file.type || `audio/${extension}`,
      size_bytes: sizeBytes,
      // Só o gravador sabe a duração; um arquivo anexado chega sem ela, e ler a
      // duração do arquivo exigiria decodificar o áudio no servidor.
      duration_sec: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null,
    });

    if (error) return fail(500, "recording_insert_failed", error.message);

    return ok({ storagePath: relativePath, sizeBytes });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  try {
    const { meetingId } = await params;
    const guard = await requireMeeting(meetingId);
    if (guard.error) return guard.error;

    const recording = await getMeetingRecording(meetingId);
    if (!recording) return notFound("Áudio não encontrado.");

    const absolutePath = resolveAudioPath(recording.storage_path);
    const info = await stat(absolutePath);
    const contentType = recording.mime_type || "application/octet-stream";

    // Sem resposta 206 o `<audio>` toca o arquivo mas não deixa arrastar a
    // barra: o navegador pede um trecho por `Range` e, se receber o arquivo
    // inteiro com 200, desiste de buscar posição.
    const range = request.headers.get("range");
    if (range) {
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      const start = match ? Number(match[1]) : 0;
      const end = match && match[2] ? Number(match[2]) : info.size - 1;

      if (start >= info.size || end >= info.size || start > end) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${info.size}` },
        });
      }

      const stream = createReadStream(absolutePath, { start, end });
      return new NextResponse(Readable.toWeb(stream) as unknown as ReadableStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${info.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(end - start + 1),
          "Content-Type": contentType,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const stream = createReadStream(absolutePath);
    return new NextResponse(Readable.toWeb(stream) as unknown as ReadableStream, {
      status: 200,
      headers: {
        "Content-Length": String(info.size),
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  try {
    const { meetingId } = await params;
    const guard = await requireMeeting(meetingId);
    if (guard.error) return guard.error;

    const { error } = await guard.supabase.from("recordings").delete().eq("meeting_id", meetingId);

    if (error) return fail(500, "recording_delete_failed", error.message);

    await deleteMeetingAudioDir(meetingId);

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
