"use client";
import type { UserRoom } from "@/hooks/useUserRooms";
import { UNDATED_LABEL, hasDates } from "@/utils/tripDays";

interface TripListProps {
  rooms: UserRoom[];
  disabled: boolean;
  error: string;
  onOpen: (code: string) => void;
  onRemove: (target: { code: string; name: string | null }) => void;
}

export default function TripList({ rooms, disabled, error, onOpen, onRemove }: TripListProps) {
  return (
    <div className="mb-4">
      <p className="mb-2.5 text-[11px] font-semibold tracking-[.07em] text-muted-foreground">
        MIS VIAJES
      </p>
      <div className="flex flex-col gap-2">
        {rooms.map((r) => (
          <div
            key={r.room_code}
            className="flex items-center overflow-hidden rounded-xl border border-border bg-card"
          >
            <button
              onClick={() => onOpen(r.room_code)}
              disabled={disabled}
              className="flex flex-1 cursor-pointer items-center justify-between px-4 py-3.5 text-left text-foreground hover:bg-secondary"
            >
              <div>
                <div className="text-[15px] font-semibold">
                  {r.name ?? <span className="font-mono tracking-[.08em]">{r.room_code}</span>}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  <span className="font-mono tracking-wider">{r.room_code}</span>
                  {" · "}{r.role === "owner" ? "Creador" : "Miembro"}
                  {r.trip?.destination && <> · {r.trip.destination}</>}
                  {r.trip && !hasDates(r.trip) && <> · {UNDATED_LABEL}</>}
                </div>
              </div>
              <span className="text-xl opacity-35">→</span>
            </button>
            <button
              onClick={() => onRemove({ code: r.room_code, name: r.name })}
              title="Quitar de mi lista"
              className="flex h-full min-w-12 cursor-pointer items-center justify-center self-stretch border-l border-border px-3.5 text-base text-muted-foreground hover:bg-secondary"
            >
              🗑
            </button>
          </div>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
