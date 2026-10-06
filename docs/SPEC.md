# Daily+ — AI Coding Agent 完整开发 Prompt

你是一名资深移动端产品设计师、React Native 工程师、Expo 工程师和 UI/UX 设计师。

请从零设计并开发一个完整、可运行、可维护的跨平台健康习惯记录应用：

**Daily+**

目标平台：

- iOS
- Android

技术栈优先：

- React Native
- Expo
- TypeScript
- Expo Router
- React Native Reanimated
- AsyncStorage 或 SQLite
- Expo Haptics
- Expo Notifications
- i18n
- 原生 Widget Extension（必要时使用 Expo Native Module / Config Plugin）

不要只生成 UI Demo。

最终项目必须是真正可以运行、交互、保存数据的应用。

---

# 1. 产品定位

Daily+ 是一个极简、现代、轻量的每日健康任务记录 App。

核心理念：

**Small habits. Better days.**

用户可以每天记录：

- 喝水
- 运动
- 阅读
- 冥想
- 拉伸
- 学习
- 睡眠准备
- 自定义任务

Daily+ 不应该像复杂的健康管理软件。

它应该让用户在打开 App 后 **3 秒内完成一次记录**。

核心体验：

打开 App  
↓  
看到今天的任务  
↓  
点击任务  
↓  
记录完成  
↓  
获得轻微动画 + 触觉反馈  
↓  
继续生活

---

# 2. 产品设计原则

整个 App 必须遵循：

**Simple / Calm / Fluid / Focused**

避免：

- 信息密度过高
- 复杂图表
- 过多菜单
- 大面积渐变
- 夸张动画
- 游戏化过度
- 大量卡片嵌套
- Android Material Design 风格过重

视觉方向：

**现代 iOS 风格 + Liquid Glass / Glass UI 的轻量表达**

但不要复制 Apple 系统 UI。

要求：

- 大圆角
- 柔和背景
- 半透明层
- Blur
- 清晰排版
- 大量留白
- 简洁图标
- 极少边框
- 层级主要依靠间距、字号和透明度建立

---

# 3. 信息架构

Daily+ 主版本只保留两个核心页面：

1. Home
2. History

不要增加：

- 社区
- 排行榜
- 商城
- AI 聊天
- 新闻
- Feed

保持产品克制。

底部导航：

Home
History

使用 Floating Tab Bar / Glass Tab Bar。

---

# 4. Home 首页

首页是 Daily+ 最重要的页面。

顶部显示：

Daily+

以及：

Today

显示日期，例如：

Tuesday, October 1

下面显示今日完成概览。

例如：

3 of 5 completed

并配合一个极简圆形 Progress Ring。

---

# 5. 今日任务列表

首页主体显示 Today Tasks。

每一个任务使用独立 Task Card。

例如：

💧 Water
4 / 8 cups

🏃 Exercise
18 / 30 min

📖 Reading
20 / 30 min

🧘 Meditation
Completed

Task Card 包含：

- 图标
- 名称
- 今日进度
- 目标
- Progress Bar / Ring
- 快速记录按钮

点击卡片进入任务详情。

点击右侧快速按钮直接记录一次。

记录成功时：

1. 按钮产生轻微 Scale 动画
2. Progress 动画更新
3. Expo Haptics 产生轻触觉
4. 数值平滑更新
5. 达到目标后显示柔和完成动画

不要弹出烦人的 Modal。

---

# 6. 两种任务类型

Daily+ 必须支持两种记录模式。

## Count

按次数记录。

例如：

喝水

Goal:
8 cups

用户每点击一次：

+1

适用于：

- 喝水
- 水果
- 药物提醒
- 站立
- 自定义计次习惯

数据结构：

type: "count"

unit:
cups
times
pages
ml
custom

---

## Timer

按时间记录。

例如：

Exercise

Goal:
30 min

点击 Start：

开始计时。

显示：

00:12:43

提供：

Pause
Resume
Finish

完成后将时间写入当天记录。

Timer 必须考虑：

- App 进入后台
- App 被切换
- 屏幕锁定

不能仅依赖 setInterval。

必须记录：

startTimestamp

恢复 App 后根据：

