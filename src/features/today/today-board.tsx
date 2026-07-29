"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlarmClock, CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { CheckSquare } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  createTask,
  deleteTask,
  scheduleTaskForToday,
  setTaskDone,
  snoozeTaskToTomorrow,
  type ActionResult,
} from "@/lib/actions/tasks";
import type { TaskListItem, TodayBoard as TodayBoardData } from "@/lib/data/tasks";
import type { TaskPriority } from "@/lib/supabase/types";
import { TASK_PRIORITY_LABEL } from "@/features/tasks/labels";
import { EditTaskDialog, type TaskProjectOption } from "@/features/tasks/edit-task-dialog";

const PRIORITY_TONE: Record<TaskPriority, "neutral" | "ochre" | "danger"> = {
  low: "neutral",
  medium: "neutral",
  high: "ochre",
  urgent: "danger",
};

export function TodayBoard({
  board,
  projects,
}: {
  board: TodayBoardData;
  projects: TaskProjectOption[];
}) {
  const projectName = React.useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );

  const nothingToDo = board.overdue.length === 0 && board.todayTasks.length === 0;

  // O diálogo é montado uma vez aqui, e não dentro de cada linha: guardar o id
  // e reencontrar a tarefa nas três listas mantém o conteúdo atualizado depois
  // do `revalidatePath`, e evita 50 diálogos fechados no DOM.
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const editing =
    [...board.overdue, ...board.todayTasks, ...board.completedToday].find(
      (task) => task.id === editingId,
    ) ?? null;

  return (
    <div className="flex flex-col gap-8">
      <QuickAdd />

      {board.overdue.length > 0 && (
        <Section
          title="Atrasadas"
          count={board.overdue.length}
          tone="danger"
          hint="Passaram da data. Conclua ou traga para hoje."
        >
          {board.overdue.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              projectName={projectName}
              onEdit={setEditingId}
              overdue
            />
          ))}
        </Section>
      )}

      <Section title="Hoje" count={board.todayTasks.length}>
        {board.todayTasks.length === 0 ? (
          <EmptyState
            title={nothingToDo ? "Nada para hoje" : "Hoje está limpo"}
            description="Adicione uma tarefa acima ou traga uma atrasada para cá."
          />
        ) : (
          board.todayTasks.map((task) => (
            <TaskRow key={task.id} task={task} projectName={projectName} onEdit={setEditingId} />
          ))
        )}
      </Section>

      {board.completedToday.length > 0 && (
        <Section title="Concluídas hoje" count={board.completedToday.length} tone="pine">
          {board.completedToday.map((task) => (
            <TaskRow key={task.id} task={task} projectName={projectName} onEdit={setEditingId} />
          ))}
        </Section>
      )}

      {editing && (
        <EditTaskDialog
          key={editing.id}
          task={editing}
          projects={projects}
          open
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

function Section({
  title,
  count,
  tone = "neutral",
  hint,
  children,
}: {
  title: string;
  count: number;
  tone?: "neutral" | "danger" | "pine";
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2.5">
        <h2 className="font-display text-ink text-lg font-medium tracking-tight">{title}</h2>
        <Badge tone={tone}>{count}</Badge>
        {hint && <span className="text-ink-muted text-xs">{hint}</span>}
      </div>
      <div className="border-line bg-surface divide-line divide-y rounded-[var(--radius-lg)] border">
        {children}
      </div>
    </section>
  );
}

function QuickAdd() {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [pending, startTransition] = React.useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createTask(formData);
      if (result.ok) {
        formRef.current?.reset();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex gap-2">
      {/* A tarefa entra já agendada para hoje — é a tela "Hoje", criar algo aqui
          que não aparecesse na lista seria surpreendente. */}
      <input type="hidden" name="scheduledDate" value={todayValue()} />
      <Input
        name="title"
        placeholder="O que precisa ser feito hoje?"
        required
        maxLength={300}
        className="flex-1"
      />
      <Button type="submit" disabled={pending}>
        <Plus className="h-4 w-4" />
        {pending ? "Adicionando..." : "Adicionar"}
      </Button>
    </form>
  );
}

// O servidor decide a data real na hora de gravar; este valor só serve para o
// campo do formulário. Ainda assim uso o fuso do navegador em vez de UTC, para
// não criar tarefa "de ontem" quando alguém adiciona algo às 22h em Brasília.
function todayValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

function TaskRow({
  task,
  projectName,
  onEdit,
  overdue = false,
}: {
  task: TaskListItem;
  projectName: Map<string, string>;
  onEdit: (taskId: string) => void;
  overdue?: boolean;
}) {
  const [pending, startTransition] = React.useTransition();
  // Check otimista: o quadrado vira na hora do clique, sem esperar a ida ao
  // servidor e o `revalidatePath` que vêm depois. `useOptimistic` volta sozinho
  // ao valor real quando a transição termina — se a action falhar, o check
  // desmarca de volta junto com o toast de erro.
  const [done, setDone] = React.useOptimistic(task.status === "done");

  function run(action: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error);
    });
  }

  function toggleDone(checked: boolean) {
    startTransition(async () => {
      setDone(checked);
      const result = await setTaskDone(task.id, checked);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-4 py-3 transition-opacity",
        pending && "opacity-50",
      )}
    >
      <CheckSquare
        size="sm"
        checked={done}
        onChange={toggleDone}
        aria-label={done ? `Reabrir ${task.title}` : `Concluir ${task.title}`}
      />

      <div className="min-w-0 flex-1">
        <p className={cn("text-ink truncate text-sm", done && "text-ink-muted line-through")}>
          {task.title}
        </p>
        <div className="text-ink-muted mt-0.5 flex items-center gap-2 text-xs">
          {task.project_id && projectName.has(task.project_id) && (
            <span className="truncate">{projectName.get(task.project_id)}</span>
          )}
          {task.status === "waiting" && task.blocked_reason && (
            <span className="text-ochre truncate">Aguardando: {task.blocked_reason}</span>
          )}
          {overdue && task.due_date && (
            <span className="text-danger font-mono tabular-nums">venceu {task.due_date}</span>
          )}
        </div>
      </div>

      {task.priority !== "medium" && (
        <Badge tone={PRIORITY_TONE[task.priority]}>{TASK_PRIORITY_LABEL[task.priority]}</Badge>
      )}

      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {overdue && (
          <IconButton
            label="Trazer para hoje"
            onClick={() => run(() => scheduleTaskForToday(task.id))}
          >
            <AlarmClock className="h-4 w-4" />
          </IconButton>
        )}
        {!done && (
          <IconButton
            label="Adiar para amanhã"
            onClick={() => run(() => snoozeTaskToTomorrow(task.id))}
          >
            <CalendarClock className="h-4 w-4" />
          </IconButton>
        )}
        <IconButton label="Editar" onClick={() => onEdit(task.id)}>
          <Pencil className="h-4 w-4" />
        </IconButton>
        <IconButton label="Excluir" onClick={() => run(() => deleteTask(task.id))} danger>
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "text-ink-muted hover:bg-paper-sunk rounded-[var(--radius-sm)] p-1.5 transition-colors",
        danger ? "hover:text-danger" : "hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
