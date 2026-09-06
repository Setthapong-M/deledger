const primaryButtonBase = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-transparent bg-primary font-[750] text-primary-ink no-underline not-disabled:hover:border-ink not-disabled:hover:shadow-[0_0_0_3px_var(--deledger-surface-muted)] not-disabled:active:border-ink not-disabled:active:shadow-[0_0_0_3px_var(--deledger-surface-muted)] focus-visible:border-ink focus-visible:shadow-[0_0_0_3px_var(--deledger-surface-muted)] disabled:border-border disabled:bg-surface-muted disabled:text-muted-ink";
const secondaryButtonBase = "inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface font-[650] text-ink no-underline hover:border-state-strong active:border-state-strong";

export const ui = {
  card: "my-6 rounded-3xl border border-border/55 bg-surface p-[clamp(20px,3vw,30px)] shadow-card mobile:my-[18px] mobile:rounded-[20px]",
  pageHeading: "mt-6 mb-8 flex items-center justify-between gap-5 [&_h1]:m-0 [&_h1]:text-[clamp(2rem,4vw,2.75rem)] [&_h1]:font-[750] [&_h1]:tracking-[-0.04em] mobile:my-6 mobile:flex-wrap mobile:gap-3 mobile:[&_h1]:text-[2rem]",
  sectionHeading: "mb-6 flex flex-wrap items-start justify-between gap-5 [&_h1]:m-0 [&_h1]:tracking-[-0.04em] [&_h2]:m-0 [&_h2]:tracking-[-0.04em]",
  eyebrow: "mt-0 mb-2 text-[0.72rem] font-extrabold tracking-[0.13em] text-muted-ink",
  helperText: "text-[0.9rem] leading-[1.55] text-muted-ink",
  field: "grid gap-2 font-[650] [&_input]:min-h-12 [&_input]:w-full [&_input]:rounded-[10px] [&_input]:border [&_input]:border-border [&_input]:bg-input [&_input]:px-[13px] [&_input]:py-2.5 [&_input]:text-ink [&_input[aria-invalid=true]]:border-2 [&_input[aria-invalid=true]]:border-state-strong",
  fieldError: "m-0 text-[0.86rem] text-state-strong",
  choiceField: "m-0 grid gap-3 border-0 p-0 [&_legend]:mb-1.5 [&_legend]:font-bold [&_label]:flex [&_label]:min-h-11 [&_label]:items-center [&_label]:gap-2.5 [&_label]:rounded-[10px] [&_label]:border [&_label]:border-border [&_label]:px-3 [&_label]:py-[9px] [&_input]:accent-primary-ink",
  primaryButton: `${primaryButtonBase} px-[18px] py-2.5`,
  secondaryButton: `${secondaryButtonBase} px-[15px] py-[9px]`,
  primaryButtonCompact: `${primaryButtonBase} px-3 py-[7px] text-[0.88rem]`,
  secondaryButtonCompact: `${secondaryButtonBase} px-3 py-[7px] text-[0.88rem]`,
  textButton: "min-h-11 rounded-xl border-0 bg-transparent text-ink underline",
  iconButton: "inline-grid size-11 place-items-center rounded-xl border border-transparent bg-transparent p-0 text-[1.25rem] text-ink hover:border-border hover:bg-surface-muted disabled:text-muted-ink",
  dialogForm: "mt-[26px] grid gap-[18px]",
  dialogActions: "flex flex-wrap justify-end gap-2.5",
  emptyState: "py-6 text-center [&_h1]:mt-0 [&_button]:mt-3.5 [&_a]:mt-3.5",
  skeleton: "rounded-2xl border border-border bg-surface-muted",
  detailList: "my-7 grid grid-cols-2 gap-3.5 [&_div]:border-b [&_div]:border-border [&_div]:py-3 [&_dt]:mb-1.5 [&_dt]:text-[0.86rem] [&_dt]:text-muted-ink [&_dd]:m-0 [&_dd]:text-[1.15rem] [&_dd]:font-bold [&_dd]:tabular-nums [&_dd]:wrap-anywhere mobile:gap-2",
  statusBadge: "inline-flex min-h-[30px] flex-wrap items-center gap-[7px] rounded-full border border-state-muted px-2.5 py-[5px] text-[0.82rem] font-[750] text-state-strong data-[state=draft]:border-dashed data-[state=needs-information]:border-2 data-[state=needs-information]:border-dashed data-[state=inconsistent]:border-[3px] data-[state=inconsistent]:border-double data-[state=inconsistent]:border-state-strong data-[state=reconciled]:border-primary-ink data-[state=reconciled]:bg-primary data-[state=reconciled]:text-primary-ink",
};