Date.now() - startTimestamp

重新计算真实时间。

---

# 7. 新增任务

Home 页面提供：

- Add Task

点击后打开 Bottom Sheet。

标题：

Create Task

字段：

Task Name

Icon

Tracking Type

Count
Timer

Daily Goal

Unit

Color

Repeat

默认：

Every Day

也允许：

Mon
Tue
Wed
Thu
Fri
Sat
Sun

按钮：

Create Task

创建完成后：

自动出现在 Home。

---

# 8. Icon Picker

提供简单 Icon Picker。

使用统一图标库。

建议：

Lucide Icons

分类：

Health
Fitness
Study
Lifestyle
Mindfulness
Custom

不要使用大量 Emoji 作为正式 UI 图标。

Emoji 只允许作为用户自定义选项。

---

# 9. Task Detail

点击任务进入 Detail 页面。

例如：

Exercise

Today

18 min / 30 min

显示大型 Progress Ring。

下面显示：

Today
This Week
Last 30 Days

提供简单趋势图。

例如：

Mon ███
Tue █████
Wed ██
Thu ██████
Fri ████

不要做复杂 Analytics Dashboard。

重点是：

用户一眼知道最近有没有坚持。

---

# 10. History 页面

History 是第二个核心页面。

顶部：

History

下面首先显示：

## Activity

显示 GitHub Contribution Graph 风格的：

**30 Day Activity Heatmap**

每个方格代表一天。

颜色深浅表示当天完成程度。

例如：

0%
25%
50%
75%
100%

点击日期显示：

October 1

4 / 5 completed

Water
8 / 8

Exercise
30 / 30 min

Reading
20 / 30 min

---

# 11. Timeline

Heatmap 下方显示 Timeline。

例如：

Today

08:20
Water +1

12:30
Water +1

17:40
Exercise
32 min

21:10
Reading
20 min

Yesterday

...

Timeline 必须支持滚动。

历史数据来自本地数据库。

---

# 12. 数据模型

设计清晰 TypeScript 类型。

Task：

id
name
icon
color
trackingType
goal
unit
repeatDays
createdAt
archived

Record：

id
taskId
date
value
timestamp
type

TimerSession：

id
taskId
startTime
endTime
duration
status

DailySummary：

date
completedTasks
totalTasks
completionRate

所有数据必须真正持久化。

禁止使用 Mock Data 作为最终实现。

---

# 13. 数据存储

优先使用：

SQLite

推荐：

expo-sqlite

建立：

tasks
records
timer_sessions

数据库必须：

- 首次启动初始化
- 支持 schema version
- 支持 migration
- 防止重复记录
- 使用 repository/service 层

不要直接在 UI Component 中写 SQL。

结构：

database/
db.ts
migrations.ts
taskRepository.ts
recordRepository.ts
timerRepository.ts

---

# 14. State Management

使用轻量状态管理。

推荐：

Zustand

Store：

taskStore
recordStore
timerStore
settingsStore

不要使用 Redux，除非确实必要。

---

# 15. History 计算

Heatmap 数据必须根据真实记录计算。

例如：

completionRate = completedTasks / scheduledTasks

如果：

5 个任务

完成 4 个

completionRate = 0.8

Heatmap intensity 根据：

0
0.25
0.5
0.75
1

映射。

---

# 16. 动画

使用：

React Native Reanimated

动画必须克制。

包括：

Task Complete

scale:
1 → 0.96 → 1

Progress：

animated width

Page：

fade + translateY

Bottom Sheet：

spring animation

Progress Ring：

animated stroke

动画时长：

150–350ms

禁止：

- 过度弹跳
- 大量粒子
- 长动画
- 游戏式动画

---

# 17. Haptic Feedback

使用：

expo-haptics

Quick Add：

Light

Task Complete：

Medium

Timer Start：

Light

Timer Finish：

Success

所有 Haptic 都应该可以在 Settings 中关闭。

---

# 18. 国际化

必须支持：

English
简体中文

使用：

i18next

或：

react-i18next

结构：

locales/

en.json
zh-CN.json

所有 UI 文本必须通过：

t()

调用。

禁止硬编码大量英文。

