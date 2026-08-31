export type SafeLog = {
  requestId: string;
  ownerId?: string;
  operation: string;
  latencyMs: number;
  resultCode: string;
  month?: string;
};

export function logOperation(entry: SafeLog): void {
  const safe = Object.fromEntries(
    Object.entries(entry).filter(([, value]) => value !== undefined),
  );
  console.info(JSON.stringify(safe));
}
