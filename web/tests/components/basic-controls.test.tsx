import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MoneyField } from "@/components/money-field";
import { StatusBadge } from "@/components/status-badge";

describe("basic controls", () => {
  it("reports a field error and preserves touch-sized input semantics", () => {
    const values: string[] = [];
    render(<MoneyField id="amount" label="ยอด" value="" onChange={(value) => values.push(value)} error="กรอกยอด" disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByText("กรอกยอด")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "100" } });
    expect(values).toEqual(["100"]);
  });

  it("communicates each reconciliation state with text and a symbol", () => {
    for (const state of ["draft", "needs_information", "inconsistent", "reconciled"] as const) {
      const { unmount } = render(<StatusBadge state={state} partial={state === "draft"} />);
      expect(screen.getByText(state === "draft" ? "กำลังกรอก" : state === "needs_information" ? "ข้อมูลไม่ครบ" : state === "inconsistent" ? "ยอดไม่สอดคล้อง" : "ตรวจสอบแล้ว")).toBeInTheDocument();
      unmount();
    }
  });
});
