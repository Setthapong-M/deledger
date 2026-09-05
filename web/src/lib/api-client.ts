export type SetupKind = "fixed" | "variable";
export type ReconciliationState = "draft" | "needs_information" | "inconsistent" | "reconciled";
export type LifecycleState = "onboarding_required" | "resume_required" | "ready" | "closed_until_boundary";

export type MonthView = {
  month: string;
  lifecycle: "open" | "closed";
  closedBy: "manual" | "automatic" | null;
  trackedFrom: string;
  isPartial: boolean;
  revision: string;
  summary: {
    startingBalance: string | null;
    income: string | null;
    endingBalance: string | null;
    latestSnapshot: { id: string; observedOn: string; amount: string } | null;
    referenceKind: "ending_balance" | "snapshot" | null;
    referenceAmount: string | null;
    monthlySpending: string | null;
    provisionalSpending: string | null;
    detailTotal: string;
    unitemizedSpending: string | null;
  };
  reconciliation: { state: ReconciliationState; issueCodes: string[] };
  setup: Array<{
    id: string;
    position: number;
    name: string;
    kind: SetupKind;
    fixedAmount: string | null;
    isPaused: boolean;
    detail: {
      confirmedName: string;
      confirmedKind: SetupKind;
      confirmedAmount: string;
      confirmedAt: string;
    } | null;
  }>;
  allowedActions: {
    editIncome: boolean;
    recordSnapshot: boolean;
    editEndingBalance: boolean;
    manageSetup: boolean;
    confirmDetails: boolean;
    manualClose: boolean;
  };
  affectedMonthKeys: string[];
};

export type Bootstrap = { state: LifecycleState; month: MonthView | null };
export type AuthMode = { environment: "local" | "qas" | "prod" };
export type UserProfile = { email: string | null; phone: string | null; dateOfBirth: string | null };
export type HistoryEntry =
  | { kind: "month"; id: string; view: MonthView }
  | { kind: "tracking_gap"; id: string; archivedAt: string; restoredAt: string | null };

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly current: MonthView | null;
  readonly field: string | null;

  constructor(status: number, error: { code: string; message: string; current?: MonthView | null; field?: string | null }) {
    super(error.message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = error.code;
    this.current = error.current ?? null;
    this.field = error.field ?? null;
  }
}

export function isAuthenticationError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError && (error.status === 401 || error.code === "ACCESS_TOKEN_MISSING" || error.code === "SESSION_INVALID");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { accept: "application/json", ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers },
    credentials: "same-origin",
  });
  const payload = (await response.json().catch(() => null)) as { data?: T; error?: { code: string; message: string; current?: MonthView | null; field?: string | null } } | null;
  if (!response.ok || !payload?.data) {
    throw new ApiClientError(response.status, payload?.error ?? { code: "INTERNAL_ERROR", message: "เกิดข้อผิดพลาดภายในระบบ" });
  }
  return payload.data;
}

export const api = {
  authMode: () => request<AuthMode>("/api/auth/mode"),
  login: (identifier: string) => request<{ authenticated: true }>("/api/auth/login", { method: "POST", body: JSON.stringify({ identifier }) }),
  logout: () => request<{ authenticated: false }>("/api/auth/logout", { method: "POST", body: JSON.stringify({}) }),
  profile: () => request<UserProfile>("/api/profile"),
  updateProfile: (payload: { email?: string | null; phone?: string | null; dateOfBirth?: string | null }) => request<UserProfile>("/api/profile", { method: "PATCH", body: JSON.stringify(payload) }),
  bootstrap: () => request<Bootstrap>("/api/bootstrap"),
  current: () => request<Bootstrap>("/api/months/current"),
  month: (month: string) => request<MonthView>(`/api/months/${encodeURIComponent(month)}`),
  history: (before?: string) => request<HistoryEntry[]>(`/api/months${before ? `?before=${encodeURIComponent(before)}` : ""}`),
  onboarding: (payload: { openingBalance: string; income: string }) => request<MonthView>("/api/onboarding", { method: "POST", body: JSON.stringify(payload) }),
  resume: (payload: { openingBalance: string; income: string }) => request<MonthView>("/api/resume", { method: "POST", body: JSON.stringify(payload) }),
  income: (month: string, amount: string, revision: string) => request<MonthView>(`/api/months/${month}/income`, { method: "PUT", body: JSON.stringify({ amount, expectedRevision: revision }) }),
  endingBalance: (month: string, amount: string, revision: string) => request<MonthView>(`/api/months/${month}/ending-balance`, { method: "PUT", body: JSON.stringify({ amount, expectedRevision: revision }) }),
  snapshot: (month: string, observedOn: string, amount: string, revision: string) => request<MonthView>(`/api/months/${month}/snapshots`, { method: "POST", body: JSON.stringify({ observedOn, amount, expectedRevision: revision }) }),
  addSetup: (month: string, payload: { name: string; kind: SetupKind; fixedAmount: string | null; expectedRevision: string }) => request<MonthView>(`/api/months/${month}/recurring-expenses`, { method: "POST", body: JSON.stringify(payload) }),
  updateSetup: (month: string, id: string, payload: Record<string, unknown>) => request<MonthView>(`/api/months/${month}/recurring-expenses/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  reorderSetup: (month: string, orderedIds: string[], revision: string) => request<MonthView>(`/api/months/${month}/recurring-expenses/order`, { method: "PUT", body: JSON.stringify({ orderedIds, expectedRevision: revision }) }),
  confirmDetail: (month: string, id: string, amount: string | undefined, revision: string) => request<MonthView>(`/api/months/${month}/details/${id}`, { method: "PUT", body: JSON.stringify({ ...(amount === undefined ? {} : { amount }), expectedRevision: revision }) }),
  cancelDetail: (month: string, id: string, revision: string) => request<MonthView>(`/api/months/${month}/details/${id}?expectedRevision=${encodeURIComponent(revision)}`, { method: "DELETE" }),
  close: (month: string, revision: string) => request<MonthView>(`/api/months/${month}/close`, { method: "POST", body: JSON.stringify({ expectedRevision: revision }) }),
};

export function isMonthView(value: MonthView | Bootstrap): value is MonthView {
  return "summary" in value;
}
