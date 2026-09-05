import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

process.env.DELEDGER_ENV = "qas";

afterEach(() => {
  cleanup();
});