例如：

t("home.today")
t("task.completed")
t("history.title")

语言默认跟随系统。

允许用户手动切换：

System
English
简体中文

---

# 19. Settings

虽然不需要独立底部 Tab，但可以通过 Home 顶部按钮进入 Settings。

Settings 包括：

Language

Theme

System
Light
Dark

Haptic Feedback

Notifications

Week Starts On

Monday
Sunday

About Daily+

Version

---

# 20. Dark Mode

完整支持：

Light Mode
Dark Mode

所有颜色使用 Design Tokens。

禁止：

backgroundColor: "#FFFFFF"

散落在 Component 中。

建立：

theme/
colors.ts
spacing.ts
radius.ts
typography.ts
shadows.ts

例如：

colors.background
colors.surface
colors.primary
colors.textPrimary
colors.textSecondary
colors.border

---

# 21. Design System

Spacing：

4
8
12
16
20
24
32
40

Radius：

small 12
medium 18
large 24
xl 32

Button Height：

48–56

Task Card：

72–96

Typography：

Large Title
32–36

Title
24–28

Headline
18–20

Body
15–17

Caption
12–14

优先使用系统字体。

iOS：

SF Pro

Android：

系统 Sans

不要为了模仿 iOS 强制安装 SF Pro。

---

# 22. Widget

Daily+ 需要规划：

iOS Home Screen Widget
Android Home Screen Widget

Widget 展示：

Daily+

Today

3 / 5

Water ✓
Exercise 18/30
Reading ✓

以及：

Quick Add

Widget 点击后 Deep Link：

dailyplus://task/{id}

进入对应 Task。

如果 Expo Managed Workflow 无法直接实现完整 Widget：

使用：

Expo Prebuild

生成：

ios/
android/

并通过：

Native Module
Config Plugin
WidgetKit
Android AppWidget

实现。

不要为了保持纯 Expo Managed 而牺牲 Widget。

---

# 23. Notifications

允许任务设置提醒。

例如：

Drink Water

Every 2 hours

或：

Exercise

18:00

使用：

expo-notifications

通知必须：

可关闭
可编辑
可删除

不要默认疯狂发送通知。

---

# 24. Accessibility

支持：

Dynamic Type

Screen Reader

VoiceOver

TalkBack

Button Hit Area ≥ 44pt

颜色对比满足基本 WCAG。

不能只依赖颜色表示完成状态。

例如：

✓ Completed

同时显示文字或图标。

---

# 25. 性能

目标：

60 FPS

优化：

FlatList

memo

useMemo

useCallback

避免：

无意义 rerender

Heatmap 不应该每次 render 都重新计算全部历史数据。

使用：

selector
memoized calculation

---

# 26. 项目结构

建议：

src/

app/

components/
TaskCard.tsx
ProgressRing.tsx
Heatmap.tsx
Timer.tsx
BottomSheet.tsx
EmptyState.tsx

features/

tasks/
history/
timer/
settings/

store/

database/

hooks/

services/

theme/

locales/

utils/

types/

不要把所有逻辑塞进：

App.tsx

---

# 27. Expo Router

页面：

app/

_layout.tsx

(tabs)/
_layout.tsx
index.tsx
history.tsx

task/
[id].tsx

settings/
index.tsx

create-task.tsx

使用 typed navigation。

---

# 28. Empty State

第一次打开 App：

不要展示空白页面。

显示：

Welcome to Daily+

Build small habits,
one day at a time.

Create your first task

提供：

Create Task

以及几个模板：

Water
Exercise
Reading
Meditation

用户点击模板即可快速创建。

---

# 29. Onboarding

首次启动提供极短 onboarding。

最多 3 页。

Page 1

Daily+

Small habits.
Better days.

Page 2

Track what matters.

Count or time your daily habits.

Page 3

See your progress.

Build consistency over time.

按钮：

Get Started

不要要求：

注册
邮箱
手机号

Daily+ 默认：

Local First

---

# 30. Privacy

Daily+ 默认不需要账号。

数据：

Local First

不上传健康数据。

Settings 中显示：

Your data stays on your device.

未来可以扩展：

iCloud
Google Drive
Cloud Sync

