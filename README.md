# Daily+

**Small habits. Better days.**

Daily+ 是一款面向 iOS 和 Android 的本地优先习惯记录应用。无需账号，可以记录一次行动，也可以计时完成一段专注；任务、记录和计时状态保存在设备 SQLite 数据库中。

<p align="center">
  <img src="assets/icon.png" alt="Daily+ 应用图标" width="96" />
</p>

## 功能

- **首页快捷记录**：计次习惯直接加一；计时习惯直接开始、暂停、继续、结束并保存，无需进入详情页。
- **准确的计时状态**：暂停后显示“计时已暂停”，读数保持不变；后台或重启后按持久化时间戳恢复，跨午夜按本地日期保存时长。
- **习惯管理**：创建、编辑、归档和恢复；自定义名称、图标、颜色、单位、每日目标和重复日期；支持手动记录与负数修正。
- **进度与历史**：今日完成概览、动画进度环、30 天活动热力图、日期详情、记录时间线和任务趋势。
- **桌面小组件**：显示已保存进度，直接加一或操作计时；运行、暂停状态与应用同步。
- **外观与体验**：中文 / English / 系统语言，浅色 / 深色 / 系统外观；统一按压与进度动效，支持系统减少动态效果设置和可关闭的触觉反馈。
- **本地提醒**：默认关闭，用户主动开启后按任务安排提醒。

无需注册；应用不上传习惯记录，不包含广告或分析 SDK。

## 最近的交互改进

- 首页计时卡片保留开始、暂停、继续和结束操作；今日未排期但仍有活动计时的习惯也可直接控制。
- 修复暂停状态仍显示“计时进行中”的问题；达成每日目标后仍可继续计时。
- 运行计时共用一个显示刷新时钟，页面失去焦点或应用进入后台时停止界面刷新，计时结果仍由数据库时间戳计算。
- 优化按钮回弹、进度变化、弹层进入和页面切换；底部导航栏略微收窄，高度由 72 调整为 64。
- 小组件统一系统字体与应用配色，活动计时优先展示；Android 根据组件尺寸和字体倍率调整任务行数。

## 技术栈

Expo SDK 57 · React Native 0.86 · React 19 · TypeScript · Expo Router · Zustand · expo-sqlite · Reanimated · i18next · Lucide

原生桌面组件使用 iOS WidgetKit / AppIntents、Android AppWidget，通过本地 Expo Module 和 Config Plugin 接入应用。

## 快速开始

需要 Node.js **22.22.2+** 和 pnpm **11.25.0**。进入项目根目录后运行：

```sh
npx pnpm@11.25.0 install --frozen-lockfile
npx pnpm@11.25.0 start
```

请保留并使用 `pnpm-lock.yaml` 和 `pnpm-workspace.yaml`。项目包含定向依赖覆盖和兼容补丁，使用 pnpm 安装可以确保补丁生效。

Expo Go 可预览应用内的习惯、计时、历史和外观功能；原生桌面小组件和本项目的通知流程需要 Development Build 或正式安装包。

```sh
pnpm web
```

Web 使用 SQLite WASM。部署 Web 预览时，服务器需要提供以下响应头：

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## 桌面小组件

| 环境 | 直接添加记录 / 开始、暂停、继续、结束计时 |
| --- | --- |
| Android 原生安装包 | 支持，按钮直接操作数据库，不跳转应用 |
| iOS 17+ 原生安装包 | 支持，使用 WidgetKit 交互按钮与 AppIntent |
| iOS 16.4 | 只读展示 |
| Expo Go / Web | 不提供原生桌面组件 |

iOS 中号显示两行任务，大号显示四行；Android 可调整组件大小，显示可容纳的任务行。小组件中的“添加记录”指为已有计次习惯加一，创建新习惯仍在应用内完成。

首次安装后先打开应用完成数据库初始化。修改原生组件代码后，仅刷新 JavaScript 不会更新系统桌面组件，需要使用包含对应原生修改的安装包。

详见 [小组件使用与实现说明](docs/WIDGETS.md)。

## 原生开发

以下为开发命令说明，本次交互修改没有执行编译或构建。

```sh
pnpm exec expo prebuild
pnpm exec expo run:android
# macOS + Xcode
pnpm exec expo run:ios
```

Android 本机构建需要 JDK、Android SDK 和模拟器或设备；iOS 本机构建需要 macOS、Xcode 和签名配置。也可按 `eas.json` 中的配置使用 EAS：

```sh
npx eas-cli build --profile development --platform android
npx eas-cli build --profile development --platform ios
pnpm exec expo start --dev-client
```

正式分发前，请配置自己的包标识、App Group、EAS 项目和平台签名；本仓库不包含开发者证书或商店账号凭据。

## 验证

```sh
pnpm typecheck
pnpm lint
pnpm test
```

最近一次已完成的代码验证为 **2026-10-04**：TypeScript 无输出检查、ESLint 和 **42 项测试**全部通过，修改文件的格式检查与 Android XML / iOS JSON 资源静态校验通过。

测试覆盖真实 SQLite 数据读写、迁移、任务与记录管理、重复提交、暂停与恢复、后台时间恢复、跨午夜、事务回滚、原生组件与应用共享数据、小组件回退快照，以及外部链接参数校验。

这次交互改进仅做验证，未运行 Expo prebuild、导出、原生编译或构建。原生插件测试使用临时配置夹具；模拟器和真机的截图、点击操作与动效观感尚未在本仓库记录为验收通过。

## 项目结构

```text
src/app/                路由：首页、历史、任务详情、设置、表单和引导
src/components/         公共界面组件
src/features/           页面逻辑、模板、表单和计时显示时钟
src/database/           SQLite 初始化、迁移与 repositories
src/store/              Zustand 状态
src/services/           计时、提醒和小组件同步
src/theme/              配色、字体、间距、圆角和动效
src/locales/            中英文基础文案
modules/daily-widget/   原生 Expo Module、Swift / Kotlin 小组件源码
plugins/                原生组件生成插件
patches/                依赖兼容补丁
tests/                  数据库、计时、组件和参数校验测试
assets/                 应用图标与插画
docs/                   需求、设计、历史检查和小组件说明
```

根目录的 `ios/`、`android/` 是生成工程；`modules/daily-widget/` 下的原生源码需要纳入版本控制。

## 数据约定与文档

- 数据保存在设备的 `dailyplus.db`；计时结束与写入记录在同一事务中提交。
- 记录使用 UTC 毫秒时间戳和记录时的本地日期；跨午夜计时按本地日历日分配。
- 目标与重复日期保留生效日期版本；归档保留历史记录，并保存尚未结束的计时。
- 小组件与应用共享 SQLite，操作 ID 防止重复记账；过期计时按钮不能改变已更新会话。

[架构与数据约定](ARCHITECTURE.md) · [变更记录](CHANGELOG.md) · [小组件说明](docs/WIDGETS.md) · [素材说明](docs/design/README.md) · [历史检查报告](docs/REVIEW.zh-CN.md)
