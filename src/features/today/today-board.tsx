"use client";

import * as React from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  AlarmClock,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  ListChecks,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  Users,
} from "lucide-react";
import { CheckSquare } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toggleRoutine } from "@/lib/actions/routines";
import type { RoutineListItem } from "@/lib/data/routines";
import type { MeetingSummary } from "@/lib/data/meetings";
import { NO_SHIFT_LABEL, ROUTINE_SHIFTS } from "@/features/routines/shifts";
import { RoutineFormDialog } from "@/features/routines/routine-form-dialog";
import {
  createTask,
  deleteTask,
  scheduleTaskForToday,
  setTaskDone,
  snoozeTaskToTomorrow,
  type ActionResult,
} from "@/lib/actions/tasks";
import type { TaskListItem, TodayBoard as TodayBoardData } from "@/lib/data/tasks";
import type { TaskPriority } from "@/lib/types";
import { TASK_PRIORITY_LABEL } from "@/features/tasks/labels";
import { EditTaskDialog, type TaskProjectOption } from "@/features/tasks/edit-task-dialog";

const PRIORITY_TONE: Record<TaskPriority, "neutral" | "ochre" | "danger"> = {
  low: "neutral",
  medium: "neutral",
  high: "ochre",
  urgent: "danger",
};

/** Manhã, Tarde, Noite e, por último, a rotina sem turno. */
const SHIFT_GROUPS = [
  ...ROUTINE_SHIFTS.map(({ value, label }) => ({ key: value as string, label })),
  { key: "none", label: NO_SHIFT_LABEL },
];

export function TodayBoard({
  board,
  routines,
  meetings,
  projects,
}: {
  board: TodayBoardData;
  routines: RoutineListItem[];
  meetings: MeetingSummary[];
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

  const routinesDone = routines.filter((routine) => routine.done).length;
  const openTasks = board.overdue.length + board.todayTasks.length;
  const tasksDone = board.completedToday.length;

  return (
    <div className="flex flex-col gap-6">
      <DaySummary
        routinesDone={routinesDone}
        routinesTotal={routines.length}
        tasksDone={tasksDone}
        tasksOpen={openTasks}
        overdue={board.overdue.length}
        meetings={meetings.length}
      />

      {meetings.length > 0 && <MeetingsStrip meetings={meetings} />}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <RoutinesColumn routines={routines} date={board.today} />

        <div className="flex flex-col gap-6">
          <ColumnHeader
            icon={ListChecks}
            title="Tarefas"
            detail={`${tasksDone} de ${tasksDone + openTasks} concluídas`}
          />
          <QuickAdd />

          {board.overdue.length > 0 && (
            <Section
              title="Atrasadas"
              count={board.overdue.length}
              tone="danger"
              hint="Conclua ou traga para hoje."
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

          <Section title="Para hoje" count={board.todayTasks.length}>
            {board.todayTasks.length === 0 ? (
              <p className="text-ink-muted px-4 py-8 text-center text-sm">
                {nothingToDo ? "Nada agendado para hoje." : "Hoje está limpo. Bom trabalho!"}
              </p>
            ) : (
              board.todayTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  projectName={projectName}
                  onEdit={setEditingId}
                />
              ))
            )}
          </Section>

          {board.completedToday.length > 0 && (
            <Section title="Concluídas hoje" count={board.completedToday.length} tone="pine">
              {board.completedToday.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  projectName={projectName}
                  onEdit={setEditingId}
                />
              ))}
            </Section>
          )}
        </div>
      </div>

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

/**
 * O resumo do dia: um anel com o progresso geral (rotinas + tarefas) e quatro
 * números. Atrasadas só conta como "aberta" — uma tarefa vencida ainda pesa no
 * dia, então o anel não fecha enquanto ela estiver aí.
 */
function DaySummary({
  routinesDone,
  routinesTotal,
  tasksDone,
  tasksOpen,
  overdue,
  meetings,
}: {
  routinesDone: number;
  routinesTotal: number;
  tasksDone: number;
  tasksOpen: number;
  overdue: number;
  meetings: number;
}) {
  const total = routinesTotal + tasksDone + tasksOpen;
  const done = routinesDone + tasksDone;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const complete = total > 0 && done === total;

  const radius = 34;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="border-line bg-surface flex flex-col gap-5 rounded-[var(--radius-lg)] border p-5 sm:flex-row sm:items-center sm:gap-8">
      <div className="flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90" aria-hidden>
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              strokeWidth="7"
              className="stroke-paper-sunk"
            />
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - percent / 100)}
              className={cn(
                "transition-[stroke-dashoffset] duration-500",
                complete ? "stroke-pine" : "stroke-accent",
              )}
            />
          </svg>
          <span className="font-display text-ink absolute inset-0 flex items-center justify-center text-xl font-medium tabular-nums">
            {percent}%
          </span>
        </div>
        <div>
          <p className="font-display text-ink text-lg font-medium tracking-tight">
            {complete ? "Dia completo!" : "Seu dia"}
          </p>
          <p className="text-ink-muted text-sm">
            {total === 0 ? "Nada planejado ainda." : `${done} de ${total} itens feitos`}
          </p>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Rotinas" value={`${routinesDone}/${routinesTotal}`} tone="plum" />
        <Stat label="Tarefas abertas" value={String(tasksOpen)} tone="accent" />
        <Stat label="Atrasadas" value={String(overdue)} tone={overdue > 0 ? "danger" : "neutral"} />
        <Stat label="Reuniões" value={String(meetings)} tone="pine" />
      </div>
    </div>
  );
}