但当前版本不要实现复杂账号系统。

---

# 31. 示例默认任务

开发阶段允许 Seed Data：

Water

type:
count

goal:
8

unit:
cups

Exercise

type:
timer

goal:
30

unit:
min

Reading

type:
timer

goal:
20

unit:
min

Meditation

type:
timer

goal:
10

unit:
min

但生产首次启动应让用户选择是否添加模板。

---

# 32. 边界情况

必须处理：

任务删除

任务 Archive

跨天

时区变化

Timer 跨午夜

Timer App 后台

Timer App 被系统杀掉

重复点击

数据库初始化失败

无任务

无历史记录

Heatmap 无数据

目标修改

任务 Repeat Day 修改

Dark Mode

语言实时切换

---

# 33. 日期逻辑

所有日期处理统一。

建议：

date-fns

保存：

timestamp

显示时转换到：

local timezone

Daily Record 使用：

YYYY-MM-DD

但必须基于用户本地日期生成。

不要简单：

new Date().toISOString().split("T")[0]

因为 UTC 可能导致日期错误。

建立：

getLocalDateKey()

统一处理。

---

# 34. Timer 架构

Timer 不应该依赖 UI 生命周期。

创建：

TimerService

状态：

idle
running
paused

保存：

startTimestamp
pausedDuration
lastPauseTimestamp

App 恢复后重新计算。

Timer 状态持久化。

如果 App 崩溃：

重新打开后仍能恢复 Timer。

---

# 35. 删除机制

不要直接永久删除 Task。

默认：

Archive

Task：

archived: true

历史 Record 保留。

这样 History 不会因为删除任务而损坏。

---

# 36. UI 细节

Home 背景保持干净。

顶部：

Daily+
Tuesday, October 1

右侧：

Settings icon

下面：

Progress Ring

例如：

60%

3 of 5 completed

然后：

Today Tasks

Task Cards

底部：

- Add Task

Tab Bar：

Home
History

Tab Bar 使用：

半透明
Blur
圆角

但确保 Android 上 Blur 性能不佳时有 fallback。

---

# 37. 微交互

完成任务：

Progress Ring 平滑增加。

Quick Add：

数字轻微 Scale。

Task 完成：

Check Icon 出现。

Timer：

Start → Pause

按钮状态自然 Morph。

不要出现：

Confetti

除非用户完成当天所有任务。

即使全部完成，也只允许非常轻量的 Celebration。

---

# 38. 错误处理

建立：

ErrorBoundary

数据库操作：

try/catch

用户可理解的错误提示。

不要直接展示：

SQLITE_ERROR

而应该：

Something went wrong.

Please try again.

Debug Build 可以 console.error。

Production 不显示内部错误。

---

# 39. Testing

至少实现：

Unit Tests

针对：

completion calculation

date calculation

timer calculation

repeat days

heatmap intensity

Repository Tests

测试：

create task

add record

archive task

load history

Timer：

background recovery

---

# 40. Code Quality

必须：

TypeScript strict

禁止：

any

除非第三方 API 无法避免。

使用：

ESLint
Prettier

Component：

尽量 < 250 行

复杂逻辑抽离到：

hooks
services
utils

---

# 41. README

生成完整：

README.md

包括：

Daily+ 简介

Screenshots placeholder

Features

Tech Stack

Project Structure

Installation

Development

iOS

Android

Widget Development

Database

Internationalization

Testing

Build

---

# 42. 开发命令

项目应该支持：

npm install

npx expo start

npx expo run:android

npx expo run:ios

并说明：

哪些功能 Expo Go 可运行。

哪些功能需要：

Development Build

Widget 需要：

Prebuild / Native Build

---

# 43. App 配置

配置：

app.json
或
app.config.ts

Name：

Daily+

Slug：

daily-plus

Scheme：

dailyplus

支持 Deep Link：

dailyplus://

设置：

adaptive icon

splash screen

orientation

permissions

notifications

---

# 44. 不要做的事情

禁止：

只生成静态 UI

大量 Mock Data

所有代码写 App.tsx

伪造数据库

伪造 Timer

只支持 iOS

Android UI 崩坏

