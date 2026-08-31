import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LifecycleForm } from "@/components/lifecycle-form";
import type { MonthView } from "@/lib/api-client";

const responseView = { month: "2026-08" } as MonthView;

describe("LifecycleForm", () => {
  it("requires both money inputs and submits decimal strings", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: responseView }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const complete = vi.fn();
    render(<LifecycleForm mode="start" onComplete={complete} />);
    expect(screen.getByRole("button", { name: "เริ่มเดือนแรก" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("ยอดตั้งต้นที่รู้ตอนนี้"), { target: { value: "20000" } });
    fireEvent.change(screen.getByLabelText("รายรับของเดือนนี้"), { target: { value: "30000" } });
    fireEvent.click(screen.getByRole("button", { name: "เริ่มเดือนแรก" }));
    await waitFor(() => expect(complete).toHaveBeenCalledWith(responseView));
    expect(fetchMock).toHaveBeenCalledWith("/api/onboarding", expect.objectContaining({ method: "POST", body: JSON.stringify({ openingBalance: "20000", income: "30000" }) }));
  });
});
