declare module "*.mjs" {
  export const run: (argv: string[], dependencies?: Record<string, unknown>) => Promise<unknown>;
}
