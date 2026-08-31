export function jsonRequest(url: string, options: { method?: string; body?: unknown; token?: string; origin?: string } = {}): Request {
  const headers = new Headers({ origin: options.origin ?? "http://deledger.internal" });
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.token) headers.set("Cf-Access-Jwt-Assertion", options.token);
  return new Request(url, { method: options.method ?? "GET", headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
}

export async function responseJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}
