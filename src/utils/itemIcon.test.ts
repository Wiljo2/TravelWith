import { describe, expect, it } from "vitest";
import { eventIcon, suggestIcon, taskIcon } from "@/utils/itemIcon";
import { DEFAULT_EVENT_ICON, ICON_CHOICES, ITEM_ICONS } from "@/constants/itemIcons";
import { TASK_CATEGORIES } from "@/constants/taskCategories";

describe("suggestIcon", () => {
  it.each([
    ["Cena en el centro", "🍽️"],
    ["Check-in hotel", "🏨"],
    ["Vuelo MIA → BOG", "✈️"],
    ["Museo del Oro", "🏛️"],
    ["Desayuno en el hotel", "🥐"],
    ["Almuerzo en Café Pacífico", "🍽️"],
    ["Café", "☕"],
    ["Día de playa", "🏖️"],
    ["Parque de diversiones", "🎢"],
    ["Paseo por el parque", "🌳"],
    ["Visita a Disney", "🎢"],
    ["Supermercado", "🛒"],
    ["Tour en barco", "🛳️"],
    ["Snorkel en el arrecife", "🤿"],
    ["Cumpleaños de Ana", "🎂"],
    ["Montaña y volcán", "🏔️"],
  ])("%s -> %s", (title, emoji) => {
    expect(suggestIcon(title)).toBe(emoji);
  });

  it("understands English titles", () => {
    expect(suggestIcon("Dinner at the beach")).toBe("🍽️");
    expect(suggestIcon("Airport pickup")).toBe("✈️");
    expect(suggestIcon("Car rental")).toBe("🚗");
    expect(suggestIcon("Theme park day")).toBe("🎢");
  });

  it("matches plural forms", () => {
    expect(suggestIcon("Museos del centro")).toBe("🏛️");
    expect(suggestIcon("Compras en el outlet")).toBe("🛍️");
    expect(suggestIcon("Playas")).toBe("🏖️");
  });

  it("matches whole words only", () => {
    expect(suggestIcon("Barbacoa")).toBeNull();
    expect(suggestIcon("Bar en la azotea")).toBe("🍸");
  });

  it("returns null for empty or unknown titles", () => {
    expect(suggestIcon("")).toBeNull();
    expect(suggestIcon("   ")).toBeNull();
    expect(suggestIcon("Zzzz qqq")).toBeNull();
  });
});

describe("eventIcon", () => {
  it("prefers the stored icon", () => {
    expect(eventIcon({ title: "Cena", icon: "🎉" })).toBe("🎉");
  });
  it("falls back to the title suggestion, then the default", () => {
    expect(eventIcon({ title: "Cena", icon: null })).toBe("🍽️");
    expect(eventIcon({ title: "Zzzz" })).toBe(DEFAULT_EVENT_ICON);
  });
});

describe("taskIcon", () => {
  it("prefers the stored icon", () => {
    expect(taskIcon({ title: "Reservar hotel", icon: "⭐", cat: "reservar" })).toBe("⭐");
  });
  it("uses the title suggestion before the category icon", () => {
    expect(taskIcon({ title: "Reservar hotel", cat: "comprar" })).toBe("🏨");
  });
  it("falls back to the category icon", () => {
    expect(taskIcon({ title: "Zzzz", cat: "empacar" })).toBe(TASK_CATEGORIES.empacar.icon);
  });
  it("falls back to the default category for unknown or missing categories", () => {
    expect(taskIcon({ title: "Zzzz", cat: "nope" })).toBe(TASK_CATEGORIES.decidir.icon);
    expect(taskIcon({ title: "Zzzz" })).toBe(TASK_CATEGORIES.decidir.icon);
  });
});

describe("ICON_CHOICES", () => {
  it("has no duplicates and includes the default icon", () => {
    expect(new Set(ICON_CHOICES).size).toBe(ICON_CHOICES.length);
    expect(ICON_CHOICES).toContain(DEFAULT_EVENT_ICON);
    for (const { emoji } of Object.values(ITEM_ICONS)) expect(ICON_CHOICES).toContain(emoji);
  });
});
