import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { requireApiSession } from "@/lib/auth/guard";
import { saveMeetingAudio, resolveAudioPath } from "@/lib/storage/audio";
import { ok, unauthorized, notFound, fail, handleApiError } from "@/lib/http";

export const runtime = "nodejs";

const EXTENSION_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();
    const { meetingId } = await params;

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) return notFound();

    const formData = await request.formData();
    const file = formData.get("file");
    const durationSecondsRaw = formData.get("durationSeconds");

    if (!(file instanceof File)) {
      return fail(400, "missing_file", "Nenhum arquivo de áudio enviado.");
    }

    if (file.size > env.MAX_UPLOAD_MB * 1024 * 1024) {
      return fail(413, "file_too_large", `O arquivo excede o limite de ${env.MAX_UPLOAD_MB}MB.`);
    }

    const extension =
      EXTENSION_BY_MIME[file.type] ?? file.name.split(".").pop()?.toLowerCase() ?? "webm";

    const { relativePath, sizeBytes } = await saveMeetingAudio(meetingId, file.stream(), extension);

    const durationSeconds = durationSecondsRaw ? Number(durationSecondsRaw) : null;

    const updated = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        audioPath: relativePath,
        audioMimeType: file.type || "audio/webm",
        audioSizeBytes: sizeBytes,
        durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
        status: "UPLOADED",
      },
    });

    return ok(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  try {
    if (!(await requireApiSession(request))) return unauthorized();
    const { meetingId } = await params;

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting?.audioPath) return notFound("Áudio não encontrado.");

    const absolutePath = resolveAudioPath(meeting.audioPath);
    const info = await stat(absolutePath);
    const contentType = meeting.audioMimeType || "application/octet-stream";

    const range = request.headers.get("range");
    if (range) {
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      const start = match ? Number(match[1]) : 0;
      const end = match && match[2] ? Number(match[2]) : info.size - 1;
      const chunkSize = end - start + 1;

      const stream = createReadStream(absolutePath, { start, end });
      return new NextResponse(Readable.toWeb(stream) as unknown as ReadableStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${info.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Content-Type": contentType,
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
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
