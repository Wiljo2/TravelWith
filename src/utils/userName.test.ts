import { describe, it, expect } from "vitest";
import { firstName, shortName } from "./userName";

describe("shortName", () => {
  it("keeps the first word of a roster name, without an email domain", () => {
    expect(shortName("  Ana María López ")).toBe("Ana");
    expect(shortName("luis@mail.com")).toBe("luis");
    expect(shortName("   ")).toBe("Alguien");
  });
});

describe("firstName", () => {
  it("takes the first word of the full name", () => {
    expect(firstName({ email: "ana@example.com", user_metadata: { full_name: "  Ana María López " } })).toBe("Ana");
  });

  it("falls back to the email before the @ when the name is blank or missing", () => {
    expect(firstName({ email: "luis.p@example.com", user_metadata: { full_name: "   " } })).toBe("luis.p");
    expect(firstName({ email: "luis.p@example.com", user_metadata: {} })).toBe("luis.p");
  });

  it("returns an empty string without a name or email", () => {
    expect(firstName({ email: undefined, user_metadata: {} })).toBe("");
  });
});
