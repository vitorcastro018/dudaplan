import type { ProjectStatus } from "@/lib/supabase/types";

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "Planejando",
  active: "Ativo",
  on_hold: "Em espera",
  done: "Concluído",
  cancelled: "Cancelado",
};

export const PROJECT_STATUS_TONE: Record<
  ProjectStatus,
  "accent" | "pine" | "ochre" | "neutral" | "danger"
> = {
  planning: "neutral",
  active: "pine",
  on_hold: "ochre",
  done: "accent",
  cancelled: "danger",
};
