import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MoneyField } from "@/components/money-field";

function Field() {
  const [value, setValue] = useState("");
  return <MoneyField id="money" label="Amount" value={value} onChange={setValue} />;
}

describe("MoneyField", () => {
  it("accepts decimal money, editing, zero and clearing without rounding", async () => {
    const user = userEvent.setup();
    render(<Field />);
    const input = screen.getByRole("textbox");
    await user.type(input, "1234.50");
    expect(input).toHaveValue("1234.50");
    await user.clear(input);
    await user.type(input, "0.01");
    expect(input).toHaveValue("0.01");
    await user.clear(input);
    expect(input).toHaveValue("");
  });

  it("rejects non-numeric keystrokes and more than two decimal places", async () => {
    const user = userEvent.setup();
    render(<Field />);
    const input = screen.getByRole("textbox");
    await user.type(input, "aก-+1e2.345");
    expect(input).toHaveValue("12.34");
    expect(input).toHaveFocus();
  });

  it.each(["-100", "1e3", "12,34", "1.000,50", "1.2.3", "12.345", "100\n200", "hello 500"])("rejects invalid pasted money %s without changing the previous amount", async value => {
    const user = userEvent.setup();
    render(<Field />);
    const input = screen.getByRole("textbox");
    await user.type(input, "25");
    await user.keyboard("{Control>}a{/Control}");
    await user.paste(value);
    expect(input).toHaveValue("25");
  });

  it.each([["1,250.50", "1250.50"], [" ฿ 1,000.00 ", "1000.00"], ["100บาท", "100"], ["THB 500.25", "500.25"], ["0.00", "0.00"]])("pastes formatted money %s over the selected value", async (pasted, expected) => {
    const user = userEvent.setup();
    render(<Field />);
    const input = screen.getByRole("textbox");
    await user.type(input, "25");
    await user.keyboard("{Control>}a{/Control}");
    await user.paste(pasted);
    expect(input).toHaveValue(expected);
    expect(input).toHaveFocus();
  });

  it("copies the amount and pastes into a selected part without losing other digits", async () => {
    const user = userEvent.setup();
    render(<Field />);
    const input = screen.getByRole<HTMLInputElement>("textbox");
    await user.type(input, "1234");
    input.setSelectionRange(0, 2);
    const clipboard = await user.copy();
    expect(clipboard?.getData("text/plain")).toBe("12");
    input.setSelectionRange(2, 4);
    await user.paste("56");
    expect(input).toHaveValue("1256");
  });

  it("accepts a valid pasted decimal and rejects invalid change events", async () => {
    const user = userEvent.setup();
    render(<Field />);
    const input = screen.getByRole("textbox");
    await user.click(input);
    await user.paste("500.25");
    expect(input).toHaveValue("500.25");
    fireEvent.change(input, { target: { value: "bad" } });
    expect(input).toHaveValue("500.25");
  });
});
