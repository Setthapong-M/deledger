import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleForm } from "@/components/lifecycle-form";
import { LanguageControl } from "@/components/language-control";
import type { MonthView } from "@/lib/api-client";
import { LocaleProvider } from "@/lib/i18n";

const responseView = { month: "2026-08" } as MonthView;

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = "deledger_locale=; Max-Age=0; Path=/";
  document.documentElement.removeAttribute("lang");
});

describe("LifecycleForm", () => {
  it("requires both money inputs and submits decimal strings", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: responseView }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const complete = vi.fn();
    render(<LifecycleForm mode="start" onComplete={complete} />);
    expect(screen.getByRole("button", { name: "เริ่มเดือนแรก" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("ยอดเงินตั้งต้น"), { target: { value: "20000" } });
    fireEvent.change(screen.getByLabelText("รายรับเดือนนี้"), { target: { value: "30000" } });
    fireEvent.click(screen.getByRole("button", { name: "เริ่มเดือนแรก" }));
    await waitFor(() => expect(complete).toHaveBeenCalledWith(responseView));
    expect(fetchMock).toHaveBeenCalledWith("/api/onboarding", expect.objectContaining({ method: "POST", body: JSON.stringify({ openingBalance: "20000", income: "30000" }) }));
  });

  it.each(["start", "resume"] as const)("preserves exact amounts when switching to English before %s", async (mode) => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: responseView }));
    vi.stubGlobal("fetch", fetchMock);
    const complete = vi.fn();
    render(<LocaleProvider initialLocale="th"><LanguageControl /><LifecycleForm mode={mode} onComplete={complete} /></LocaleProvider>);

    fireEvent.change(screen.getByLabelText("ยอดเงินตั้งต้น"), { target: { value: "20000.50" } });
    fireEvent.change(screen.getByLabelText("รายรับเดือนนี้"), { target: { value: "0.00" } });
    fireEvent.click(screen.getByRole("button", { name: "English" }));

    expect(screen.getByLabelText("Opening balance")).toHaveValue("20000.50");
    expect(screen.getByLabelText("This month’s income")).toHaveValue("0.00");
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: mode === "start" ? "Start first month" : "Resume tracking" }));

    await waitFor(() => expect(complete).toHaveBeenCalledWith(responseView));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(mode === "start" ? "/api/onboarding" : "/api/resume", expect.objectContaining({
      method: "POST", body: JSON.stringify({ openingBalance: "20000.50", income: "0.00" }),
    }));
  });
});
