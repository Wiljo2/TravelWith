import { describe, expect, it } from "vitest";
import { savedAgo, syncLabel } from "@/utils/syncLabel";

const T = 1_700_000_000_000;

describe("sync labels", () => {
  it("short labels per state", () => {
    expect(syncLabel("saving")).toBe("Guardando…");
    expect(syncLabel("saved")).toBe("Guardado");
    expect(syncLabel("error")).toBe("Error al guardar");
    expect(syncLabel("idle")).toBe("Al día");
  });

  it("adds how long ago only for saved states older than a minute", () => {
    expect(savedAgo("saved", T, T + 30_000)).toBeNull();
    expect(savedAgo("saved", T, T + 5 * 60_000)).toBe("hace 5 min");
    expect(savedAgo("saved", T, T + 125 * 60_000)).toBe("hace 2 h");
    expect(savedAgo("saving", T, T + 5 * 60_000)).toBeNull();
    expect(savedAgo("saved", null, T)).toBeNull();
  });
});
