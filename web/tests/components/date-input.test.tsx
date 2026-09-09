import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DateInput } from "@/components/date-input";
import { BalanceDialog } from "@/components/balance-dialog";

function Field() {
  const [value, setValue] = useState("2000-02-29");
  return <><label id="birthday-label" htmlFor="birthday">วันเกิด</label><DateInput id="birthday" aria-labelledby="birthday-label" value={value} onValueChange={setValue} /></>;
}

describe("custom calendar", () => {
  it("moves across leap-day boundaries with the keyboard and returns focus after selection", async () => {
    const user = userEvent.setup();
    const { container } = render(<Field />);
    const trigger = screen.getByRole("button", { name: "วันเกิด" });
    await user.click(trigger);
    await user.keyboard("{ArrowRight}{Enter}");
    expect(container.querySelector('input[name="birthday"]')).toHaveValue("2000-03-01");
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "ล้างวันที่" }));
    expect(container.querySelector('input[name="birthday"]')).toHaveValue("");
  });

  it("requires the check-in date and closes only the calendar on the first Escape", async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    const close = vi.fn();
    render(<BalanceDialog title="Check-in" dateLabel="วันที่เช็กยอด" initialValue="100" onSubmit={submit} onClose={close} />);
    await user.click(screen.getByRole("button", { name: "บันทึก" }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("เลือกวันที่เช็กยอดก่อนนะ");
    await user.click(screen.getByRole("button", { name: "วันที่เช็กยอด" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(close).toHaveBeenCalledOnce();
  });
});
