import { describe, it, expect } from "vitest";
import type { User } from "@supabase/supabase-js";
import { memberProfile } from "./members";
import { generateRoomCode } from "./room-code";
import { normalizeRoomCode } from "@/lib/validate";

const user = (meta: Record<string, unknown>, email = "a@b.co") => ({ id: "u1", email, user_metadata: meta }) as unknown as User;

describe("memberProfile", () => {
  it("keeps Google avatars and caps the name", () => {
    const p = memberProfile(user({ full_name: "N".repeat(120), avatar_url: "https://lh3.googleusercontent.com/a/x" }));
    expect(p.name).toHaveLength(80);
    expect(p.avatar).toBe("https://lh3.googleusercontent.com/a/x");
  });

  it("drops avatars from other hosts or schemes", () => {
    expect(memberProfile(user({ avatar_url: "https://tracker.example/p.gif" })).avatar).toBeNull();
    expect(memberProfile(user({ avatar_url: "http://lh3.googleusercontent.com/a" })).avatar).toBeNull();
    expect(memberProfile(user({ avatar_url: "not a url" })).avatar).toBeNull();
  });

  it("falls back to the email, then a placeholder", () => {
    expect(memberProfile(user({})).name).toBe("a@b.co");
    expect(memberProfile(user({ full_name: "   " }, "")).name).toBe("Usuario");
  });
});

describe("generateRoomCode", () => {
  it("produces 10 unambiguous symbols accepted by normalizeRoomCode", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateRoomCode()));
    expect(codes.size).toBe(200);
    for (const code of codes) {
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
      expect(normalizeRoomCode(code)).toBe(code);
    }
  });
});
