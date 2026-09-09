import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DateInput } from "@/components/date-input";
import { LocaleProvider } from "@/lib/i18n";
import { CalendarProvider, useCalendar } from "@/lib/calendar";
import { api, type MonthView } from "@/lib/api-client";
import { TrackingForm } from "@/components/tracking-form";
import { HistoryCorrections } from "@/components/history-corrections";
import { CalendarControl } from "@/components/calendar-control";
import { BalanceDialog } from "@/components/balance-dialog";
import { LifecycleForm } from "@/components/lifecycle-form";
import MonthPage from "@/app/month/page";
import { ExpenseSetupManager } from "@/components/expense-setup-manager";

vi.mock("next/navigation", () => ({ usePathname: () => "/month" }));

function month(): MonthView {
  return { month: "2026-09", lifecycle: "closed", closedBy: "automatic", openingSource: "supplied", trackedFrom: "2026-09-15", isPartial: true, revision: "7", summary: { startingBalance: "1000.00", income: null, endingBalance: null, latestSnapshot: null, referenceKind: null, referenceAmount: null, monthlySpending: null, provisionalSpending: null, detailTotal: "0.00", unitemizedSpending: null }, reconciliation: { state: "needs_information", issueCodes: [] }, setup: [], allowedActions: { editIncome: true, editEndingBalance: true, recordSnapshot: false, manageSetup: false, confirmDetails: false, manualClose: false }, affectedMonthKeys: ["2026-09"] };
}

const calendar = { businessDate: "2026-09-09", realDate: "2026-09-09", mode: "real", canSimulate: true, clockRevision: "boot:1", minDate: "2024-09-09", maxDate: "2028-09-09" };

afterEach(() => vi.unstubAllGlobals());

it("uses the accounting Today and prevents selection outside server bounds", () => {
  const change = vi.fn();
  render(<LocaleProvider initialLocale="en"><DateInput id="start" value="2026-09-09" today="2026-09-09" min="2026-09-05" max="2026-09-09" onValueChange={change} /></LocaleProvider>);
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("button", { name: "Thursday, 10 September 2026" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Today" }));
  expect(change).toHaveBeenCalledWith("2026-09-09");
});

it("refreshes shared calendar on focus and ignores an obsolete response", async () => {
  let resolveOld!: (response: Response) => void;
  const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { resolveOld = resolve; })).mockResolvedValue(Response.json({ data: { ...calendar, businessDate: "2026-10-01", clockRevision: "boot:2" } }));
  vi.stubGlobal("fetch", fetchMock);
  function Display() { const { calendar } = useCalendar(); return <p>{calendar?.businessDate}</p>; }
  render(<CalendarProvider><Display /></CalendarProvider>);
  fireEvent.focus(window);
  await screen.findByText("2026-10-01");
  resolveOld(Response.json({ data: calendar }));
  await waitFor(() => expect(screen.queryByText("2026-09-09")).not.toBeInTheDocument());
});

it("sends the explicit rendered clock revision on financial writes", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: { month: "2026-09" } }));
  vi.stubGlobal("fetch", fetchMock);
  await api.income("2026-09", "0.00", "0", "boot:1");
  expect(fetchMock).toHaveBeenCalledWith("/api/months/2026-09/income", expect.objectContaining({ headers: expect.objectContaining({ "x-deledger-clock-revision": "boot:1" }) }));
});

it("previews earlier months and submits exact amounts against the authoritative boundary", async () => {
  const fetchMock = vi.fn((path: string) => Promise.resolve(Response.json({ data: path === "/api/calendar" ? calendar : { month: { month: "2026-08" }, createdMonthKeys: ["2026-08"], affectedMonthKeys: ["2026-08"] } })));
  vi.stubGlobal("fetch", fetchMock);
  const complete = vi.fn();
  render(<LocaleProvider initialLocale="en"><CalendarProvider><TrackingForm mode="backfill" options={{ businessDate: "2026-09-09", earliestMonth: "2026-09", earliestRevision: "7", prepend: { allowed: true, reason: null, minDate: "2024-09-01", maxDate: "2026-08-31" }, restart: { allowed: false, reason: null, month: null, expectedRevision: null, minDate: null, maxDate: null } }} onComplete={complete} /></CalendarProvider></LocaleProvider>);
  await screen.findByText(/2026-08 → 2026-08/);
  fireEvent.change(screen.getByLabelText("Balance on the start date"), { target: { value: "1000.50" } });
  fireEvent.change(screen.getByLabelText(/Income from/), { target: { value: "0.00" } });
  fireEvent.click(screen.getByRole("button", { name: "Add earlier months" }));
  await waitFor(() => expect(complete).toHaveBeenCalled());
  expect(fetchMock).toHaveBeenCalledWith("/api/months/backfill", expect.objectContaining({ body: JSON.stringify({ startDate: "2026-08-31", openingBalance: "1000.50", income: "0.00", expectedEarliestMonth: "2026-09", expectedEarliestRevision: "7" }) }));
});

