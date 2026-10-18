# Deledger design system extraction

Source: current working tree at 9264d4520f0991ea6cdd77e5290b832c12ac162d, including existing uncommitted changes. Extracted 2026-10-13 (Asia/Bangkok).

Deliverables: native Figma foundations, editable component library, desktop and mobile screens, linked hi-fi prototype, native .fig local copy.

Figma: https://www.figma.com/design/EItK4iWFuxFqnTg4t2BM4F (Poly).

Inventory: Button, IconButton, MoneyField, ChoiceField, StatusBadge, FeedbackBanner, Card, Navigation, ThemeControl, MonthSummary, MonthTimeline, ExpenseChip, ExpenseSetupRow, BalanceDialog, ExpenseSetupDialog, HistoryTab and history cover.

Flows: local login → first month → monthly overview; income / Snapshot / Ending Balance dialogs; fixed and variable expense confirmation; setup add/edit/pause; history month and Tracking Gap; profile; theme switch. Manual Close appears only in a final-calendar-day scenario with complete inputs, as required by the current domain model.

Acceptance: source colors and geometry, source wording, bound tokens and shared text/effect styles, native components and instances, Auto Layout, no rasterized full UI, valid prototype targets, working navigation and dialog actions, desktop/mobile visual review, genuine Figma-exported .fig.

Typography: code uses ui-sans-serif, system-ui, sans-serif rather than a bundled product font. Record actual platform font mapping and any Figma substitution explicitly; never claim cross-platform pixel-identical text rendering.

Financial and contact content is synthetic demo data. Prototype submits only navigate between prepared scenarios; they do not write to the application database.
