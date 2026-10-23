import { afterEach, describe, expect, it, vi } from "vitest";
import { joinTrip } from "@/lib/joinTrip";

function stubFetch(impl: () => Promise<Response>) {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("joinTrip", () => {
  it("posts to the members endpoint with the token", async () => {
    const fetchMock = stubFetch(async () => new Response("{}", { status: 200 }));
    expect(await joinTrip("ABC123", "tok")).toBe("joined");
    const [path, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe("/api/rooms/ABC123/members");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok");
  });

  it("reports unknown codes", async () => {
    stubFetch(async () => new Response("{}", { status: 404 }));
    expect(await joinTrip("ABC123", "tok")).toBe("notFound");
  });

  it("reports other server errors as failures", async () => {
    stubFetch(async () => new Response("{}", { status: 500 }));
    expect(await joinTrip("ABC123", "tok")).toBe("failed");
    stubFetch(async () => new Response("{}", { status: 401 }));
    expect(await joinTrip("ABC123", undefined)).toBe("failed");
  });

  it("fails without network when the device has no copy of the trip", async () => {
    stubFetch(async () => { throw new TypeError("Failed to fetch"); });
    expect(await joinTrip("ABC123", "tok")).toBe("failed");
  });

  it("opens the device's copy without network", async () => {
    const snapshot = JSON.stringify({ payload: { days: [] }, members: [], savedAt: "2026-10-01T00:00:00Z" });
    vi.stubGlobal("localStorage", { getItem: (key: string) => (key === "tw:room:ABC123" ? snapshot : null) });
    stubFetch(async () => { throw new TypeError("Failed to fetch"); });
    expect(await joinTrip("ABC123", "tok")).toBe("offline");
  });
});
