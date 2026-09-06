import { afterEach, expect, it, vi } from "vitest";
import { forwardApi } from "../../src/lib/server-api";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("forwards credentials and exact API response while discarding caller identity shortcuts", async () => {
  vi.stubEnv("API_ORIGIN", "http://127.0.0.1:3001");
  const upstream = vi.fn(async (_url: URL, init: RequestInit) => {
    const headers = new Headers(init.headers);
    expect(headers.get("cookie")).toBe("deledger_local_session=token");
    expect(headers.get("cf-access-jwt-assertion")).toBe("signed-assertion");
    expect(headers.get("x-user-id")).toBeNull();
    expect(headers.get("origin")).toBe("http://127.0.0.1:3000");
    return Response.json({ error: { code: "REVISION_CONFLICT", current: { revision: "9" } } }, { status: 409, headers: { "set-cookie": "session=value; HttpOnly", "cache-control": "no-store" } });
  });
  vi.stubGlobal("fetch", upstream);
  const response = await forwardApi(new Request("http://127.0.0.1:3000/api/months?before=2026-08", { headers: { cookie: "deledger_local_session=token", "cf-access-jwt-assertion": "signed-assertion", "x-user-id": "forged", origin: "http://127.0.0.1:3000" } }));
  expect(response.status).toBe(409);
  expect(response.headers.get("set-cookie")).toBe("session=value; HttpOnly");
  expect(await response.json()).toEqual({ error: { code: "REVISION_CONFLICT", current: { revision: "9" } } });
  expect(upstream.mock.calls[0][0].href).toBe("http://127.0.0.1:3001/api/months?before=2026-08");
});
