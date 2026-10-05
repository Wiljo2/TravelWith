import { CRUISE_PLACE, normalizeText, seedPlaces } from "@/utils/ideas";
import type { Day } from "@/types";

// The places ideas are organized by. Two levels, both read from the itinerary:
// - areas: the cities/stops of each day ("Orlando", "Nassau", "Crucero"), from
//   day subtitles and the destination (see seedPlaces);
// - venues: the specific spots the plan visits ("Disney Springs", "Orlando
//   Premium Outlets", "South Beach"), from activity titles and notes.
// Venues are more precise, so they win over their area when both match.

export interface TripPlace {
  name: string;
  aliases: string[];      // other names that point here ("Hogsmeade", "Miami Beach", "Nike")
  dayIds: string[];       // days it is visited
  eventIds: string[];     // activities held there; empty = the whole day (an area)
  parents: string[];      // the areas of those days (venues only)
  anchors?: string[];     // activities that are the visit itself ("Universal" for Universal Studios Orlando)
}

// Well-known synonyms the itinerary wouldn't spell out.
const KNOWN_ALIASES: Record<string, string[]> = {
  "south beach": ["Miami Beach", "Ocean Drive"],
  "disney springs": ["Downtown Disney"],
  wynwood: ["Wynwood Walls"],
};

const CONNECTORS = new Set(["of", "the", "at", "de", "del", "la", "el", "los", "las", "and", "&"]);
// Capitalized words that still describe an activity, not a spot.
const GENERIC = new Set(normalizeText(
  "piscina playa libre cubierta show cena almuerzo desayuno brunch casino teatro descanso hotel puerto barco " +
  "compras excursion regreso traslado vuelo drill tiempo visita noche empacar llegada salida pool bar " +
  "incluido reserva opcional temprano idea",
).split(" "));
const LEADING_MEAL = /^(ultima |primera )?(cena|almuerzo|desayuno|brunch|comida|tiempo libre|visita|tour)( en| a| al| de)?\s+/i;

const isCapitalized = (w: string) => /^[\p{Lu}\d]/u.test(w);

