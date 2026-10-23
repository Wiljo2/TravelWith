import { describe, expect, it } from "vitest";
import {
  PENDING_JOIN_TTL_MS, inviteLink, inviteMessage, inviteText, parsePendingJoin, serializePendingJoin, whatsappUrl,
} from "@/utils/invite";

const NOW = 1_800_000_000_000;

describe("inviteLink", () => {
  it("points at the app root with the join param", () => {
    expect(inviteLink("https://travelwith.app", "ABC123XYZ9")).toBe("https://travelwith.app/?join=ABC123XYZ9");
  });
});

describe("inviteText / inviteMessage", () => {
  it("names the trip", () => {
    expect(inviteText("Cartagena con amigos")).toBe("¡Te invito a planear «Cartagena con amigos» en TravelWith! Únete aquí:");
  });

  it("falls back when the trip has no name", () => {
    expect(inviteText(null)).toBe("¡Te invito a planear nuestro viaje en TravelWith! Únete aquí:");
    expect(inviteText("   ")).toBe("¡Te invito a planear nuestro viaje en TravelWith! Únete aquí:");
  });

  it("appends the link", () => {
    expect(inviteMessage("Lima", "https://x.app/?join=AB12")).toBe("¡Te invito a planear «Lima» en TravelWith! Únete aquí: https://x.app/?join=AB12");
  });
});

describe("whatsappUrl", () => {
  it("encodes the whole message, including the link's query", () => {
    const url = whatsappUrl("¡Hola «Lima»! https://x.app/?join=AB12&y=1");
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(url).not.toContain("&y=");
    expect(decodeURIComponent(url.slice("https://wa.me/?text=".length))).toBe("¡Hola «Lima»! https://x.app/?join=AB12&y=1");
  });
});

describe("parsePendingJoin", () => {
  it("round-trips a fresh invitation", () => {
    expect(parsePendingJoin(serializePendingJoin("ABC123", NOW), NOW + 1000)).toBe("ABC123");
  });

  it("expires after 24 hours", () => {
    const raw = serializePendingJoin("ABC123", NOW);
    expect(parsePendingJoin(raw, NOW + PENDING_JOIN_TTL_MS)).toBe("ABC123");
    expect(parsePendingJoin(raw, NOW + PENDING_JOIN_TTL_MS + 1)).toBeNull();
  });

  it("rejects timestamps from the future", () => {
    expect(parsePendingJoin(serializePendingJoin("ABC123", NOW + 60_000), NOW)).toBeNull();
  });

  it("normalizes and validates the stored code", () => {
    expect(parsePendingJoin(serializePendingJoin(" abc123 ", NOW), NOW)).toBe("ABC123");
    expect(parsePendingJoin(serializePendingJoin("AB-12", NOW), NOW)).toBeNull();
  });

  it("ignores missing or malformed values", () => {
    expect(parsePendingJoin(null, NOW)).toBeNull();
    expect(parsePendingJoin("", NOW)).toBeNull();
    expect(parsePendingJoin("not json", NOW)).toBeNull();
    expect(parsePendingJoin(JSON.stringify({ code: "ABC123" }), NOW)).toBeNull();
    expect(parsePendingJoin(JSON.stringify({ code: 42, at: NOW }), NOW)).toBeNull();
    expect(parsePendingJoin("null", NOW)).toBeNull();
  });
});
