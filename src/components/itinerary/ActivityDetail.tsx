"use client";
import EventEditor from "@/components/editor/EventEditor";
import LinkedExtrasSection from "@/components/itinerary/LinkedExtrasSection";
import LocationSection from "@/components/itinerary/LocationSection";
import RangesSection from "@/components/itinerary/RangesSection";
import DocumentPicker from "@/components/documents/DocumentPicker";
import { Disclosure } from "@/components/ui/disclosure";
import { extraGroupUSD, fmtUSD } from "@/utils/currency";
import type { CalendarEvent, Day, EventPlace, Extra, TripDocument, TripSpan } from "@/types";

interface ActivityDetailProps {
  selected: { ev: CalendarEvent; dayId: string };
  place?: EventPlace;          // where the trip map located it
  days: Day[];
  extras: Extra[];
  tripSpans: TripSpan[];
  documents: TripDocument[];
  people: number;
  exchangeRate: number;
  onUpdate: (patch: Partial<CalendarEvent>) => void;
  onDelete: () => void;
  onMoveDay: (toDayId: string) => void;
  onLinkExtra: (extraId: string, eventId: string | undefined) => void;
  onAddExtra: (partial?: Partial<Extra>) => void;
  onRemoveExtra: (id: string) => void;
  onAddTripSpan: (span: TripSpan) => void;
  onRemoveTripSpan: (id: string) => void;
}

// Everything about one activity: the essentials up front, money and ranges folded away.
export default function ActivityDetail({
  selected, place, days, extras, tripSpans, documents, people, exchangeRate,
  onUpdate, onDelete, onMoveDay, onLinkExtra, onAddExtra, onRemoveExtra, onAddTripSpan, onRemoveTripSpan,
}: ActivityDetailProps) {
  const linked = extras.filter((x) => x.linkedEventId === selected.ev.id);
  const linkedTotal = linked.reduce((s, x) => s + extraGroupUSD(x, people, exchangeRate), 0);
  const ranges = tripSpans.filter((s) => s.startEventId === selected.ev.id || s.endEventId === selected.ev.id);

  return (
    <div className="flex flex-col">
      <EventEditor
        ev={selected.ev}
        onChange={onUpdate}
        days={days}
        dayId={selected.dayId}
        onMoveDay={onMoveDay}
      />

      <LocationSection ev={selected.ev} place={place} onSetLink={(mapsUrl) => onUpdate({ mapsUrl })} />

      {documents.length > 0 && (
        <section className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border p-3">
          <h3 className="text-[13px] font-semibold">Documento</h3>
          <DocumentPicker documents={documents} value={selected.ev.documentId} onChange={(documentId) => onUpdate({ documentId })} />
        </section>
      )}

      <div className="mt-4">
        <Disclosure
          title="Gastos vinculados"
          hint={linked.length > 0 ? `${linked.length} · ${fmtUSD(linkedTotal)}` : "Ninguno"}
        >
          <LinkedExtrasSection
            selectedEvent={selected}
            extras={extras}
            onLinkExtra={onLinkExtra}
            onAddExtra={onAddExtra}
            onRemoveExtra={onRemoveExtra}
          />
        </Disclosure>
        <Disclosure title="Rangos en el calendario" hint={ranges.length > 0 ? ranges.length : "Ninguno"} className="border-b">
          <RangesSection
            selectedEvent={selected}
            days={days}
            tripSpans={tripSpans}
            onAddTripSpan={onAddTripSpan}
            onRemoveTripSpan={onRemoveTripSpan}
          />
        </Disclosure>
      </div>

      <button
        onClick={onDelete}
        className="mt-4 cursor-pointer self-center rounded-lg px-3 py-2 text-[13px] font-medium text-destructive hover:bg-destructive/10"
      >
        Eliminar actividad
      </button>
    </div>
  );
}
