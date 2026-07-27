export const PROJECT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  DONE: "Concluído",
  ARCHIVED: "Arquivado",
};

export const PROJECT_STATUS_TONE: Record<string, "accent" | "pine" | "ochre" | "neutral"> = {
  ACTIVE: "pine",
  PAUSED: "ochre",
  DONE: "accent",
  ARCHIVED: "neutral",
};
