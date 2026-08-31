# Prototype first-use and monthly-history flows

Type: prototype
Status: resolved
Blocked by: 01, 02

## Question

What should the missing online MVP flows look and feel like around the chosen Variant C Monthly timeline? Extend the grayscale prototype to make signup/onboarding into a Partial Month, automatic closure with Needs Information, monthly history, closed-month correction warnings, and navigation back to the current month concrete enough for the User to validate. Preserve the confirmed low-input behavior and avoid adding production persistence.

## Answer

Keep Variant C's Monthly Timeline for the current month and add a two-input first-use flow: the User enters the aggregate balance at signup and any Income received since signup, then begins a clearly labelled Partial Month without reconstructing earlier activity. Balance Snapshot remains provisional even on the final day; Ending Balance is a separate explicit confirmation. Manual Close is gated on a coherent Ending Balance, while an automatically Closed Month with missing input appears as Needs Information and remains correctable without reopening.

For Monthly History, use the validated Hybrid layout in `prototypes/deledger-ui-prototype.html`: a compact Filmstrip exposes every month's state at a glance, while a synchronized Cover Flow focuses the selected month. The centered Cover contains the complete minimal monthly summary—Starting Balance, Income, Ending Balance or Snapshot, Monthly Spending, detailed amount, Unitemized amount, and reconciliation state—so no separate “view month details” action is required. Show only an action that resolves an actual issue, such as filling or editing Ending Balance; after correction, keep the User in History and update the Cover, Filmstrip marker, issue count, and dependent Starting Balance in place. The prototype remains grayscale, in-memory, responsive, and non-persistent.

## Comments

- 2026-08-31 — The User later chose to ship the Private Beta with color. Keep this prototype grayscale as structural evidence, but production uses the Deep Teal + Warm Sand tokens in `../spec.md`; status meaning must still use labels, symbols, and patterns rather than color alone.
- 2026-08-31 — The User added Light and Dark modes. Production defaults to the device preference, exposes System/Light/Dark choices, persists only an optional non-sensitive theme cookie, and uses the paired accessible token sets in `../spec.md`.
- 2026-08-31 — The User superseded the earlier Deep Teal + Warm Sand direction with Neutral Ledger: white, black and gray form both themes, and `#B5C69C` is the only chromatic accent. Statuses use visible labels, symbols, borders and patterns rather than separate blue/green/amber/red colors.
- 2026-08-31 — The User locked the primary accent to exact opaque `#B5C69C`: no optical adjustment, tint, shade, transparency, blend, gradient or soft variant in any state. Text/icons on that background use dark gray `#262626` in both themes.
