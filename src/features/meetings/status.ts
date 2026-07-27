export const MEETING_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  UPLOADED: "Áudio enviado",
  TRANSCRIBING: "Transcrevendo",
  ANALYZING: "Analisando",
  COMPLETED: "Concluída",
  FAILED: "Falhou",
};

export const MEETING_STATUS_TONE: Record<string, "neutral" | "ochre" | "pine" | "danger" | "plum"> =
  {
    DRAFT: "neutral",
    UPLOADED: "ochre",
    TRANSCRIBING: "plum",
    ANALYZING: "plum",
    COMPLETED: "pine",
    FAILED: "danger",
  };