const STAT_TONE = {
  neutral: "bg-paper-sunk text-ink-2",
  accent: "bg-accent-soft text-accent-hover",
  pine: "bg-pine-soft text-pine",
  plum: "bg-plum-soft text-plum",
  danger: "bg-danger-soft text-danger",
} as const;

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: keyof typeof STAT_TONE;
}) {
  return (
    <div className={cn("rounded-[var(--radius)] px-3.5 py-3", STAT_TONE[tone])}>
      <p className="font-display text-2xl font-medium tabular-nums">{value}</p>
      <p className="text-xs opacity-80">{label}</p>
    </div>
  );
}

function MeetingsStrip({ meetings }: { meetings: MeetingSummary[] }) {
  return (
    <section className="flex flex-col gap-3">
      <ColumnHeader icon={Users} title="Reuniões de hoje" detail={`${meetings.length}`} />
      <div className="flex gap-3 overflow-x-auto pb-1">
        {meetings.map((meeting) => (
          <Link
            key={meeting.id}
            href={`/reunioes/${meeting.id}`}
            className="border-line bg-surface hover:border-line-strong border-l-pine flex min-w-56 flex-col gap-1 rounded-[var(--radius-lg)] border border-l-4 px-4 py-3 transition-colors"
          >
            <span className="text-pine font-mono text-xs tabular-nums">
              {meeting.scheduledTime ?? "—"}
            </span>
            <span className="text-ink truncate text-sm font-medium">{meeting.title}</span>
            {meeting.projectName && (
              <span className="text-ink-muted truncate text-xs">{meeting.projectName}</span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

function ColumnHeader({
  icon: Icon,
  title,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="bg-accent-soft text-accent-hover flex h-8 w-8 items-center justify-center rounded-full">
        <Icon className="h-4 w-4" />
      </div>
      <h2 className="font-display text-ink text-xl font-medium tracking-tight">{title}</h2>
      <span className="text-ink-muted ml-auto font-mono text-xs tabular-nums">{detail}</span>
    </div>
  );
}

function RoutinesColumn({ routines, date }: { routines: RoutineListItem[]; date: string }) {
  const done = routines.filter((routine) => routine.done).length;
  const [creating, setCreating] = React.useState(false);

  const grouped = React.useMemo(
    () =>
      SHIFT_GROUPS.map((group) => ({
        ...group,
        routines: routines.filter((routine) => (routine.shift ?? "none") === group.key),
      })).filter((group) => group.routines.length > 0),
    [routines],
  );

  return (
    <div className="flex flex-col gap-6">
      <ColumnHeader icon={Repeat} title="Rotina" detail={`${done} de ${routines.length} feitas`} />

      <Button variant="secondary" onClick={() => setCreating(true)} className="self-start">
        <Plus className="h-4 w-4" />
        Nova rotina
      </Button>

      {/* Montado só enquanto aberto: o formulário guarda cadência e dias em
          estado, e remontar é o que garante que ele reabra limpo. */}
      {creating && <RoutineFormDialog open onClose={() => setCreating(false)} />}

      {routines.length === 0 ? (
        <p className="border-line-strong text-ink-muted rounded-[var(--radius-lg)] border border-dashed px-4 py-8 text-center text-sm">
          Nenhuma rotina para hoje. Uma rotina nova só aparece aqui se a frequência incluir hoje.{" "}
          <Link href="/rotinas" className="text-accent hover:text-accent-hover underline">
            Gerenciar rotinas
          </Link>
        </p>
      ) : (
        grouped.map((group) => (
          <Section key={group.key} title={group.label} count={group.routines.length}>
            {group.routines.map((routine) => (
              <RoutineRow key={routine.id} routine={routine} date={date} />
            ))}
          </Section>
        ))
      )}
    </div>
  );
}

function RoutineRow({ routine, date }: { routine: RoutineListItem; date: string }) {
  const [pending, startTransition] = React.useTransition();
  // Mesmo check otimista das tarefas: vira na hora e desfaz sozinho se falhar.
  const [done, setDone] = React.useOptimistic(routine.done);

  function toggle(checked: boolean) {
    startTransition(async () => {
      setDone(checked);
      const result = await toggleRoutine(routine.id, checked, date);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 transition-opacity",
        pending && "opacity-50",
      )}
    >
      <CheckSquare
        size="sm"
        checked={done}
        onChange={toggle}
        aria-label={done ? `Desmarcar ${routine.name}` : `Marcar ${routine.name}`}
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-ink truncate text-sm", done && "text-ink-muted line-through")}>
          {routine.name}
        </p>
        {routine.description && (
          <p className="text-ink-muted truncate text-xs">{routine.description}</p>
        )}
      </div>
      {routine.link && (
        <a
          href={routine.link}
          target="_blank"
          rel="noopener noreferrer"
          title={routine.link}
          aria-label={`Abrir link de ${routine.name}`}
          className="text-accent hover:text-accent-hover shrink-0"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      {done && <CheckCircle2 className="text-pine h-4 w-4 shrink-0" aria-hidden />}
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
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline gap-2.5">
        <h3 className="font-display text-ink text-base font-medium tracking-tight">{title}</h3>
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
