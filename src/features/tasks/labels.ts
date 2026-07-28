import type { TaskStatus, TaskPriority } from "@/lib/supabase/types";

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "A fazer",
  in_progress: "Em andamento",
  waiting: "Aguardando",
  done: "Concluída",
  cancelled: "Cancelada",
};

export const TASK_STATUS_TONE: Record<
  TaskStatus,
  "neutral" | "accent" | "pine" | "ochre" | "plum" | "danger"
> = {
  backlog: "neutral",
  todo: "neutral",
  in_progress: "accent",
  waiting: "ochre",
  done: "pine",
  cancelled: "danger",
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};
