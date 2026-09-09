import { useState } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LanguageControl } from "@/components/language-control";
import { ApiClientError } from "@/lib/api-client";
import { LocaleProvider, useCopy, type Messages } from "@/lib/i18n";

const messages = {
  required: { th: "กรอกยอดเงิน", en: "Enter an amount" },
  saved: { th: "บันทึก {name} แล้ว", en: "Saved {name}" },
} satisfies Messages;

function FeedbackExample({ reason }: { reason: unknown }) {
  const { t, errorMessage } = useCopy(messages);
  const [validation, setValidation] = useState<"required" | null>(null);
  const [success, setSuccess] = useState<"saved" | null>(null);
  const [error, setError] = useState<unknown>(null);
  return <>
    <button onClick={() => { setValidation("required"); setSuccess("saved"); setError(reason); }}>Show feedback</button>
    {validation ? <p>{t(validation)}</p> : null}
    {success ? <p>{t(success, { name: "ค่าเช่า Rent" })}</p> : null}
    {error !== null ? <p role="alert">{errorMessage(error)}</p> : null}
  </>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.cookie = "deledger_locale=; Max-Age=0; Path=/";
  document.documentElement.removeAttribute("lang");
});

it("saves language changes in the cookie and updates document language and selection", () => {
  render(<LocaleProvider initialLocale="th"><LanguageControl /></LocaleProvider>);
  expect(screen.getByRole("button", { name: "ภาษาไทย" })).toHaveAttribute("aria-pressed", "true");

  fireEvent.click(screen.getByRole("button", { name: "English" }));
  expect(document.cookie.split("; ")).toContain("deledger_locale=en");
  expect(document.documentElement.lang).toBe("en");
  expect(screen.getByRole("group", { name: "Language" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "ภาษาไทย" })).toHaveAttribute("aria-pressed", "false");

  fireEvent.click(screen.getByRole("button", { name: "ภาษาไทย" }));
  expect(document.cookie.split("; ")).toContain("deledger_locale=th");
  expect(document.documentElement.lang).toBe("th");
  expect(screen.getByRole("group", { name: "ภาษา" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "false");
});

it("renders English on the server and hydrates without a mismatch", async () => {
  const app = <LocaleProvider initialLocale="en"><LanguageControl /></LocaleProvider>;
  const doc = document;
  let html: string;
  vi.stubGlobal("document", undefined);
  try {
    html = renderToString(app);
  } finally {
    vi.unstubAllGlobals();
  }
  doc.documentElement.lang = "en";
  doc.cookie = "deledger_locale=en; Path=/";
  const container = doc.createElement("div");
  container.innerHTML = html;
  doc.body.append(container);
  const onRecoverableError = vi.fn();
  const consoleError = vi.spyOn(console, "error");
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    expect(within(container).getByRole("group", { name: "Language" })).toBeInTheDocument();
    expect(within(container).getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    await act(async () => { root = hydrateRoot(container, app, { onRecoverableError }); });
    expect(container.innerHTML).toBe(html);
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(doc.documentElement.lang).toBe("en");
    fireEvent.click(within(container).getByRole("button", { name: "ภาษาไทย" }));
    expect(within(container).getByRole("group", { name: "ภาษา" })).toBeInTheDocument();
  } finally {
    await act(async () => root?.unmount());
    container.remove();
  }
});

it.each([
  {
    kind: "network error",
    reason: new Error("Failed to fetch"),
    th: "เชื่อมต่อไม่ได้ ลองอีกครั้งในอีกสักครู่",
    en: "Can’t connect right now. Try again shortly.",
  },
  {
    kind: "server field error",
    reason: new ApiClientError(400, { code: "INVALID_INPUT", field: "email", message: "Raw server validation" }),
    th: "กรอกอีเมลให้ถูกต้อง",
    en: "Enter a valid email.",
  },
  {
    kind: "server conflict",
    reason: new ApiClientError(409, { code: "PROFILE_CONFLICT", message: "Raw server conflict" }),
    th: "ข้อมูลติดต่อนี้ใช้ไม่ได้ ลองอีเมลหรือเบอร์อื่น",
    en: "These contact details aren’t available. Try another email or number.",
  },
])("translates existing local feedback and $kind when switching languages", ({ reason, th, en }) => {
  render(<LocaleProvider initialLocale="th"><LanguageControl /><FeedbackExample reason={reason} /></LocaleProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Show feedback" }));
  expect(screen.getByText("กรอกยอดเงิน")).toBeInTheDocument();
  expect(screen.getByText("บันทึก ค่าเช่า Rent แล้ว")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(th);

  fireEvent.click(screen.getByRole("button", { name: "English" }));
  expect(screen.getByText("Enter an amount")).toBeInTheDocument();
  expect(screen.getByText("Saved ค่าเช่า Rent")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(en);
  expect(screen.queryByText("กรอกยอดเงิน")).not.toBeInTheDocument();
  expect(screen.queryByText(reason.message)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "ภาษาไทย" }));
  expect(screen.getByRole("alert")).toHaveTextContent(th);
  expect(screen.getByText("กรอกยอดเงิน")).toBeInTheDocument();
});
