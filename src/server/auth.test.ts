import { describe, it, expect, vi } from "vitest";
import { auth, request, resetDb, supabaseServerMock } from "@/test/routeHelpers";

vi.mock("@/lib/supabase-server", () => supabaseServerMock);

const { bearerToken, requireMember, requireUser } = await import("./auth");

describe("bearerToken", () => {
  it("extracts the token from a Bearer header", () => {
    expect(bearerToken(request("GET", "abc"))).toBe("abc");
  });

  it("ignores other schemes and empty headers", () => {
    const basic = new Request("http://localhost", { headers: { Authorization: "Basic abc" } });
    expect(bearerToken(basic)).toBeNull();
    expect(bearerToken(request("GET"))).toBeNull();
  });
});

describe("requireUser / requireMember", () => {
  it("throws 401 for unknown tokens", async () => {
    auth.users = {};
    await expect(requireUser(request("GET", "bad"))).rejects.toMatchObject({ status: 401 });
  });

  it("returns the member role and enforces owner-only access", async () => {
    auth.users = { tok: { id: "u1" } };
    resetDb(() => ({ data: { role: "member" } }));
    await expect(requireMember(request("GET", "tok"), "ABC123")).resolves.toMatchObject({ role: "member" });
    await expect(requireMember(request("GET", "tok"), "ABC123", "owner")).rejects.toMatchObject({ status: 403 });
  });

  it("throws 403 when there is no membership row", async () => {
    auth.users = { tok: { id: "u1" } };
    resetDb(() => ({ data: null }));
    await expect(requireMember(request("GET", "tok"), "ABC123")).rejects.toMatchObject({ status: 403 });
  });
});
