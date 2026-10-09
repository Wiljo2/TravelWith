import { afterEach, describe, expect, it, vi } from "vitest";
import { siteUrl } from "@/lib/site";

describe("siteUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("prefers NEXT_PUBLIC_SITE_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://travelwith.app");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "tw.vercel.app");
    expect(siteUrl().origin).toBe("https://travelwith.app");
  });

  it("falls back to the Vercel production domain", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "tw.vercel.app");
    expect(siteUrl().origin).toBe("https://tw.vercel.app");
  });

  it("falls back to localhost", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(siteUrl().origin).toBe("http://localhost:3000");
  });
});
