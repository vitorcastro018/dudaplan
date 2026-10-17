"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Mic, Square, Pause, Play, Trash2, TriangleAlert, Upload, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import type { RecordingRow } from "@/lib/types";
import { clearRecording, loadRecording, saveChunk, type SavedRecording } from "./recording-store";

type RecorderState = "idle" | "requesting" | "recording" | "paused" | "preview" | "uploading";

/**
 * O formato da gravação é escolhido pelo navegador, não por nós: o Chrome grava
 * WebM/Opus, o Safari grava MP4/AAC, e `MediaRecorder` não converte. mp3 e m4a
 * valem para o arquivo **anexado**, que sobe como está.
 */
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/webm",
];

const ACCEPTED_UPLOAD =
  "audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/webm,audio/ogg,.mp3,.m4a,.wav,.ogg,.webm";

function pickMimeType(): string {
  for (const candidate of MIME_CANDIDATES) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return "";
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export function MeetingAudio({
  meetingId,
  recording,
}: {
  meetingId: string;
  recording: RecordingRow | null;
}) {
  const router = useRouter();
  const [state, setState] = React.useState<RecorderState>("idle");
  const [elapsed, setElapsed] = React.useState(0);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const mimeTypeRef = React.useRef<string>("");
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const wakeLockRef = React.useRef<WakeLockSentinel | null>(null);
  // O tempo vem do relógio, não de contar ticks: `setInterval` é atrasado em
  // aba em segundo plano e a duração sairia menor que a real.
  const accumulatedMsRef = React.useRef(0);
  const segmentStartRef = React.useRef<number | null>(null);
  const [micMuted, setMicMuted] = React.useState(false);
  const [recovered, setRecovered] = React.useState<SavedRecording | null>(null);

  const stateRef = React.useRef(state);
  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  React.useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      wakeLockRef.current?.release().catch(() => {});
    };
  }, []);

  // Gravação deixada pela visita anterior (aba fechada ou morta no meio).
  React.useEffect(() => {
    let cancelled = false;
    loadRecording(meetingId).then((saved) => {
      if (!cancelled && saved) setRecovered(saved);
    });
    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  async function acquireWakeLock() {
    try {
      if (!("wakeLock" in navigator)) return;
      wakeLockRef.current = await navigator.wakeLock.request("screen");
    } catch {
      // Negado (economia de bateria) ou sem suporte: grava mesmo assim.
    }
  }

  function releaseWakeLock() {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }

  // O navegador solta o wake lock sempre que a aba some; ao voltar, pega de novo
  // e atualiza o cronômetro, que não andou enquanto a aba estava escondida.
  React.useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      if (stateRef.current === "recording") {
        setElapsed(Math.floor(getElapsedMs() / 1000));
        acquireWakeLock();
        const recorder = recorderRef.current;
        if (recorder && recorder.state === "inactive") {
          toast.error("A gravação foi interrompida pelo sistema. O que foi gravado foi mantido.");
        }
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  React.useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (state === "recording" || state === "paused" || state === "uploading") {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [state]);

  function getElapsedMs() {
    const running = segmentStartRef.current ? Date.now() - segmentStartRef.current : 0;
    return accumulatedMsRef.current + running;
  }

  function startTimer() {
    segmentStartRef.current = Date.now();
    timerRef.current = setInterval(() => setElapsed(Math.floor(getElapsedMs() / 1000)), 1000);
  }

  function stopTimer() {
    if (segmentStartRef.current) {
      accumulatedMsRef.current += Date.now() - segmentStartRef.current;
      segmentStartRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setElapsed(Math.floor(accumulatedMsRef.current / 1000));
  }

  async function handleStart() {
    setState("requesting");
    setRecovered(null);
    setMicMuted(false);
    await clearRecording(meetingId);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      mimeTypeRef.current = mimeType;
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType, audioBitsPerSecond: 32000 } : undefined,
      );
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size === 0) return;
        chunksRef.current.push(e.data);
        saveChunk(meetingId, e.data, mimeTypeRef.current, getElapsedMs());
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || "audio/webm" });
        setPreviewUrl(URL.createObjectURL(blob));
        setState("preview");
        stopTimer();
        releaseWakeLock();
        setMicMuted(false);
        stream.getTracks().forEach((track) => track.stop());
      };

      // Quando o sistema tira o microfone (celular travado, ligação, outro app
      // usando o áudio) a faixa fica muda ou termina; avisar é melhor que deixar
      // a pessoa achar que segue gravando.
      stream.getAudioTracks().forEach((track) => {
        track.onmute = () => setMicMuted(true);
        track.onunmute = () => setMicMuted(false);
        track.onended = () => {
          if (recorder.state !== "inactive") recorder.stop();
          toast.error("O microfone foi desligado pelo sistema. A gravação até aqui foi mantida.");
        };
      });

      // Fatias de 5s: cada uma vai para `chunksRef` e para o IndexedDB, então se
      // a aba morrer no meio o que já foi entregue ainda pode ser recuperado.
      recorder.start(5000);
      recorderRef.current = recorder;
      accumulatedMsRef.current = 0;
      segmentStartRef.current = null;
      setElapsed(0);
      startTimer();
      setState("recording");
      acquireWakeLock();
    } catch (error) {
      setState("idle");
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        toast.error("Permita o acesso ao microfone para gravar a reunião.");
      } else if (error instanceof DOMException && error.name === "NotFoundError") {
        toast.error("Nenhum microfone encontrado.");
      } else {
        toast.error(
          "Não foi possível iniciar a gravação. Gravar pelo microfone exige HTTPS ou localhost.",
        );
      }
    }
  }

  function handlePause() {
    recorderRef.current?.pause();
    stopTimer();
    setState("paused");
  }

  function handleResume() {
    recorderRef.current?.resume();
    startTimer();
    setState("recording");
  }

  function handleStop() {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }

  function handleDiscard() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    chunksRef.current = [];
    accumulatedMsRef.current = 0;
    setElapsed(0);
    setState("idle");
    clearRecording(meetingId);
  }

  function handleRecover() {
    if (!recovered) return;
    chunksRef.current = recovered.chunks;
    mimeTypeRef.current = recovered.mimeType;
    accumulatedMsRef.current = recovered.elapsedMs;
    const blob = new Blob(recovered.chunks, { type: recovered.mimeType || "audio/webm" });
    setPreviewUrl(URL.createObjectURL(blob));
    setElapsed(Math.floor(recovered.elapsedMs / 1000));
    setRecovered(null);
    setState("preview");
  }

  function handleDiscardRecovered() {
    setRecovered(null);
    clearRecording(meetingId);
  }

  function uploadBlob(blob: Blob, filename: string, durationSeconds: number) {
    setState("uploading");
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", blob, filename);
    formData.append("durationSeconds", String(durationSeconds));

    // XHR e não `fetch`: só ele reporta progresso de upload, e um arquivo de
    // dezenas de MB sem barra parece travado.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/meetings/${meetingId}/audio`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        toast.success("Áudio enviado.");
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        chunksRef.current = [];
        accumulatedMsRef.current = 0;
        setElapsed(0);
        setState("idle");
        if (previewUrl) clearRecording(meetingId);
        // O upload é Route Handler, então não passa por `revalidatePath` —
        // é este refresh que traz a gravação nova para a tela.
        router.refresh();
      } else {
        toast.error(errorMessage(xhr));
        setState(previewUrl ? "preview" : "idle");
      }
    };

    xhr.onerror = () => {
      toast.error("Falha ao enviar o áudio.");
      setState(previewUrl ? "preview" : "idle");
    };

    xhr.send(formData);
  }

  function handleUploadRecording() {
    const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || "audio/webm" });
    const extension = mimeTypeRef.current.includes("ogg")
      ? "ogg"
      : mimeTypeRef.current.includes("mp4")
        ? "m4a"
        : "webm";
    uploadBlob(blob, `gravacao-${Date.now()}.${extension}`, elapsed);
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Duração 0: um arquivo anexado não traz essa informação, e lê-la exigiria
    // decodificar o áudio. A rota grava `null` em vez de mentir um número.
    uploadBlob(file, file.name, 0);
    e.target.value = "";
  }

  function handleDeleteRecording() {
    fetch(`/api/meetings/${meetingId}/audio`, { method: "DELETE" })
      .then((response) => {
        if (!response.ok) throw new Error();
        toast.success("Áudio removido.");
        router.refresh();
      })
      .catch(() => toast.error("Não foi possível remover o áudio."));
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {recording && (
        <div className="border-line bg-surface flex flex-col gap-3 rounded-[var(--radius-lg)] border p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="section-label">Gravação desta reunião</p>
            <span className="text-ink-muted font-mono text-xs tabular-nums">
              {[
                recording.duration_sec ? formatElapsed(recording.duration_sec) : null,
                formatSize(recording.size_bytes),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>

          {/* `key` no caminho do arquivo: trocar só o `src` não faz o player
              recarregar de forma confiável depois de substituir o áudio. */}
          <audio
            key={recording.storage_path}
            controls
            preload="metadata"
            src={`/api/meetings/${meetingId}/audio`}
            className="w-full"
          />

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              Remover áudio
            </Button>
          </div>
        </div>
      )}

      <div className="border-line bg-surface rounded-[var(--radius-lg)] border p-5">
        {state === "idle" && (
          <div className="flex flex-col gap-3">
            {recovered && (
              <div className="border-line bg-paper-sunk flex flex-col gap-3 rounded-[var(--radius-lg)] border p-4">
                <p className="text-ink text-sm">
                  Há uma gravação não enviada desta reunião (
                  {formatElapsed(recovered.elapsedMs / 1000)}
                  ). Ela ficou salva neste navegador quando a página foi fechada ou interrompida.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleRecover}>
                    Recuperar gravação
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleDiscardRecovered}>
                    Descartar
                  </Button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleStart}>
                <Mic className="h-4 w-4" />
                {recording ? "Gravar de novo" : "Gravar reunião"}
              </Button>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" />
                Anexar arquivo de áudio
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_UPLOAD}
                className="hidden"
                onChange={handleFileSelected}
              />
            </div>
            <p className="text-ink-muted text-xs">
              Anexar aceita mp3, m4a, wav, ogg e webm. A gravação pelo microfone usa o formato que o
              navegador oferece (WebM no Chrome, MP4 no Safari) e exige HTTPS ou localhost. No
              celular, mantenha esta tela aberta durante a gravação: ela não apaga sozinha, mas
              travar o aparelho ou trocar de app pode interromper o microfone.
              {recording && " Enviar um novo áudio substitui o atual."}
            </p>
          </div>
        )}

        {state === "requesting" && (
          <p className="text-ink-muted text-sm">Solicitando acesso ao microfone...</p>
        )}

        {(state === "recording" || state === "paused") && (
          <div className="flex flex-col gap-4">
            {micMuted && (
              <p className="text-danger flex items-start gap-2 text-sm">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />O microfone está mudo (celular
                travado ou outro app usando o áudio). Volte para esta tela para continuar gravando.
              </p>
            )}
            <div className="flex items-center gap-4">
              <span
                className={
                  "h-3 w-3 rounded-full " +
                  (state === "recording" ? "bg-danger animate-pulse" : "bg-ochre")
                }
              />
              <span className="text-ink font-mono text-lg tabular-nums">
                {formatElapsed(elapsed)}
              </span>
              <div className="ml-auto flex gap-2">
                {state === "recording" ? (
                  <Button variant="secondary" size="sm" onClick={handlePause}>
                    <Pause className="h-3.5 w-3.5" />
                    Pausar
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" onClick={handleResume}>
                    <Play className="h-3.5 w-3.5" />
                    Retomar
                  </Button>
                )}
                <Button variant="danger" size="sm" onClick={handleStop}>
                  <Square className="h-3.5 w-3.5" />
                  Parar
                </Button>
              </div>
            </div>
          </div>
        )}

        {state === "preview" && previewUrl && (
          <div className="flex flex-col gap-3">
            <p className="section-label">Prévia — {formatElapsed(elapsed)}</p>
            <audio controls src={previewUrl} className="w-full" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleDiscard}>
                <Trash2 className="h-4 w-4" />
                Descartar
              </Button>
              <Button onClick={handleUploadRecording}>
                <UploadCloud className="h-4 w-4" />
                Enviar
              </Button>
            </div>
          </div>
        )}

        {state === "uploading" && (
          <div>
            <p className="text-ink-muted mb-2 text-sm">Enviando áudio... {uploadProgress}%</p>
            <div className="bg-paper-sunk h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="bg-accent h-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDeleteRecording}
        title="Remover áudio"
        description="O arquivo será apagado do servidor. A reunião continua com os demais campos."
        confirmLabel="Remover"
      />
    </div>
  );
}

/** A rota devolve `{ error: { message } }` — ver `src/lib/http.ts`. Sem isto o
 *  "arquivo maior que 200MB" viraria um genérico "falha ao enviar". */
function errorMessage(xhr: XMLHttpRequest): string {
  try {
    const parsed = JSON.parse(xhr.responseText);
    if (typeof parsed?.error?.message === "string") return parsed.error.message;
  } catch {
    // resposta não-JSON (proxy, timeout): cai na mensagem genérica
  }
  return "Falha ao enviar o áudio.";
}
