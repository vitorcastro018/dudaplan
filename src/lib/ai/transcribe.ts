import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { createReadStream } from "node:fs";
import os from "node:os";
import path from "node:path";
import { openai } from "./client";
import { env } from "@/lib/env";

const execFileAsync = promisify(execFile);

const MAX_SINGLE_REQUEST_BYTES = 24 * 1024 * 1024;
const SEGMENT_SECONDS = 600;

async function callTranscription(filePath: string, model: string, transcriptionPrompt: string) {
  const result = await openai.audio.transcriptions.create({
    file: createReadStream(filePath),
    model,
    language: "pt",
    response_format: "json",
    prompt: transcriptionPrompt,
  });
  return result.text;
}

async function splitAudioIntoChunks(absolutePath: string, tempDir: string): Promise<string[]> {
  const pattern = path.join(tempDir, "chunk_%03d" + path.extname(absolutePath));

  await execFileAsync("ffmpeg", [
    "-i",
    absolutePath,
    "-f",
    "segment",
    "-segment_time",
    String(SEGMENT_SECONDS),
    "-c",
    "copy",
    pattern,
  ]);

  const files = (await readdir(tempDir)).filter((f) => f.startsWith("chunk_")).sort();
  if (files.length === 0) throw new Error("Falha ao dividir o áudio em segmentos.");

  return files.map((f) => path.join(tempDir, f));
}

export interface TranscriptionResult {
  text: string;
  model: string;
}

export async function transcribeMeetingAudio(
  absolutePath: string,
  sizeBytes: number,
  promptContext: string,
): Promise<TranscriptionResult> {
  const transcriptionPrompt = promptContext.slice(0, 800);
  let tempDir: string | null = null;

  try {
    const chunkPaths =
      sizeBytes <= MAX_SINGLE_REQUEST_BYTES
        ? [absolutePath]
        : await (async () => {
            tempDir = await mkdtemp(path.join(os.tmpdir(), "dudaplan-audio-"));
            return splitAudioIntoChunks(absolutePath, tempDir);
          })();

    let model = env.OPENAI_TRANSCRIBE_MODEL;
    const texts: string[] = [];

    for (let i = 0; i < chunkPaths.length; i++) {
      try {
        texts.push(await callTranscription(chunkPaths[i], model, transcriptionPrompt));
      } catch (error) {
        if (i === 0 && model !== "whisper-1") {
          model = "whisper-1";
          texts.push(await callTranscription(chunkPaths[i], model, transcriptionPrompt));
        } else {
          throw error;
        }
      }
    }

    return { text: texts.join("\n\n"), model };
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  }
}
