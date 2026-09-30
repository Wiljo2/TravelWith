// Test fixture only: a full multi-day itinerary (the app's original demo trip)
// used by the idea-matching tests. Never import this from app code; it must not
// ship in production bundles.
import { uid } from "@/utils/uid";
import type { Day, CalendarEvent, DaySpan } from "@/types";

const mk = (start: number, end: number, title: string, cat: string, note = ""): CalendarEvent => ({
  id: uid(), start, end, title, cat, note,
});
const anchor = (id: string, start: number, end: number, title: string, cat: string, note = ""): CalendarEvent => ({
  id, start, end, title, cat, note,
});

// ── Span presets ──────────────────────────────────────────────────────────────
const CRUISE_BG: Omit<DaySpan, "id" | "startHour" | "endHour" | "startEventId" | "endEventId"> = {
  label: "Wonder of the Seas",
  bg: "rgba(110,231,183,.09)",
  border: "transparent",
  zIndex: 0,
};
const PORT_WINDOW: Omit<DaySpan, "id" | "startEventId" | "endEventId"> = {
  label: "En puerto",
  bg: "rgba(55,138,221,.06)",
  border: "rgba(55,138,221,.30)",
  zIndex: 1,
};

export const initialDays: Day[] = [

  // ── Día 1: Jue 26 Nov — Vuelo & llegada Orlando ───────────────────────────
  {
    id: "d0",
    label: "Jue · Nov 26",
    sub: "Vuelo & llegada a Orlando",
    flexible: false,
    events: [
      mk(4,    5,    "Salida al aeropuerto Alfonso Bonilla",   "logist", "Llegar 2 h antes — vuelo temprano"),
      mk(6,    14,   "Vuelo Cali → [conexión] → Orlando ⏳",   "logist", "Por comprar — Copa / Avianca / Spirit"),
      mk(14,   15.5, "Recogida de carros en MCO ⏳",           "logist", "2 Toyota Corolla cotizados $168 c/u — por reservar"),
      mk(15.5, 16.5, "Walmart Supercenter",                   "logist", "Compras para 3 días: snacks, bebidas, desayunos"),
      mk(17,   18,   "Check-in Fairfield Inn & Suites ✅",     "logist", "Marriott Lake Buena Vista · 2 hab · 6 adultos · Nov 26–29"),
      mk(19,   21,   "Cena en International Drive",           "comida", "Olive Garden / Bahama Breeze / The Cowfish"),
    ],
  },

  // ── Día 2: Vie 27 Nov — Universal Studios ────────────────────────────────
  {
    id: "d1",
    label: "Vie · Nov 27",
    sub: "Universal Studios Orlando ⏳",
    flexible: true,
    events: [
      mk(7.5,  8.5,  "Desayuno en hotel",                    "comida", "Incluido en reserva Fairfield Inn"),
      mk(8.5,  9,    "Traslado a Universal (10 min)",         "logist", "Carro propio — parking ~$35"),
      mk(9,    11,   "Islands of Adventure — Wizarding World","miami",  "Llegada temprana antes de filas · Hogsmeade"),
      mk(11,   12,   "Hagrid's Magical Creatures Motorbike",  "miami",  "La mejor atracción — fila temprano o Lightning Lane"),
      mk(12,   13,   "Almuerzo Three Broomsticks",            "comida", "Butterbeer + comida temática"),
      mk(13,   15,   "Universal Studios — Hollywood / NYC",   "miami",  "Minion Land, Fast & Furious, Simpsons"),
      mk(15,   17,   "Epic Universe (si está abierto)",       "miami",  "Verificar apertura nov 2026 — nuevo parque"),
      mk(17,   18,   "Regreso al hotel",                      "logist", ""),
      mk(19.5, 21.5, "Cena Disney Springs",                   "comida", "The BOATHOUSE / Morimoto / Planet Hollywood"),
    ],
  },

  // ── Día 3: Sáb 28 Nov — Orlando libre ────────────────────────────────────
  {
    id: "d2",
    label: "Sáb · Nov 28",
    sub: "Orlando · Día libre",
    flexible: true,
    events: [
      mk(8.5,  9.5,  "Desayuno en hotel",                    "comida", ""),
      mk(10,   13,   "Disney Springs",                        "miami",  "Compras, cafés y ambiente Disney sin entrada"),
      mk(13,   14,   "Almuerzo en Disney Springs",            "comida", "STK / Wolfgang Puck / Rainforest Cafe"),
      mk(14.5, 17,   "Orlando Premium Outlets",               "miami",  "15 min del hotel · Nike, Coach, Michael Kors"),
      mk(17.5, 19,   "Piscina y descanso en hotel",           "barco",  "Pool del Fairfield Inn — preparar maletas"),
      mk(19.5, 21.5, "Última cena en Orlando",                "comida", "Capital Grille o Christner's Prime Steak"),
      mk(22,   23,   "Empacar — check-out mañana temprano",  "logist", "Salida ~8 am hacia Miami"),
    ],
  },

  // ── Día 4: Dom 29 Nov — Check-out & traslado a Miami ─────────────────────
  {
    id: "d3",
    label: "Dom · Nov 29",
    sub: "Traslado Orlando → Miami",
    flexible: false,
    events: [
      mk(8,    9,  "Check-out Fairfield Inn",                "logist", "Cancelación gratis hasta 23 nov · Total USD 630 ✅"),
      mk(9,   12.5,"Viaje en carro Orlando → Miami",         "logist", "~3.5 h por Florida Turnpike / I-95"),
      mk(13,  14.5,"Almuerzo en Miami",                      "comida", ""),
      mk(15,  16,  "Check-in hotel Miami ⏳",                "logist", "1 noche · por reservar (Brickell / cerca del puerto)"),
      mk(17,  19,  "Bayside Marketplace / área del puerto",  "miami",  "Reconocer el puerto — embarque mañana"),
      mk(20,  22,  "Cena + descanso pre-crucero",            "noche",  "Dormir temprano"),
    ],
  },

  // ── Día 5: Lun 30 Nov — Embarque Wonder of the Seas ──────────────────────
  {
    id: "d4",
    label: "Lun · Nov 30",
    sub: "Embarque · Día 1 crucero",
    flexible: false,
    spans: [
      { ...CRUISE_BG, id: "cruise-d4", startEventId: "d4-zarpe", endHour: 25 },
    ],
    events: [
      mk(8,    9,   "Desayuno + check-out hotel Miami",      "logist", ""),
      mk(9,   10.5, "Devolución de carros",                  "logist", "2 Toyota Corolla — devolver en agencia"),
      mk(11,  13,   "Check-in puerto · Wonder of the Seas ✅","logist", "Saldo crucero pendiente de pago · 3 cabinas, USD 806.30 c/u"),
      mk(13,  15.5, "Almuerzo + explorar el barco",          "barco",  "Windjammer, recorrido cubiertas"),
      anchor("d4-zarpe", 16.5, 16.5, "Zarpe de Miami",       "logist", "Departs 4:30 pm"),
      mk(17,  18,   "Drill de seguridad + sail away",        "barco",  ""),
      mk(20,  22,   "Cena + show de bienvenida",             "barco",  "AquaTheater / comedor principal"),
    ],
  },

  // ── Día 6: Mar 1 Dic — Día en el mar ─────────────────────────────────────
  {
    id: "d5",
    label: "Mar · Dic 1",
    sub: "Día en el mar · Día 2",
    flexible: false,
    spans: [{ ...CRUISE_BG, id: "cruise-d5", startHour: 0, endHour: 25 }],
    events: [
      mk(9,    10.5, "FlowRider / Ultimate Abyss",           "barco",  "Llegar temprano para evitar filas"),
      mk(11,   12.5, "Piscina / cubierta superior",          "barco",  ""),
      mk(13,   14,   "Almuerzo Windjammer",                  "comida", ""),
      mk(15,   16.5, "Mini golf Wonder Dunes / North Star",  "barco",  ""),
      mk(19.5, 21,   "Cena especialidad",                    "comida", "Wonderland / 150 Central Park — reservar a bordo"),
      mk(21.5, 23.5, "Show nocturno + Vue Bar",              "noche",  ""),
    ],
  },

  // ── Día 7: Mié 2 Dic — Nassau ─────────────────────────────────────────────
  {
    id: "d6",
    label: "Mié · Dic 2",
    sub: "Nassau, Bahamas · Día 3",
    flexible: false,
    spans: [
      { ...CRUISE_BG, id: "cruise-d6", startHour: 0, endHour: 25 },
      { ...PORT_WINDOW, id: "nassau-port", startEventId: "nassau-dock", endEventId: "nassau-back" },
    ],
    events: [
      anchor("nassau-dock", 7.5, 8, "Atraque en Nassau",    "logist", "Docked 7:30 am"),
      mk(8.5, 12.5, "Royal Beach Club / Pearl Island",       "puerto", "Excursión playa — confirmar a bordo"),
      mk(13,  14,   "Almuerzo bahameño",                     "comida", "Conch, rock lobster"),
      mk(14.5,16.5, "Bay Street + Straw Market",             "puerto", "Compras duty-free"),
      anchor("nassau-back", 17, 17.5, "Regreso al barco",   "logist", "All aboard antes de 5:30 pm"),
      mk(20,  22,   "Cena + casino / teatro",                "noche",  ""),
    ],
  },

  // ── Día 8: Jue 3 Dic — Perfect Day at CocoCay ────────────────────────────
  {
    id: "d7",
    label: "Jue · Dic 3",
    sub: "Perfect Day at CocoCay · Día 4",
    flexible: false,
    spans: [
      { ...CRUISE_BG, id: "cruise-d7", startHour: 0, endHour: 25 },
      { ...PORT_WINDOW, id: "coco-port", startEventId: "coco-dock", endEventId: "coco-back" },
    ],
    events: [
      anchor("coco-dock", 7, 7.5, "Atraque en CocoCay",     "logist", "Docked 7:00 am"),
      mk(8,    10,   "Thrill Waterpark",                     "puerto", "Llegar temprano"),
      mk(10.5, 12.5, "Oasis Lagoon / playa libre",           "puerto", "Piscina de agua dulce más grande del Caribe"),
      mk(13,   14,   "Almuerzo Chill Grill",                 "comida", ""),
      mk(14.5, 16,   "Hideaway Beach (adultos)",             "puerto", "Swim-up bar, DJ"),
      anchor("coco-back", 16.5, 17, "Regreso al barco",     "logist", "All aboard antes de 5:00 pm"),
      mk(20,   22.5, "Última cena + show final",             "barco",  ""),
    ],
  },

  // ── Día 9: Vie 4 Dic — Desembarque & vuelo de regreso ────────────────────
  {
    id: "d8",
    label: "Vie · Dic 4",
    sub: "Desembarque · Miami",
    flexible: false,
    spans: [
      { ...CRUISE_BG, id: "cruise-d8", startHour: 0, endEventId: "d8-arrive" },
    ],
    events: [
      anchor("d8-arrive", 6, 6.5, "Llegada a Miami",         "logist", "Arrives 6:00 am"),
      mk(7.5, 9,    "Desayuno + desembarque",                "logist", "Self-assist sale más rápido"),
      mk(9.5, 12,   "Tiempo libre en Miami",                 "miami",  "South Beach / Wynwood — opcional"),
      mk(12.5,14,   "Almuerzo y traslado a MIA",             "logist", "Aeropuerto Miami International"),
      mk(16,  23,   "Vuelo Miami → [conexión] → Cali ⏳",   "logist", "Por comprar — Copa / Avianca"),
    ],
  },
];
