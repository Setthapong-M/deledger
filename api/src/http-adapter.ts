import type { Request as ExpressRequest, Response as ExpressResponse } from "express";

export async function serve(req: ExpressRequest, res: ExpressResponse, handler: (request: Request) => Promise<Response>): Promise<void> {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) for (const part of value) headers.append(name, part);
    else if (value !== undefined) headers.set(name, value);
  }
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of req) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += data.length;
    if (length > 1_048_576) {
      res.status(413).set("cache-control", "no-store").json({ error: { code: "INVALID_INPUT", message: "คำขอมีขนาดใหญ่เกินไป", field: null, current: null } });
      return;
    }
    chunks.push(data);
  }
  const request = new Request(new URL(req.originalUrl, "http://nest.internal"), {
    method: req.method, headers,
    ...(req.method !== "GET" && req.method !== "HEAD" ? { body: Buffer.concat(chunks) } : {}),
  });
  const response = await handler(request);
  res.status(response.status);
  response.headers.forEach((value, name) => { if (name !== "set-cookie") res.setHeader(name, value); });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) res.setHeader("set-cookie", cookies);
  res.send(Buffer.from(await response.arrayBuffer()));
}
