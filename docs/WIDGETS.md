# Daily+ 1.2：桌面小组件

## 用户操作

Android 按组件高度和系统字体倍率显示可容纳的任务行，调整大小后立即刷新；iOS 中号显示两行，大号显示四行。运行或暂停的计时任务优先展示，其余任务按应用中的创建顺序排列；跨天后仍在计时或暂停的任务也保留在候选列表，便于继续或结束计时。未显示的任务数量在组件标题或底部提示，完成汇总统计所有候选任务。

每个任务显示已保存数值/目标，空间充足时显示进度条。计次任务点 `+` 直接加一；计时任务点播放开始，点暂停暂停，再点播放继续，点 `✓` 结束并保存。计时期间明确显示“计时中”或“已暂停”，运行时使用系统驱动的时钟，暂停后读数冻结；进度基于已保存记录，结束后刷新。按钮直接操作数据库，不打开应用；点任务行或组件背景仍可主动打开应用。字体使用与主应用一致的系统无衬线风格，数字采用等宽数字特性。

“添加”在本版指现有任务加一；创建新任务仍在应用内完成。

| 平台 | 直接加一 / 开始 / 暂停 / 继续 / 结束 |
| --- | --- |
| Android 原生开发或正式构建 | 支持原生 BroadcastReceiver 动作，无 Activity 跳转 |
| iOS 17+ 原生开发或正式构建 | 支持 Button + AppIntent；openAppWhenRun=false |
| iOS 16.4 | 只读组件；提示直接操作需要 iOS 17 |
| Expo Go / Web | 运行主应用，不提供原生桌面组件 |

为保证任务名称与操作控件的空间，iOS 本版提供中号和大号，中号按钮保持 44pt；旧系统或初始化/错误提示占用空间时，中号显示一行。旧小号组件需要移除并重新添加中号或大号。Android 默认 4×4、初始最小高度 320dp，可缩小至 220dp；大字体或窄屏可以放大组件以显示更多任务。首次安装或升级后打开应用一次，完成数据库准备，再使用组件。

## 数据与安全

组件和主应用使用同一份 SQLite WAL 数据库，JSON 快照仅用作语言、主题和不可读时的查看回退；组件写入不会被旧快照覆盖。不可读时禁用操作按钮，写入失败显示重试提示。

- iOS 数据库移动到 App Group 下的 `SQLite/dailyplus.db`。首次打开空共享库时，使用 Expo SQLite backup API 从旧数据库复制，包括已提交的 WAL 数据。旧文件保留作恢复副本，不执行删库迁移。后续仅使用共享库。
- Android 使用 Expo 默认数据库路径，原生模块将路径保存在应用私有偏好中；组件读取时校验路径位于本应用数据目录下，文件名必须为 dailyplus.db。
- Schema v2 仅新增 widget_operations 表；主应用与组件都使用事务及 3 秒锁等待。按钮操作 ID 唯一，重复投递只提交一次。计时按钮还校验会话 ID、状态、开始和暂停时间，避免旧按钮改变已更新会话。
- Android receiver 不导出，PendingIntent 显式指定 receiver 且不可变；iOS Intent 仅在组件扩展中执行，不作为可发现的快捷指令。参数使用 SQL 绑定，不拼接任务 ID。
- 原生写入检查任务存在、未归档、计量类型及当前排期。进行中的计时允许在非排期日暂停或结束。结束事务同时保存会话和按本地午夜拆分的记录，操作失败全部回滚。
- App 返回前台重新读取数据；前台每 3 秒检查一次轻量 PRAGMA data_version，仅在外部连接提交变化时重新加载，兼顾平板分屏操作。后台不查询数据库。

iOS 通过 WidgetKit 请求刷新，并提供未来午夜的回退条目；实际刷新由系统调度。Android 在操作后刷新所有组件，并处理午夜、日期、时间、时区、重启和系统周期刷新。休眠/省电可能延迟自动刷新。时钟由 iOS 的动态 Text 和 Android Chronometer 显示，不依赖 JavaScript 常驻或后台每秒唤醒。

## 构建

```sh
pnpm install --frozen-lockfile
pnpm exec expo prebuild --no-install
pnpm exec expo run:android
# macOS + Xcode
pnpm exec expo run:ios
```

Config Plugin 复制 Android provider、数据库类和资源；生成 iOS WidgetKit 扩展、数据库 Swift 文件、SQLite 链接配置和 App Group 权限。重复 prebuild 不会重复添加源文件。构建需要平台工具链；iOS 还需要为主应用和扩展配置同一 App Group 的签名。

如果修改 bundle ID 或 App Group，须自行迁移原分组数据，不能把更换 App Group 当作普通版本升级。已使用共享库后不要回退到仅使用旧目录的 1.1 原生包。

## 本轮验证及边界

2026-10-04 本次交互优化仅做验证：`pnpm typecheck`（无输出）、`pnpm lint`、`pnpm test` 全部通过，42 项测试通过；修改的 TypeScript 文件格式检查及 Android XML / iOS JSON 资源静态校验通过。新增回归覆盖暂停计时的快捷恢复和冻结读数、结束后重新开始，以及小组件回退快照的运行/暂停/结束状态。另隔离检查了共享时钟的多订阅、页面焦点、后台停止、前台校正和卸载清理。

本次未执行 Expo prebuild、导出、原生编译或构建。原生插件测试只在临时目录验证资源复制、manifest 和 Xcode 配置结构；不生成本项目原生工程。依赖按锁文件安装并跳过构建脚本，依赖清单与锁文件保持不变。

这些测试验证数据库契约和生成配置，不等于执行 Swift/Kotlin。本次未执行原生编译、签名安装、桌面组件点击和真机动画检查。发布前在设备上验证：旧版升级保留记录和活动计时；关闭应用后各按钮操作；快速重复点击；同时添加两个组件；跨午夜/夏令时/修改时区；锁屏重启；归档与组件操作竞争；数据库锁冲突重试；大字体和中/英、深/浅色；减少动态效果开关。

## 官方参考

- [Apple：交互式组件与 AppIntent](https://developer.apple.com/documentation/widgetkit/adding-interactivity-to-widgets-and-live-activities)
- [Android：BroadcastReceiver 与组件更新](https://developer.android.com/develop/ui/views/appwidgets/advanced)
- [Android：RemoteViews 和 Chronometer](https://developer.android.com/reference/android/widget/RemoteViews)
- [Expo：SQLite App Group、数据库目录和备份](https://docs.expo.dev/versions/latest/sdk/sqlite/)

## 本地通知

本轮未更改提醒逻辑。只有用户主动开启提醒时才申请权限；归档、编辑或关闭提醒会重建/移除对应计划。每周按选定日期安排，间隔提醒限制在 08:00–20:00；总共预留最多 56 个系统计划位。无远程推送和服务端健康数据上传。
