import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeControl } from "@/components/theme-control";

describe("ThemeControl", () => {
  beforeEach(() => {
    delete document.documentElement.dataset.theme;
    document.cookie = "deledger_theme=; Max-Age=0; Path=/";
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  });

  it("uses radio menu semantics and writes the exact preference cookie", () => {
    render(<ThemeControl />);
    fireEvent.click(screen.getByRole("button", { name: /ธีม/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "มืด" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.cookie).toContain("deledger_theme=dark");
    fireEvent.click(screen.getByRole("button", { name: /ธีม/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "ตามระบบ" }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("reflects a system dark preference without persisting it", () => {
    const listener = vi.fn();
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: listener, removeEventListener: vi.fn() })));
    render(<ThemeControl />);
    expect(screen.getByRole("button", { name: /ตามระบบ \(มืด\)/ })).toBeInTheDocument();
    expect(listener).toHaveBeenCalled();
  });

  it("unsubscribes from system media changes when unmounted", () => {
    const remove = vi.fn();
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: remove })));
    const { unmount } = render(<ThemeControl />);
    unmount();
    expect(remove).toHaveBeenCalled();
  });
});
