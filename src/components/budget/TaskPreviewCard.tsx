"use client";
import type { Task } from "@/types";

const MAX_SHOW = 5;

export default function TaskPreviewCard({ tasks }: { tasks: Task[] }) {
  const pending = tasks.filter((t) => !t.done);
  const done    = tasks.filter((t) => t.done);

  return (
    <div className="rounded-[10px] border border-border bg-card p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="text-[13px] font-semibold">Tareas</div>
        {pending.length > 0 && (
          <div className="rounded-full border border-[rgba(239,159,39,.3)] bg-[rgba(239,159,39,.12)] px-[7px] py-0.5 text-[10px] font-bold text-[#A36200]">
            {pending.length} pendiente{pending.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {pending.length === 0 ? (
        <div className="py-2.5 text-center text-xs text-muted-foreground">
          {tasks.length === 0 ? "Sin tareas aún" : "¡Todo al día!"}
        </div>
      ) : (
        <div className="flex flex-col gap-[5px]">
          {pending.slice(0, MAX_SHOW).map((t) => (
            <div key={t.id} className="flex items-start gap-[7px] text-xs">
              <span className="mt-px inline-block h-3.5 w-3.5 shrink-0 rounded border-[1.5px] border-border" />
              <span className="truncate leading-snug text-secondary-foreground">
                {t.title}
              </span>
            </div>
          ))}
          {pending.length > MAX_SHOW && (
            <div className="pl-[21px] text-[11px] text-muted-foreground">
              y {pending.length - MAX_SHOW} más...
            </div>
          )}
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
          {done.length} completada{done.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
