import type { RoomPayload, Extra, Task, TripSpan } from "@/types";
import { initialDays } from "./initialDays";

// Local mode: boots the whole app against in-memory mock data — no Supabase, no
// Google sign-in, no autosave. `useRoom` and App's autosave already short-circuit
// on this code. Dev builds only; the flag lets the bundler drop it in production.
export const LOCAL_ROOM_CODE = "LOCAL";
export const LOCAL_MODE_ENABLED = process.env.NODE_ENV !== "production";

const mockPeople = [
  { id: "mp-1", name: "William" },
  { id: "mp-2", name: "Ana" },
  { id: "mp-3", name: "Carlos" },
  { id: "mp-4", name: "Lucía" },
];

const extras: Extra[] = [
  { id: "x-flights",  label: "Vuelos Cali → Orlando (ida y vuelta)", amount: 720,     currency: "USD", splitMode: "perPerson" },
  { id: "x-cars",     label: "2 Toyota Corolla (4 días)",            amount: 336,     currency: "USD", splitMode: "group" },
  { id: "x-hotel-orl",label: "Fairfield Inn — 3 noches",             amount: 630,     currency: "USD", splitMode: "group" },
  { id: "x-cruise",   label: "Wonder of the Seas — 3 cabinas",       amount: 2418.9,  currency: "USD", splitMode: "group", linkedEventId: "d4-zarpe" },
  { id: "x-universal",label: "Entradas Universal (2 parques)",       amount: 210,     currency: "USD", splitMode: "perPerson", startDayId: "d1", endDayId: "d1" },
  { id: "x-parking",  label: "Parking Universal",                    amount: 35,      currency: "USD", splitMode: "group", startDayId: "d1", endDayId: "d1" },
  { id: "x-nassau",   label: "Excursión Pearl Island",               amount: 89,      currency: "USD", splitMode: "perPerson", linkedEventId: "nassau-dock" },
  { id: "x-seguro",   label: "Seguro de viaje",                      amount: 480000,  currency: "COP", splitMode: "perPerson" },
];

// Multi-day span anchored on stable event ids from initialDays (the `anchor()`
// entries), so it survives the random ids that `mk()` generates on each boot.
const tripSpans: TripSpan[] = [
  {
    id: "ts-bahamas",
    label: "Bahamas",
    startEventId: "nassau-dock",
    endEventId: "coco-back",
    bg: "rgba(245,158,11,.07)",
    border: "rgba(245,158,11,.35)",
    zIndex: 2,
  },
];

const tasks: Task[] = [
  {
    id: "t-vuelos",
    title: "Comprar los vuelos",
    done: false,
    priority: "alta",
    cat: "decidir",
    note: "Precios suben cerca de temporada alta",
    options: [
      { id: "t-vuelos-o1", label: "Copa (1 escala, 9h)",    amount: 720, currency: "USD", splitMode: "perPerson", note: "Equipaje incluido" },
      { id: "t-vuelos-o2", label: "Avianca (directo, 6h)",  amount: 890, currency: "USD", splitMode: "perPerson" },
      { id: "t-vuelos-o3", label: "Spirit (2 escalas, 14h)",amount: 540, currency: "USD", splitMode: "perPerson", note: "Equipaje aparte" },
    ],
  },
  {
    id: "t-hotel-miami",
    title: "Reservar hotel en Miami (1 noche)",
    done: false,
    priority: "alta",
    cat: "reservar",
    dayId: "d3",
    start: 15,
    end: 16,
    note: "Brickell o cerca del puerto",
  },
  { id: "t-visa",    title: "Verificar vigencia de visas", done: true,  priority: "alta", cat: "confirmar" },
  { id: "t-saldo",   title: "Pagar saldo del crucero",     done: false, priority: "alta", cat: "comprar", note: "Vence 30 días antes del zarpe" },
  { id: "t-maletas", title: "Definir equipaje por persona",done: false, priority: "baja", cat: "empacar" },
];

export const mockRoomPayload: RoomPayload = {
  days: initialDays,
  extras,
  exchangeRate: 4100,
  trip: {
    name: "Orlando + Wonder of the Seas",
    destination: "Florida & Bahamas",
    startDate: "2026-11-26",
    endDate: "2026-12-04",
  },
  mockPeople,
  tripSpans,
  tasks,
};