// Proper names in a phrase: runs of capitalized words ("Mini golf Wonder Dunes"
// → "Wonder Dunes"). A single capitalized word counts only when it is the whole
// phrase, since Spanish capitalizes the first word of any label.
// `listed`: the name is the whole phrase ("Nike, Coach"), not part of a sentence.
function properNames(phrase: string): { name: string; listed: boolean }[] {
  const clean = phrase.replace(/\([^)]*\)/g, " ").replace(/[^\p{L}\p{N}\s'&-]/gu, " ").replace(/\s+/g, " ").trim();
  // "Cena Disney Springs" → "Disney Springs" (accent removal keeps the length).
  const meal = normalizeText(clean).match(LEADING_MEAL);
  const words = (meal ? clean.slice(meal[0].length) : clean).split(" ").filter(Boolean);
  const isConnector = (w: string) => CONNECTORS.has(w.toLowerCase());
  const total = words.filter((w) => !isConnector(w)).length;
  const out: { name: string; listed: boolean }[] = [];
  let run: string[] = [];
  const flush = () => {
    while (run.length && isConnector(run[run.length - 1])) run.pop();
    // "Pool del Fairfield Inn" → "Fairfield Inn"
    while (run.length > 1 && (isConnector(run[0]) || GENERIC.has(normalizeText(run[0])))) run.shift();
    const content = run.filter((w) => !isConnector(w));
    const whole = content.length === total;
    if (content.length >= 2 || (content.length === 1 && whole && content[0].length >= 4 && !GENERIC.has(normalizeText(content[0])))) {
      out.push({ name: run.join(" "), listed: whole });
    }
    run = [];
  };
  for (const w of words) {
    if (isCapitalized(w) || (run.length > 0 && isConnector(w))) run.push(w);
    else flush();
  }
  flush();
  return out;
}

// Names in a title or note: each " / ", "+", "·", ",", " o " or " en " part
// ("Almuerzo en Miami en Brickell" → Miami, Brickell). Links are skipped.
const namesDetail = (text: string) =>
  text.replace(/https?:\/\/\S+/g, " ")
    .split(/\s+[—–-]\s+|\/|\+|·|,|\s+o\s+|\s+or\s+|\s+en\s+/)
    .flatMap((part) => properNames(part.trim()));
const namesIn = (text: string) => namesDetail(text).map((n) => n.name);

const key = (s: string) => normalizeText(s).replace(/[^a-z0-9ñ]+/g, " ").trim();

// Cruise embarkation/disembarkation: logistics, but a place people make videos about.
const PORT_PLACES = [
  { sub: /^\s*embarque/i, event: /puerto|check-in|embarque|terminal/i, name: "Embarque del crucero",
    aliases: ["embarque", "embarcar", "terminal del crucero", "check-in del crucero", "embarkation", "boarding"] },
  { sub: /desembarque/i, event: /desembarque/i, name: "Desembarque del crucero",
    aliases: ["desembarque", "desembarcar", "disembarkation", "self-assist"] },
];

export function tripPlaces(destination: string | undefined, days: Day[], custom?: string[]): TripPlace[] {
  const baseNames = custom ?? seedPlaces(destination, days);
  const baseByKey = new Map(baseNames.map((n) => [key(n), n]));
  const dayAreas = new Map(days.map((d) => [
    d.id, seedPlaces(undefined, [d]).map((p) => baseByKey.get(key(p))).filter((p): p is string => !!p),
  ]));
  // A name that is (part of) an area: "Universal Studios" → "Universal Studios Orlando".
  const areaOf = (n: string) => {
    const k = key(n);
    return baseNames.find((b) => key(b) === k) ?? baseNames.find((b) => ` ${key(b)} `.includes(` ${k} `));
  };

  // Day subtitles go stale when the plan is edited (Friday still says "Universal"
  // after the park moved to Saturday). An area inside a wider one ("Universal
  // Studios Orlando" ⊃ "Orlando") that activities name lives on those days; a day
  // it no longer has keeps the wider area.
  const anchors = new Map<string, string[]>();
  for (const area of baseNames) {
    const wider = baseNames.find((b) => b !== area && ` ${key(area)} `.includes(` ${key(b)} `));
    if (!wider) continue;
    anchors.set(area, days.flatMap((d) => d.events)
      .filter((e) => e.cat !== "logist" && namesIn(e.title).some((n) => areaOf(n) === area)).map((e) => e.id));
    const named = new Set(days.filter((d) => d.events.some((e) => namesIn(e.title).some((n) => areaOf(n) === area))).map((d) => d.id));
    if (named.size === 0) continue;
    for (const d of days) {
      const list = dayAreas.get(d.id)!;
      if (list.includes(area) && !named.has(d.id)) {
        list.splice(list.indexOf(area), 1);
        if (!list.includes(wider)) list.push(wider);
      } else if (!list.includes(area) && named.has(d.id)) {
        list.push(area);
      }
    }
  }

  const base = new Map<string, TripPlace>(baseNames.map((name) => [name, {
    name, aliases: [], dayIds: days.filter((d) => dayAreas.get(d.id)!.includes(name)).map((d) => d.id), eventIds: [], parents: [],
    ...(anchors.get(name)?.length ? { anchors: anchors.get(name) } : {}),
  }]));

  const venues: TripPlace[] = [];
  const byName = new Map<string, TripPlace>();
  const addVenue = (names: string[], day: Day, eventId: string, aliases: string[]) => {
    let v = names.map((n) => byName.get(key(n))).find(Boolean);
    if (!v) {
      v = { name: names.join(" / "), aliases: [], dayIds: [], eventIds: [], parents: [] };
      venues.push(v);
    }
    for (const n of names) byName.set(key(n), v);
    for (const n of names.slice(1)) if (key(n) !== key(v.name) && !v.name.includes(n)) v.aliases.push(n);
    v.aliases.push(...aliases);
    if (!v.dayIds.includes(day.id)) v.dayIds.push(day.id);
    if (!v.eventIds.includes(eventId)) v.eventIds.push(eventId);
    for (const a of dayAreas.get(day.id) ?? []) if (!v.parents.includes(a)) v.parents.push(a);
  };

  for (const day of days) {
    for (const ev of day.events) {
      if (ev.cat === "logist") continue;
      const titleNames = namesIn(ev.title);
      const noteDetail = namesDetail(ev.note ?? "");
      const noteNames = noteDetail.map((n) => n.name);
      const areas = titleNames.map(areaOf).filter((a): a is string => !!a);
      const own = titleNames.filter((n) => !areaOf(n));
      if (own.length) {
        // A list in the note describes this venue ("Nike, Coach"); a name inside a
        // sentence is another stop ("…y pasar por Design District").
        addVenue(own, day, ev.id, noteDetail.filter((n) => n.listed).map((n) => n.name));
        for (const n of noteDetail) if (!n.listed && !areaOf(n.name)) addVenue([n.name], day, ev.id, []);
      } else if (areas.length) {
        // "Tiempo libre en Miami: South Beach / Wynwood": the note lists the area's spots.
        for (const n of noteNames) if (!areaOf(n)) addVenue([n], day, ev.id, []);
      } else {
        for (const n of noteNames) if (!areaOf(n)) addVenue([n], day, ev.id, []); // "Cena especialidad: Wonderland / 150 Central Park"
      }
    }
    for (const port of PORT_PLACES) {
      if (!port.sub.test(day.sub ?? "")) continue;
      const events = day.events.filter((e) => port.event.test(e.title));
      for (const e of events.length ? events : day.events) addVenue([port.name], day, e.id, []);
      byName.get(key(port.name))!.aliases = [...new Set([...byName.get(key(port.name))!.aliases, ...port.aliases])];
    }
  }
  for (const v of venues) {
    for (const [k, extra] of Object.entries(KNOWN_ALIASES)) if (key(v.name).includes(k)) v.aliases.push(...extra);
    v.aliases = [...new Map(v.aliases.filter((a) => key(a) && key(a) !== key(v.name)).map((a) => [key(a), a])).values()];
  }

  // Trip order: each day's areas, then its venues; then the rest (destination, custom).
  const ordered: TripPlace[] = [];
  const seen = new Set<TripPlace>();
  const push = (p?: TripPlace) => { if (p && !seen.has(p)) { seen.add(p); ordered.push(p); } };
  for (const day of days) {
    for (const a of dayAreas.get(day.id) ?? []) push(base.get(a));
    for (const v of venues) if (v.dayIds[0] === day.id) push(v);
  }
  for (const p of base.values()) push(p);
  return ordered;
}

export const isVenue = (p: TripPlace) => p.eventIds.length > 0;
export const placeNames = (places: TripPlace[]) => places.map((p) => p.name);
export const findPlace = (places: TripPlace[], name: string | undefined) => (name ? places.find((p) => p.name === name) : undefined);

// Places of a day: its areas and the venues visited that day.
export function placesOfDay(day: Day, places: TripPlace[]): string[] {
  return places.filter((p) => p.dayIds.includes(day.id)).map((p) => p.name);
}

export { CRUISE_PLACE };

// The wide area ("Orlando", "Miami", "Crucero") each place belongs to: a venue
// goes to its area, and an area inside a wider one ("Universal Studios Orlando")
// to the wider one.
export function zonesOf(places: TripPlace[]): Map<string, string> {
  const areas = places.filter((p) => !isVenue(p)).map((p) => p.name);
  const pad = (s: string) => ` ${normalizeText(s).replace(/[^a-z0-9ñ]+/g, " ").trim()} `;
  const widest = (area: string) =>
    areas.filter((b) => b !== area && pad(area).includes(pad(b))).sort((x, y) => x.length - y.length)[0] ?? area;
  return new Map(places.map((p) => {
    const area = isVenue(p) ? [...p.parents].sort((x, y) => x.length - y.length)[0] : p.name;
    return [p.name, area ? widest(area) : p.name];
  }));
}
