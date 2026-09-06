import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProfileForm } from "../../src/components/profile-form";

afterEach(() => vi.unstubAllGlobals());
it("keeps edited profile fields when a discarded initial request finishes late", async () => {
  let finishFirst!: (response: Response) => void;
  const first = new Promise<Response>(resolve => { finishFirst = resolve; });
  let calls = 0;
  vi.stubGlobal("fetch", async () => {
    calls += 1;
    return calls === 1 ? first : Response.json({ data: { email: "initial@example.com", phone: null, dateOfBirth: null } });
  });
  render(<StrictMode><ProfileForm environment="local" /></StrictMode>);
  await waitFor(() => expect(screen.getByRole("textbox", { name: /^อีเมล/ })).toHaveValue("initial@example.com"));
  fireEvent.change(screen.getByRole("textbox", { name: /^อีเมล/ }), { target: { value: "edited@example.com" } });
  await act(async () => { finishFirst(Response.json({ data: { email: "initial@example.com", phone: null, dateOfBirth: null } })); });
  expect(screen.getByRole("textbox", { name: /^อีเมล/ })).toHaveValue("edited@example.com");
});
