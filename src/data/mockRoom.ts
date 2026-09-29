import type { CalendarEvent, Day, Extra, RoomPayload, Task, TripSpan } from "@/types";

// Fictional demo trip for local mode. Loaded only through a dynamic import when
// LOCAL_MODE_ENABLED, so it never ships in production bundles. Keep it generic:
// no real people, dates of an actual trip, bookings or places anyone stays at.

const ev = (id: string, start: number, end: number, title: string, cat: string, note = ""): CalendarEvent => ({
  id, start, end, title, cat, note,
});

const days: Day[] = [
  {
    id: "d0",
    label: "Lun · Mar 2",
    sub: "Llegada",
    flexible: false,
    events: [
      ev("d0-flight", 8, 12, "Vuelo de ida", "transporte", "Revisar equipaje incluido"),
      ev("d0-checkin", 14, 15, "Check-in en el alojamiento", "alojamiento", "Apartamento para el grupo"),
      ev("d0-dinner", 19.5, 21, "Cena de bienvenida", "comida", "Buscar opciones cerca del centro"),
    ],
  },
  {
    id: "d1",
    label: "Mar · Mar 3",
    sub: "Centro histórico",
    flexible: true,
    spans: [{ id: "d1-walk", label: "Recorrido a pie", startEventId: "d1-tour", endEventId: "d1-museum", bg: "rgba(59,130,246,.14)", border: "rgba(59,130,246,.65)", zIndex: 1 }],
    events: [
      ev("d1-breakfast", 8, 9, "Desayuno", "comida"),
      ev("d1-tour", 9.5, 12, "Tour a pie por el centro", "actividad", "https://example.com/tour"),
      ev("d1-museum", 14, 16.5, "Museo de la ciudad", "actividad"),
      ev("d1-night", 21, 23.5, "Salida nocturna", "noche"),
    ],
  },
  {
    id: "d2",
    label: "Mié · Mar 4",
    sub: "Excursión de día completo",
    flexible: true,
    events: [
      ev("d2-bus", 7, 8.5, "Traslado a la excursión", "transporte"),
      ev("d2-hike", 9, 14, "Caminata y mirador", "actividad", "Llevar agua y bloqueador"),
      ev("d2-back", 17, 18.5, "Regreso", "transporte"),
    ],
  },
  {
    id: "d3",
    label: "Jue · Mar 5",
    sub: "Regreso",
    flexible: false,
    events: [
      ev("d3-checkout", 10, 11, "Check-out", "logist"),
      ev("d3-flight", 15, 19, "Vuelo de regreso", "transporte"),
    ],
  },
];

const extras: Extra[] = [
  { id: "x-flights", label: "Vuelos ida y vuelta", amount: 420, currency: "USD", splitMode: "perPerson" },
  { id: "x-stay", label: "Apartamento (3 noches)", amount: 540, currency: "USD", splitMode: "group", startDayId: "d0", endDayId: "d2" },
  { id: "x-tour", label: "Tour a pie", amount: 25, currency: "USD", splitMode: "perPerson", linkedEventId: "d1-tour" },
  { id: "x-insurance", label: "Seguro de viaje", amount: 120000, currency: "COP", splitMode: "perPerson" },
];

const tripSpans: TripSpan[] = [
  {
    id: "ts-excursion",
    label: "Excursión",
    startEventId: "d2-bus",
    endEventId: "d2-back",
    bg: "rgba(245,158,11,.07)",
    border: "rgba(245,158,11,.35)",
    zIndex: 2,
  },
];

const tasks: Task[] = [
  {
    id: "t-flights",
    title: "Comprar los vuelos",
    done: false,
    priority: "alta",
    cat: "decidir",
    options: [
      { id: "t-flights-o1", label: "Aerolínea A (directo)", amount: 480, currency: "USD", splitMode: "perPerson" },
      { id: "t-flights-o2", label: "Aerolínea B (1 escala)", amount: 420, currency: "USD", splitMode: "perPerson", note: "Equipaje aparte" },
    ],
  },
  { id: "t-stay", title: "Reservar el alojamiento", done: false, priority: "alta", cat: "reservar", dayId: "d0", start: 15, end: 16 },
  { id: "t-docs", title: "Verificar documentos de viaje", done: true, priority: "media", cat: "confirmar" },
  { id: "t-bags", title: "Definir equipaje por persona", done: false, priority: "baja", cat: "empacar" },
];

export const mockRoomPayload: RoomPayload = {
  days,
  extras,
  exchangeRate: 4000,
  trip: {
    name: "Viaje de ejemplo",
    destination: "Ciudad de ejemplo",
    startDate: "2027-03-02",
    endDate: "2027-03-05",
  },
  mockPeople: [
    { id: "mp-1", name: "Viajero 1" },
    { id: "mp-2", name: "Viajero 2" },
    { id: "mp-3", name: "Viajero 3" },
  ],
  tripSpans,
  tasks,
};
