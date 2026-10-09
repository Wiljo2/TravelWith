import { describe, expect, it } from "vitest";
import { shouldEnterApp, type EntryEnv } from "@/components/landing/entry";

const base: EntryEnv = {
  search: "",
  storageKeys: [],
  offline: false,
  hasSnapshot: false,
  standalone: false,
  localModeEnabled: false,
};

describe("shouldEnterApp", () => {
  it("stays on the landing by default", () => {
    expect(shouldEnterApp(base)).toBe(false);
    expect(shouldEnterApp({ ...base, storageKeys: ["theme", "sb-x-other"] })).toBe(false);
  });

  it("enters from the CTA", () => {
    expect(shouldEnterApp({ ...base, search: "?app=1" })).toBe(true);
  });

  it("enters on an OAuth callback code", () => {
    expect(shouldEnterApp({ ...base, search: "?code=abc" })).toBe(true);
  });

  it("enters on OAuth errors", () => {
    expect(shouldEnterApp({ ...base, search: "?error=access_denied" })).toBe(true);
    expect(shouldEnterApp({ ...base, search: "?error_description=nope" })).toBe(true);
  });

  it("honors local mode only when enabled", () => {
    expect(shouldEnterApp({ ...base, search: "?local=1" })).toBe(false);
    expect(shouldEnterApp({ ...base, search: "?local=1", localModeEnabled: true })).toBe(true);
  });

  it("enters when a Supabase session exists", () => {
    expect(shouldEnterApp({ ...base, storageKeys: ["sb-abcdef-auth-token"] })).toBe(true);
  });

  it("enters offline only with a snapshot", () => {
    expect(shouldEnterApp({ ...base, offline: true })).toBe(false);
    expect(shouldEnterApp({ ...base, hasSnapshot: true })).toBe(false);
    expect(shouldEnterApp({ ...base, offline: true, hasSnapshot: true })).toBe(true);
  });

  it("enters when running as an installed PWA", () => {
    expect(shouldEnterApp({ ...base, standalone: true })).toBe(true);
  });
});
