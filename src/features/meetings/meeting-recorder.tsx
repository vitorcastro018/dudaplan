"use client";

import * as React from "react";
import { Mic, Square, Pause, Play, Trash2, Upload, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type RecorderState = "idle" | "requesting" | "recording" | "paused" | "preview" | "uploading";

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/webm",
];

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

export function MeetingRecorder({
  meetingId,
  onUploaded,
}: {
  meetingId: string;
  onUploaded: () => void;
}) {
  const [state, setState] = React.useState<RecorderState>("idle");
  const [elapsed, setElapsed] = React.useState(0);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = React.useState(0);

  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const mimeTypeRef = React.useRef<string>("");
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  React.useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (state === "recording" || state === "paused") {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [state]);

  function startTimer() {
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function handleStart() {
    setState("requesting");
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
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || "audio/webm" });
        setPreviewUrl(URL.createObjectURL(blob));
        setState("preview");
        stopTimer();
      };

      recorder.start(5000);
      recorderRef.current = recorder;
      setElapsed(0);
      startTimer();
      setState("recording");
    } catch (error) {
      setState("idle");
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        toast.error("Permita o acesso ao microfone para gravar a reunião.");
      } else if (error instanceof DOMException && error.name === "NotFoundError") {
        toast.error("Nenhum microfone encontrado.");
      } else {
        toast.error("Não foi possível iniciar a gravação.");
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
    setElapsed(0);
    setState("idle");
  }

  function uploadBlob(blob: Blob, filename: string) {
    setState("uploading");
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", blob, filename);
    formData.append("durationSeconds", String(elapsed));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/meetings/${meetingId}/audio`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        toast.success("Áudio enviado com sucesso.");
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setState("idle");
        onUploaded();
      } else {
        toast.error("Falha ao enviar o áudio.");
        setState("preview");
      }
    };

    xhr.onerror = () => {
      toast.error("Falha ao enviar o áudio.");
      setState("preview");
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
    uploadBlob(blob, `gravacao-${Date.now()}.${extension}`);
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setElapsed(0);
    uploadBlob(file, file.name);
    e.target.value = "";
  }

  return (
    <div className="border-line bg-surface rounded-[var(--radius-lg)] border p-5">
      {state === "idle" && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleStart}>
            <Mic className="h-4 w-4" />
            Gravar reunião
          </Button>
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            Enviar arquivo de áudio
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleFileSelected}
          />
        </div>
      )}

      {state === "requesting" && (
        <p className="text-ink-muted text-sm">Solicitando acesso ao microfone...</p>
      )}

      {(state === "recording" || state === "paused") && (
        <div className="flex items-center gap-4">
          <span
            className={
              "h-3 w-3 rounded-full " +
              (state === "recording" ? "bg-danger animate-pulse" : "bg-ochre")
            }
          />
          <span className="text-ink font-mono text-lg tabular-nums">{formatElapsed(elapsed)}</span>
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
      )}

      {state === "preview" && previewUrl && (
        <div className="flex flex-col gap-3">
          <audio controls src={previewUrl} className="w-full" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleDiscard}>
              <Trash2 className="h-4 w-4" />
              Descartar
            </Button>
            <Button onClick={handleUploadRecording}>
              <UploadCloud className="h-4 w-4" />
              Enviar e processar
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
  );
}
