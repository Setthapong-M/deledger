import { describe, expect, it } from "vitest";
import { normalizeIdentifier, type LoginIdentifier } from "@/server/auth/local";

describe("local login identifier", () => {
  it("recognizes and normalizes email in the shared field", () => {
    expect(normalizeIdentifier("  User@Example.COM ")).toEqual<LoginIdentifier>({ kind: "email", value: "user@example.com" });
  });

  it("recognizes Thai domestic and +66 phone forms as one identifier", () => {
    expect(normalizeIdentifier("081-234-5678")).toEqual<LoginIdentifier>({ kind: "phone", value: "+66812345678" });
    expect(normalizeIdentifier("+66 81 234 5678")).toEqual<LoginIdentifier>({ kind: "phone", value: "+66812345678" });
  });

  it("rejects malformed or unsupported identifiers", () => {
    expect(() => normalizeIdentifier("not-an-identifier")).toThrow("IDENTIFIER_INVALID");
    expect(() => normalizeIdentifier("+14155552671")).toThrow("IDENTIFIER_INVALID");
    expect(() => normalizeIdentifier("081234567")).toThrow("IDENTIFIER_INVALID");
  });
});