it("requires a second confirmation to restart and preserves amounts across clock review", async () => {
  let current = { ...calendar, businessDate: "2026-10-09" };
  const options = { businessDate: "2026-10-09", earliestMonth: "2026-09", earliestRevision: "7", prepend: { allowed: false, reason: null, minDate: null, maxDate: null }, restart: { allowed: true, reason: null, month: "2026-10", expectedRevision: "0", minDate: "2026-10-01", maxDate: "2026-10-09" } };
  const fetchMock = vi.fn((path: string) => Promise.resolve(Response.json({ data: path === "/api/calendar" ? current : path === "/api/tracking/options" ? options : month() })));
  vi.stubGlobal("fetch", fetchMock);
  const complete = vi.fn();
  render(<LocaleProvider initialLocale="en"><CalendarProvider><TrackingForm mode="restart" options={options} onComplete={complete} /></CalendarProvider></LocaleProvider>);
  fireEvent.change(await screen.findByLabelText("Balance on the start date"), { target: { value: "1000.50" } });
  fireEvent.change(screen.getByLabelText(/Income from/), { target: { value: "0.00" } });
  current = { ...current, clockRevision: "boot:2" };
  fireEvent.focus(window);
  await screen.findByText("The period changed. Check your amounts against the new dates.");
  expect(screen.getByRole("button", { name: "Start fresh" })).toBeDisabled();
  expect(screen.getByLabelText("Balance on the start date")).toHaveValue("1000.50");
  fireEvent.click(screen.getByRole("button", { name: "I have reviewed the date and amounts" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Start fresh" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Start fresh" }));
  expect(complete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm fresh start" }));
  await waitFor(() => expect(complete).toHaveBeenCalled());
  expect(fetchMock).toHaveBeenCalledWith("/api/months/2026-10/restart", expect.objectContaining({ headers: expect.objectContaining({ "x-deledger-clock-revision": "boot:2" }), body: JSON.stringify({ startDate: "2026-10-09", openingBalance: "1000.50", income: "0.00", expectedRevision: "0" }) }));
});

it("corrects a closed partial month using exact revision without refreshing across its supplied boundary", async () => {
  const fetchMock = vi.fn((path: string) => Promise.resolve(Response.json({ data: path === "/api/calendar" ? calendar : { ...month(), revision: "8", summary: { ...month().summary, income: "25.50" } } })));
  vi.stubGlobal("fetch", fetchMock);
  const change = vi.fn();
  function Ready() { const { calendar } = useCalendar(); return calendar ? <HistoryCorrections view={month()} onChange={change} /> : null; }
  render(<LocaleProvider initialLocale="en"><CalendarProvider><Ready /></CalendarProvider></LocaleProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Edit income" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("30 Sept 2026");
  fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "25.50" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(change).toHaveBeenCalled());
  expect(fetchMock).toHaveBeenCalledWith("/api/months/2026-09/income", expect.objectContaining({ headers: expect.objectContaining({ "x-deledger-clock-revision": "boot:1" }), body: JSON.stringify({ amount: "25.50", expectedRevision: "7" }) }));
  expect(fetchMock.mock.calls.map(call => call[0])).not.toContain("/api/months/2026-10");
});

it("confirms an instance-wide clock reset before issuing a PATCH", async () => {
  const fetchMock = vi.fn((path: string) => Promise.resolve(Response.json({ data: path === "/api/calendar" ? { ...calendar, mode: "simulated" } : { ...calendar, clockRevision: "boot:2" } })));
  vi.stubGlobal("fetch", fetchMock);
  render(<LocaleProvider initialLocale="en"><CalendarProvider><CalendarControl /></CalendarProvider></LocaleProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Return to real date" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("does not undo records");
  expect(fetchMock.mock.calls.map(call => call[0])).not.toContain("/api/local/clock");
  fireEvent.click(screen.getByRole("button", { name: "Acknowledge and change date" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/local/clock", expect.objectContaining({ body: JSON.stringify({ date: null, expectedClockRevision: "boot:1", acknowledged: true }) })));
});

it("keeps an open amount intact and blocks saving after calendar refresh", async () => {
  let current = calendar;
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(Response.json({ data: current }))));
  const submit = vi.fn();
  function Ready() { const { calendar } = useCalendar(); return calendar ? <BalanceDialog title="Income" onClose={() => {}} onSubmit={submit} /> : null; }
  render(<LocaleProvider initialLocale="en"><CalendarProvider><Ready /></CalendarProvider></LocaleProvider>);
  fireEvent.change(await screen.findByLabelText("Amount"), { target: { value: "99.50" } });
  current = { ...calendar, clockRevision: "boot:2" };
  fireEvent.focus(window);
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Amount")).toHaveValue("99.50");
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  expect(submit).not.toHaveBeenCalled();
});

it("lets resume review a changed calendar while retaining its amounts", async () => {
  let current = calendar;
  const fetchMock = vi.fn((path: string) => Promise.resolve(Response.json({ data: path === "/api/calendar" ? current : path === "/api/bootstrap" ? { state: "resume_required", businessDate: current.businessDate, month: null } : month() })));
  vi.stubGlobal("fetch", fetchMock);
  function Ready() { const { calendar } = useCalendar(); return calendar ? <LifecycleForm mode="resume" onComplete={() => {}} /> : null; }
  render(<LocaleProvider initialLocale="en"><CalendarProvider><Ready /></CalendarProvider></LocaleProvider>);
  fireEvent.change(await screen.findByLabelText("Opening balance"), { target: { value: "125.50" } });
  fireEvent.change(screen.getByLabelText("This month’s income"), { target: { value: "0.00" } });
  current = { ...calendar, clockRevision: "boot:2" };
  fireEvent.focus(window);
  fireEvent.click(await screen.findByRole("button", { name: "Review date and amounts" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Resume tracking" })).toBeEnabled());
  expect(screen.getByLabelText("Opening balance")).toHaveValue("125.50");
  fireEvent.click(screen.getByRole("button", { name: "Resume tracking" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/resume", expect.objectContaining({ headers: expect.objectContaining({ "x-deledger-clock-revision": "boot:2" }) })));
});

it("withholds financial controls until the current month is fetched for the new calendar", async () => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  let currentCalendar = { ...calendar, businessDate: "2026-10-09" };
  let delayed!: (response: Response) => void;
  let monthReads = 0;
  vi.stubGlobal("fetch", vi.fn((path: string) => {
    if (path === "/api/calendar") return Promise.resolve(Response.json({ data: currentCalendar }));
    if (path === "/api/months/current" && ++monthReads > 1) return new Promise<Response>(resolve => { delayed = resolve; });
    if (path === "/api/months/current") return Promise.resolve(Response.json({ data: { state: "ready", businessDate: currentCalendar.businessDate, month: { ...month(), month: "2026-10", lifecycle: "open" } } }));
    if (path === "/api/auth/mode") return Promise.resolve(Response.json({ data: { environment: "local" } }));
    return Promise.resolve(Response.json({ data: { businessDate: currentCalendar.businessDate, earliestMonth: "2026-09", earliestRevision: "7", prepend: { allowed: false }, restart: { allowed: false } } }));
  }));
  function Ready() { const { calendar } = useCalendar(); return calendar ? <MonthPage /> : null; }
  render(<LocaleProvider initialLocale="en"><CalendarProvider><Ready /></CalendarProvider></LocaleProvider>);
  await screen.findByRole("button", { name: "Edit income" });
  currentCalendar = { ...calendar, clockRevision: "boot:2" };
  fireEvent.focus(window);
  await waitFor(() => expect(screen.queryByRole("button", { name: "Edit income" })).not.toBeInTheDocument());
  delayed(Response.json({ data: { state: "ready", businessDate: "2026-09-09", month: month() } }));
  await screen.findByRole("button", { name: "Edit income" });
  expect(screen.getByRole("heading", { name: "September 2026" })).toBeInTheDocument();
});

it("keeps the setup draft open when its save fails", async () => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(Response.json({ error: { code: "REVISION_CONFLICT", message: "", current: null } }, { status: 409 }))));
  render(<LocaleProvider initialLocale="en"><ExpenseSetupManager view={{ ...month(), allowedActions: { ...month().allowedActions, manageSetup: true } }} onChange={() => {}} /></LocaleProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Add expense" }));
  fireEvent.change(screen.getByLabelText("Expense name"), { target: { value: "Keep this draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
  await screen.findAllByText(/This month changed in another tab/);
  expect(screen.getByLabelText("Expense name")).toHaveValue("Keep this draft");
});
