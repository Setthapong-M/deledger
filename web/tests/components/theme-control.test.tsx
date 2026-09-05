import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { act, fireEvent, render, screen } from "@testing-library/react";
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

for (const preference of ["system", "dark", "light"]) {
  it(`hydrates ${preference} theme without a server/client mismatch`, async () => {
    const doc = document;
    vi.stubGlobal("document", undefined);
    const html = renderToString(<ThemeControl />);
    vi.stubGlobal("document", doc);
    if (preference !== "system") doc.documentElement.dataset.theme = preference;
    else delete doc.documentElement.dataset.theme;
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const container = doc.createElement("div");
    container.innerHTML = html;
    doc.body.append(container);
    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => { root = hydrateRoot(container, <ThemeControl />, { onRecoverableError }); });
    expect(onRecoverableError).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    container.remove();
  });
}
