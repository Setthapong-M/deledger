export async function GET(): Promise<Response> {
  return Response.json({ data: { status: "ok" } }, { headers: { "cache-control": "no-store" } });
}
