const forwardedHeaders = ["accept", "content-type", "cookie", "origin", "cf-access-jwt-assertion", "x-request-id"];

export async function forwardApi(request: Request): Promise<Response> {
  try {
    const origin = process.env.API_ORIGIN;
    if (!origin) throw new Error("API_ORIGIN is required");
    const target = new URL(origin);
    if (target.protocol !== "http:" || target.username || target.password || target.pathname !== "/" || target.search || target.hash) throw new Error("invalid API_ORIGIN");
    const incoming = new URL(request.url);
    target.pathname = incoming.pathname;
    target.search = incoming.search;
    const headers = new Headers();
    for (const name of forwardedHeaders) {
      const value = request.headers.get(name);
      if (value !== null) headers.set(name, value);
    }
    const upstream = await fetch(target, {
      method: request.method, headers, redirect: "manual", cache: "no-store", signal: request.signal,
      ...(request.method !== "GET" && request.method !== "HEAD" ? { body: request.body, duplex: "half" } : {}),
    });
    const responseHeaders = new Headers(upstream.headers);
    for (const name of ["connection", "transfer-encoding", "content-encoding", "content-length"]) responseHeaders.delete(name);
    responseHeaders.set("cache-control", "no-store");
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json({ error: { code: "SERVICE_UNAVAILABLE", message: "บริการยังไม่พร้อมใช้งาน", field: null, current: null } }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
