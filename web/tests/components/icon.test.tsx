import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Icon, type IconName } from "../../src/components/icon";

const names: IconName[] = ["calendar", "history", "account", "logout", "sun", "moon", "check", "unchecked", "checked", "info", "warning", "edit", "plus", "close", "pause", "play", "grip", "refresh", "previous", "next"];

describe("interface icons", () => {
  it.each(names)("renders %s with the shared outline and accessibility contract", name => {
    const { container } = render(<Icon name={name} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveAttribute("fill", "none");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg).toHaveAttribute("stroke-width", "1.75");
    expect(svg).toHaveAttribute("stroke-linecap", "round");
    expect(svg).toHaveAttribute("stroke-linejoin", "round");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
    expect(svg.childElementCount).toBeGreaterThan(0);
  });

  it("keeps the control name and custom sizing independent from its decorative icon", () => {
    const { container } = render(<button aria-label="แก้ไข"><Icon name="edit" className="size-4" /></button>);
    expect(screen.getByRole("button", { name: "แก้ไข" })).toBeVisible();
    expect(container.querySelector("svg")).toHaveClass("size-4");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
