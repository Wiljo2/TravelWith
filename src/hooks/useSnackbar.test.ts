import { describe, expect, it } from "vitest";
import { nextSnack, snackDuration } from "@/hooks/useSnackbar";

describe("snackbar helpers", () => {
  it("lasts 4s, or 6s with an action", () => {
    expect(snackDuration({ message: "Evento creado" })).toBe(4000);
    expect(snackDuration({ message: "Evento eliminado", action: { label: "Deshacer", run: () => {} } })).toBe(6000);
  });

  it("a new snack replaces the current one with a fresh id", () => {
    const first = nextSnack(null, { message: "a" });
    const second = nextSnack(first, { message: "b" });
    expect(second.message).toBe("b");
    expect(second.id).not.toBe(first.id);
  });
});
