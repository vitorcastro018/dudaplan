import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { env } from "@/lib/env";

const UPLOAD_ROOT = path.resolve(process.cwd(), env.UPLOAD_DIR);

function meetingDir(meetingId: string) {
  return path.join(UPLOAD_ROOT, "meetings", meetingId);
}

export function resolveAudioPath(relativePath: string) {
  const resolved = path.resolve(UPLOAD_ROOT, relativePath);
  if (!resolved.startsWith(UPLOAD_ROOT)) {
    throw new Error("Caminho de áudio inválido.");
  }
  return resolved;
}

export async function saveMeetingAudio(
  meetingId: string,
  webStream: ReadableStream<Uint8Array>,
  extension: string,
): Promise<{ relativePath: string; sizeBytes: number }> {
  const dir = meetingDir(meetingId);
  await mkdir(dir, { recursive: true });

  const filename = `audio.${extension}`;
  const finalPath = path.join(dir, filename);
  const tempPath = `${finalPath}.part`;

  await pipeline(Readable.fromWeb(webStream as never), createWriteStream(tempPath));
  await rename(tempPath, finalPath);

  const info = await stat(finalPath);
  const relativePath = path.relative(UPLOAD_ROOT, finalPath);

  return { relativePath, sizeBytes: info.size };
}

export async function deleteMeetingAudioDir(meetingId: string) {
  await rm(meetingDir(meetingId), { recursive: true, force: true });
}
