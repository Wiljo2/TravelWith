import type { TripInfo } from "@/types";
import { parseISODate } from "@/utils/tripDays";

const ASK = "Propón un primer plan día por día.";

const monthName = (d: Date) => d.toLocaleDateString("es-CO", { month: "long" });

// "del 4 al 7 de diciembre", "del 28 de noviembre al 3 de diciembre", "el 4 de diciembre";
// the year only when the trip crosses one. Empty without valid dates.
export function spokenTripDates(startDate: string, endDate: string): string {
  const start = parseISODate(startDate);
  const end = parseISODate(endDate);
  if (!start || !end || end < start) return "";
  const endText = `${end.getDate()} de ${monthName(end)}`;
  if (start.getTime() === end.getTime()) return `el ${endText}`;
  if (start.getFullYear() !== end.getFullYear()) {
    return `del ${start.getDate()} de ${monthName(start)} de ${start.getFullYear()} al ${endText} de ${end.getFullYear()}`;
  }
  if (start.getMonth() !== end.getMonth()) return `del ${start.getDate()} de ${monthName(start)} al ${endText}`;
  return `del ${start.getDate()} al ${endText}`;
}

// The first message offered by "Contarle a la IA": left in the assistant's box to edit and send.
export function firstPlanDraft(trip: TripInfo, people: number): string {
  const group = people > 1;
  const destination = trip.destination?.trim();
  const going = destination
    ? `${group ? "vamos" : "Voy"} a ${destination}`
    : `${group ? "nos vamos" : "Me voy"} de viaje`;
  const subject = group ? `Somos ${Math.round(people)} y ${going}` : going;
  const when = spokenTripDates(trip.startDate, trip.endDate);
  return `${subject}${when ? ` ${when}` : ""}. ${ASK}`;
}
