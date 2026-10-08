# 1.2.1 — 2026-10-08

- Make the floating bottom tab container transparent on both platforms, remove Android elevation and keep the rounded glass background inside the bar. Tab scenes use the current app background.
- Redesign Android and iOS widgets with a daily completion badge, rounded habit cards, clearer saved progress, timer status and direct action buttons.
- Adapt visible rows to widget size and font scale; keep timer controls reachable and provide matching light/dark progress tracks.
- Update app and native widget versions to 1.2.1, with app build number/version code 3.
- Validation: TypeScript no-emit, ESLint and 42 existing tests pass; Android XML/resource references and iOS background JSON checks pass. No prebuild, export, native compilation or build.

# 1.2.0 — 2026-10-03

- Home habit cards now start, pause, resume and finish timers directly, including active timers on rest days. Paused timers show their actual status and a frozen clock.
- Running timers share a focus-aware foreground repaint clock. Softer press, progress and sheet transitions; slightly narrower and shorter bottom navigation.
- Widget typography and colors match the app. Medium iOS widgets use two readable rows with 44pt controls; Android adjusts visible rows on resize and with font scale. Fallback snapshots preserve active timer state.
- Validation only: TypeScript no-emit, ESLint and 42 tests pass. No app compilation, prebuild, export or build was run for this interaction update.
- Native four-task widgets with direct count and timer actions, a system-driven clock and saved progress bars.
- Shared SQLite database; iOS App Group backup migration; schema v2 operation deduplication; transactional cross-midnight timer saves and stale timer action guards.
- Android immutable explicit broadcast actions; iOS 17+ AppIntents that do not open the app. iOS 16 remains read-only; medium/large families provide two/four task rows.
- Foreground external-database change detection, consistent press/completion motion, transform-based progress animation and reduced-motion navigation.
- Added database interoperability/upgrade tests. Native compile/device validation remains outstanding; see docs/WIDGETS.md.

# 1.1.0 — 2026-10-02

- 外部快速打卡链接改为严格参数校验和应用内确认，操作 ID 独立命名并保留幂等提交。
- 修复小数扣减浮点误判、无效时间/数量输入和时钟回拨时的重叠计时。
- 记录汇总建立索引，减少历史/趋势/首页的重复扫描；计时器只在运行且前台可见时刷新。
- 补齐 pnpm 测试依赖，固定安装工具；修复 decode-uri-component 和 uuid 的依赖安全公告。
- 增加 SVG 叶片 d+ 标志、原生浅/深色图标和开屏、Android 单色图标及三组主题适配插画，并接入实际页面。
- 原生开屏等待数据库及设置就绪；无人工延时。
- 增加 7 项针对性回归测试，总计 36 项通过。
- 已知保留：Expo 工具链 node-forge 高危公告尚无上游修复版本；未完成原生编译及真机验收。详见 docs/REVIEW.zh-CN.md。
