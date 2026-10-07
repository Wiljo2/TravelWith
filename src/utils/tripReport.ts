import { fmtHour } from "@/utils/time";
import { parseISODate } from "@/utils/tripDays";
import { documentKind } from "@/constants/documentKinds";
import { driveFileUrl } from "@/utils/driveLinks";
import type { CalendarEvent, Day, TripDocument, TripInfo } from "@/types";

// What goes into the trip PDFs, independent of how they're drawn (lib/tripPdf.ts):
// - "migration": 1–2 pages to show an immigration officer — travelers, dates,
//   flights, lodging, the cruise and anything backed by a linked document, the
//   supporting documents with their Drive links (they open only for people the
//   folder is shared with), and where the group is each day. No prices.
// - "full": the whole itinerary, day by day, for the group.

export type ReportKind = "migration" | "full";

export interface ReportInput {
  trip: TripInfo | null;
  days: Day[];
  travelers: string[];
  documents?: TripDocument[];
  now?: Date;
}

export interface ReportRow { when: string; text: string; detail?: string; link?: string }
export interface ReportSection { title: string; subtitle?: string; rows: ReportRow[] }

export interface TripReport {
  title: string;
  heading: string;          // the trip's name
  dates: string;
  destination?: string;
  travelers: string[];
  sections: ReportSection[];
  footer: string;
  fileName: string;
}

// Logistics an officer asks about: getting there, where they sleep, the ship.
const LOGISTICS_RE = /vuelo|flight|aeropuerto|airport|check-?in|check-?out|hotel|\binn\b|suites|hospedaje|airbnb|crucero|cruise|puerto|\bport\b|zarpe|atraque|desembarque|embarque|llegada a/i;
// Note clauses about money, left out of the migration copy.
const MONEY_RE = /\$|\busd\b|\bcop\b|\bpago\b|\bpagar\b|\bprecio\b|\btotal\b|cancelaci/i;

// The PDF fonts only cover Latin-1: arrows become "->", emoji go away.
export function pdfText(text: string | undefined): string {
  return (text ?? "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[→⇄➜]/g, "->")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s·,;:-]+|[\s·,;:-]+$/g, "")
    .trim();
}

function withoutMoney(note: string): string {
  // Commas inside numbers ("$1,444,000") don't split a clause.
  return note.split(/\s+[·—–-]\s+|[,;]\s+/).filter((c) => !MONEY_RE.test(c)).join(" · ");
}

const dayDate = (trip: TripInfo | null, idx: number): Date | null => {
  const start = trip ? parseISODate(trip.startDate) : null;
  return start ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + idx) : null;
};

const longDate = (d: Date) => d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDate = (d: Date) => d.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });
const timeRange = (ev: CalendarEvent) => (ev.end > ev.start ? `${fmtHour(ev.start)} - ${fmtHour(ev.end)}` : fmtHour(ev.start));
const byStart = (a: CalendarEvent, b: CalendarEvent) => a.start - b.start;

export function buildTripReport(kind: ReportKind, { trip, days, travelers, documents = [], now = new Date() }: ReportInput): TripReport {
  const first = dayDate(trip, 0);
  const last = dayDate(trip, days.length - 1);
  const label = (idx: number, long = false) => {
    const d = dayDate(trip, idx);
    return d ? (long ? longDate(d) : shortDate(d)) : pdfText(days[idx].label);
  };
  const dates = [
    first && last ? `${first.toLocaleDateString("es-CO", { day: "numeric", month: "long" })} al ${last.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}` : "",
    `${days.length} ${days.length === 1 ? "día" : "días"}`,
  ].filter(Boolean).join(" · ");

  const docs = new Map(documents.map((d) => [d.id, d]));
  const docOf = (ev: CalendarEvent) => (ev.documentId ? docs.get(ev.documentId) : undefined);
  const supported = (doc: TripDocument) => days.flatMap((day, i) =>
    day.events.filter((ev) => ev.documentId === doc.id).sort(byStart).map((ev) => `${label(i)}: ${pdfText(ev.title)}`));
  const supportSection: ReportSection[] = documents.length === 0 ? [] : [{
    title: "Documentos de soporte",
    subtitle: "Originales disponibles para presentar",
    rows: documents.map((doc) => ({
      when: documentKind(doc.kind).label,
      text: pdfText(doc.title),
      detail: supported(doc).join(" · ") || undefined,
      link: driveFileUrl(doc.driveFileId),
    })),
  }];

  const sections: ReportSection[] = kind === "migration"
    ? [
      {
        title: "Vuelos, hospedaje y crucero",
        rows: days.flatMap((day, i) => [...day.events].sort(byStart)
          .filter((ev) => (ev.cat === "logist" && LOGISTICS_RE.test(ev.title)) || docOf(ev))
          .map((ev) => {
            const doc = docOf(ev);
            const detail = [pdfText(withoutMoney(pdfText(ev.note))), doc ? `Soporte: ${pdfText(doc.title)}` : ""].filter(Boolean).join(" · ");
            return { when: `${label(i)} · ${fmtHour(ev.start)}`, text: pdfText(ev.title), detail: detail || undefined };
          })),
      },
      ...supportSection,
      {
        title: "Itinerario por día",
        rows: days.map((day, i) => ({ when: label(i), text: pdfText(day.sub) || "-" })),
      },
    ]
    : days.map((day, i) => ({
      title: label(i, true),
      subtitle: pdfText(day.sub) || undefined,
      rows: [...day.events].sort(byStart).map((ev) => ({ when: timeRange(ev), text: pdfText(ev.title), detail: pdfText(ev.note) || undefined })),
    }));

  const name = trip?.name ?? "Mi viaje";
  const slug = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "viaje";
  return {
    title: kind === "migration" ? "Itinerario de viaje" : "Itinerario completo",
    heading: pdfText(name),
    dates: pdfText(dates),
    destination: pdfText(trip?.destination) || undefined,
    travelers: travelers.map(pdfText).filter(Boolean),
    sections,
    footer: pdfText(`Generado el ${now.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })} con TravelWith`),
    fileName: `${kind === "migration" ? "itinerario-migracion" : "itinerario-completo"}-${slug}.pdf`,
  };
}
