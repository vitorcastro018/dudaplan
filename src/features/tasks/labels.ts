export const STATUS_LABELS: Record<string, string> = {
  TODO: "A fazer",
  DOING: "Em andamento",
  BLOCKED: "Bloqueado",
  DONE: "Concluído",
};

export const STATUS_ORDER = ["TODO", "DOING", "BLOCKED", "DONE"];

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
};

export const PRIORITY_TONE: Record<string, "neutral" | "ochre" | "danger"> = {
  LOW: "neutral",
  MEDIUM: "ochre",
  HIGH: "danger",
};
