# Daily+ architecture

Local-first Expo Router application. Production starts with zero tasks and zero records.

```text
src/
  app/             Routes: Home, History, task detail, create/edit, settings, onboarding
  components/      Accessible shared controls, cards, animated rings, heatmap
  database/        Versioned SQLite migrations and repositories
  store/           Zustand task/record/timer/settings state
  services/        Durable timers, reminders, widget synchronization
  hooks/           Local date and foreground refresh
  locales/         English and Simplified Chinese
  theme/           Color, typography, spacing, radius, shadow tokens
  utils/           Local dates, scheduling, historical completion calculations
  types/           Shared domain contracts
modules/daily-widget/ Native Expo module: Swift WidgetKit + Kotlin AppWidget
plugins/           Native widget generation and integration
tests/             Domain, repository and recovery tests
```

Repositories own SQL. Stores reload durable state after each successful write. Count records use unique operation IDs. Timer segments are timestamps, split at local midnight when committed, and finished atomically. Goal/repeat changes are dated revisions so history stays meaningful. Archived tasks retain their records.

Native widgets share a summary snapshot, open dailyplus://task/{id}, and offer a quick-add route that the app commits through the same repository. No account or network data collection.
