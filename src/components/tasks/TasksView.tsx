"use client";
import { useState, useRef } from "react";
import type { Task, Day, TripInfo } from "@/types";
import { fmtHour } from "@/utils/time";
import { activityCount } from "@/utils/tripDays";
import { isVote } from "@/utils/votes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import TaskRow from "@/components/tasks/TaskRow";
import type { OptionVoting } from "@/components/tasks/OptionVote";
import VoteCard, { type VoteControls } from "@/components/votes/VoteCard";
import StartVoteButtons from "@/components/votes/StartVoteButtons";
import { LIMITS } from "@/constants/limits";

interface TasksViewProps {
  days: Day[];
  tasks: Task[];
  trip: TripInfo | null;
  people: number;
  exchangeRate: number;
  voting: OptionVoting;
  votes: VoteControls;
  onAdd: (title: string) => void;
  onToggle: (id: string) => void;
  onUpdateTask: (id: string, patch: Partial<Task>) => void;
  onChooseOption: (taskId: string, optionId: string) => void;
  onDelete: (id: string) => void;
}

export default function TasksView({
  days, tasks, trip, people, exchangeRate, voting, votes, onAdd, onToggle, onUpdateTask, onChooseOption, onDelete,
}: TasksViewProps) {
  const [draft, setDraft] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const openVotes = tasks.filter((t) => isVote(t) && !t.done);
  const pending = tasks.filter((t) => !t.done && !isVote(t));
  const done    = tasks.filter((t) => t.done);
  const activities = activityCount(days);

  function submit() {
    const title = draft.trim();
    if (!title) return;
    onAdd(title);
    setDraft("");
    inputRef.current?.focus();
  }

  function startEdit(task: Task) {
    setEditingId(task.id);
    setEditValue(task.title);
  }

  function commitEdit(id: string) {
    if (editValue.trim()) onUpdateTask(id, { title: editValue.trim() });
    setEditingId(null);
  }

  const dayLabel = (id?: string) => days.find((d) => d.id === id)?.label.split("·")[0].trim();

  function renderList(list: Task[]) {
    return (
      <div className="flex flex-col gap-2">
        {list.map((task) => isVote(task) ? (
          <VoteCard
            key={task.id}
            task={task}
            trip={trip}
            activityCount={activities}
            voting={voting}
            votes={votes}
            onDelete={votes.canClose ? () => onDelete(task.id) : undefined}
          />
        ) : (
          <TaskRow
            key={task.id}
            task={task}
            people={people}
            exchangeRate={exchangeRate}
            scheduledLabel={task.dayId ? `${dayLabel(task.dayId)} · ${fmtHour(task.start ?? 0)}` : null}
            expanded={expandedId === task.id}
            editing={editingId === task.id}
            editValue={editValue}
            voting={voting}
            onToggleExpand={() => setExpandedId((p) => p === task.id ? null : task.id)}
            onToggleDone={() => onToggle(task.id)}
            onStartEdit={() => startEdit(task)}
            onEditChange={setEditValue}
            onCommitEdit={() => commitEdit(task.id)}
            onCancelEdit={() => setEditingId(null)}
            onUpdate={(patch) => onUpdateTask(task.id, patch)}
            onChoose={(optionId) => onChooseOption(task.id, optionId)}
            onDelete={() => onDelete(task.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div>
        <div className="mx-auto w-full max-w-[720px]">

          <div className="mb-3 flex gap-2">
            <Input
              ref={inputRef}
              value={draft}
              maxLength={LIMITS.title}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Nueva tarea, cosa por decidir..."
              className="h-11 flex-1 rounded-xl bg-card text-sm shadow-[0_1px_2px_rgba(0,0,0,.04)]"
            />
            <Button onClick={submit} disabled={!draft.trim()} className="h-11 rounded-xl px-5 font-semibold">
              Añadir
            </Button>
          </div>

          <StartVoteButtons tasks={tasks} onStart={votes.startVote} className="mb-3" />
          <p className="mb-6 text-[11.5px] leading-normal text-muted-foreground">
            Tip: en el calendario, toca o haz clic en un hueco libre para agendar una tarea o discusión a una hora concreta.
          </p>

          {openVotes.length > 0 && (
            <section className="mb-8">
              <SectionLabel title="Votaciones" count={openVotes.length} />
              {renderList(openVotes)}
            </section>
          )}

          {pending.length > 0 && (
            <section className="mb-8">
              <SectionLabel title="Por hacer" count={pending.length} />
              {renderList(pending)}
            </section>
          )}

          {done.length > 0 && (
            <section>
              <SectionLabel title="Completadas" count={done.length} />
              {renderList(done)}
            </section>
          )}

          {tasks.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
              <div className="text-[32px] text-muted-foreground">✓</div>
              <div>
                <h2 className="text-[15px] font-semibold">Sin tareas aún</h2>
                <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
                  Anoten lo que falta reservar, confirmar o decidir; a cada tarea le pueden sumar opciones con precio para comparar.
                </p>
              </div>
              <Button variant="outline" onClick={() => inputRef.current?.focus()} className="rounded-full px-5 font-semibold">
                Escribir la primera tarea
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ title, count }: { title: string; count: number }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
      {title}
      <span className="rounded-full bg-muted px-2 py-px text-xs font-medium text-muted-foreground">{count}</span>
    </h2>
  );
}