硬编码英文

把所有颜色写死

滥用 useEffect

Timer 使用单纯 setInterval 作为真实时间来源

删除 Task 后删除所有 History

为了 Expo Go 放弃 Widget

引入十几个不必要依赖

---

# 45. MVP 优先级

按照以下顺序开发。

Phase 1：

项目初始化

Expo Router

Theme

i18n

SQLite

Phase 2：

Task CRUD

Home

Task Card

Quick Record

Phase 3：

Timer

后台恢复

持久化

Phase 4：

History

Timeline

Heatmap

Phase 5：

Animations

Haptics

Dark Mode

Phase 6：

Notifications

Phase 7：

Widget

Phase 8：

Testing

Performance

Accessibility

Polish

---

# 46. 最终验收标准

最终必须能够完成：

打开 Daily+

↓

创建：

Water
8 cups

↓

首页出现 Water

↓

点击 +：

1 / 8

↓

关闭 App

↓

重新打开

↓

仍然：

1 / 8

---

创建：

Exercise
30 min

↓

Start

↓

退出 App

↓

5 分钟后回来

↓

Timer 正确显示约：

05:00

↓

Finish

↓

记录写入 History

---

第二天打开：

任务重新显示：

0 / 8

但昨天记录仍然存在。

---

History：

能够看到：

30 Day Heatmap

点击昨天：

显示昨天任务完成情况。

---

切换：

English → 中文

所有页面立即更新。

---

切换：

Light → Dark

所有 UI 正常。

---

# 47. 最终交付要求

不要只告诉我：

“你可以这样实现”。

你必须直接创建代码。

首先：

1. 分析需求
2. 给出 Architecture
3. 给出 File Tree
4. 初始化项目
5. 安装 Dependencies
6. 创建 Database
7. 创建 Design System
8. 创建 Navigation
9. 实现 Home
10. 实现 Task
11. 实现 Timer
12. 实现 History
13. 实现 Settings
14. 实现 i18n
15. 实现 Notifications
16. 实现 Widget
17. 添加 Tests
18. 运行 TypeScript Check
19. 运行 ESLint
20. 修复所有错误
21. 启动项目验证

如果运行过程中出现：

TypeScript Error
Gradle Error
Expo Error
Dependency Error
Runtime Error

不要停止。

读取错误日志，定位问题，修改代码，再重新运行。

不要通过删除功能绕过错误。

---

# 48. Coding Agent 工作规则

你拥有项目目录的编辑权限。

执行任务时：

不要每创建一个文件就询问我。

可以自主完成合理的工程决策。

如果某个库已经过时：

使用当前 Expo SDK 兼容的稳定替代方案。

在安装任何第三方包前：

检查其是否兼容当前 Expo / React Native 版本。

优先使用：

Expo 官方库
React Native 官方能力
活跃维护的成熟库

避免：

多年未维护的 Package。

如果 Package 与当前 Expo SDK 不兼容：

不要强行降级整个项目。

寻找兼容替代方案。

---

# 49. UI 质量要求

这个项目不仅要求“能运行”。

还必须：

**看起来像真正可以发布到 App Store / Google Play 的产品。**

每完成一个页面：

检查：

Spacing
Alignment
Typography
Touch Target
Dark Mode
Safe Area
Keyboard
Small Screen
Large Screen

尤其测试：

iPhone

Android 360×800 左右设备

不能出现：

文字截断
按钮超出屏幕
Bottom Tab 遮挡内容
Keyboard 遮挡输入框

---

# 50. 最终产品目标

Daily+ 应该给人的感觉是：

打开 App：

“今天我要完成什么？”

而不是：

“这里为什么有这么多功能？”

核心体验永远围绕：

**Record → Progress → History**

保持 Daily+：

Simple.

Fast.

Calm.

Useful.

最终结果必须是一套：

**真正可运行、可持续开发、具有发布级架构的 Daily+ iOS + Android 应用。**

现在开始实施。

不要停留在方案讨论阶段。

先检查当前项目目录。

如果项目不存在，从零创建。

如果已经存在项目，则先分析现有代码，在不破坏已有可用功能的前提下逐步重构和实现上述需求。
