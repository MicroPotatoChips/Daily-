# Screen behavior

Routes use the shared theme, translated strings, and durable stores. UI components never execute SQL.

- Home lists the current local day's scheduled, active habits. Its progress summary uses precisely that list. Templates only create a task after the user taps one.
- History derives its 30-day heatmap from records and dated task revisions. The virtualized timeline groups by stored local date, then by timestamp, so timezone travel cannot duplicate date headings.
- Task detail supports count quick records, timestamp-based timers, positive manual records, negative corrections, editing, archival, and restoration. A validated `quickAdd=1` deep link proposes a record and requires explicit in-app confirmation. Operation IDs are bounded and namespaced to preserve idempotency without trusting a URL as authorization.
- Task forms validate name, positive goal, unit, repeat days, and optional reminder time/interval. Tracking type and unit become read-only after activity. Timer units are persisted canonically as `min`; known units are translated for display.
- Settings update language and appearance immediately, control haptics and reminders, set the first weekday, and restore archived tasks. Notification permission is requested only when the user enables it. Unsupported preview environments explain that native builds are needed.
- Onboarding has three short pages, an optional skip, and a durable completion setting. It creates no tasks or records.

Forms scroll with keyboard avoidance. Selectable controls have at least 44-point targets; reminder switches have expanded touch regions. Color is supplemented by completion text/check marks and accessibility labels. Back navigation falls back to Home for cold deep links.

## Validation status

Source interfaces were inspected against the shared stores, repositories, utilities, and components. Per the user's instruction not to compile, no completed TypeScript check, Expo bundle, browser preview, simulator run, or native build is claimed for these screens. Device verification still needs to cover dynamic text sizes, small Android screens, VoiceOver/TalkBack, keyboard avoidance, background timer recovery, and actual notification permissions.
