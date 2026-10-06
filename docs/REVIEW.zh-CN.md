# Daily+ 1.2.0 小组件与动画更新

日期：2026-10-03。基于上轮 1.1.0 优化版继续修改。本轮完整源码包含既有图标、开屏、SVG 插画，以及以下功能。

- Android 四行、iOS 中号四格/大号四行，展示今天前四个任务的已保存数值、目标和进度。
- 组件直接加一，计时直接开始、暂停、继续、结束保存；操作按钮不跳转应用。
- 使用同一份 SQLite 数据，事务保存、重复操作去重、过期计时状态校验、按本地日期拆分时长；schema v2 保留原任务和记录。
- iOS 首次升级通过 SQLite backup 将旧库复制到 App Group 目录；旧库保留。Android 使用原应用库。
- 动画改为统一的按压回弹、保存成功后完成反馈、260ms 进度变化；横条使用 transform 避免逐帧修改宽度；导航响应减少动态效果设置。

本轮 TypeScript / ESLint 和 39 项测试通过，两平台 prebuild 及 Web/iOS/Android JavaScript 导出通过。测试覆盖升级与两个 SQLite 连接的数据互通；没有执行原生 Swift/Kotlin，也未完成 Xcode/Android SDK 编译、安装和真机点击验证。iOS 直接交互需要 17+；iOS 16.4 只读；本轮 iOS 提供中号/大号，旧小号需重新添加。首次升级后先打开应用一次。详见 [小组件说明与设备验证项](WIDGETS.md)。

本轮未添加第三方依赖。下方保留上轮安全检查结果及其日期；上轮已知的构建工具链 node-forge 告警不能视为本轮已解决，也不能把预构建或 JavaScript 测试理解为原生安全审计完成。

---

# Daily+ 1.1.0 优化与安全检查报告

检查日期：2026-10-02。输入：`daily_plus_core_source.zip`。输出：优化后的完整源码及素材。原始压缩包未覆盖；SQLite schema 仍为 v1，无清库或破坏性迁移。

## 结论

已修复外部链接自动打卡、边界输入、小数修正和时钟回拨导致的计时重叠问题，优化历史统计与计时刷新，接入统一的 SVG 品牌和插画。TypeScript、ESLint 和 36 项自动测试通过，iOS / Android / Web 资源导出及两端原生工程生成通过。

依赖扫描从原始的 **2 项中危 + 1 项高危** 降到 **1 项高危**。剩余 `node-forge` 属于 Expo 构建工具链，上游公告尚未提供已修复版本。本次不是完整渗透测试，也不能保证没有未知漏洞。

## 已处理问题

| 问题 | 原行为及影响 | 修改与验证 |
| --- | --- | --- |
| 深链接无需确认写入记录 | 有效任务 ID 的 `quickAdd` 参数只要为真值就自动 +1，外部链接可造成未经确认的记录变更 | 仅接收单个 `quickAdd=1`、受限字符与长度的任务/操作 ID；页面确认后才写入；使用独立 `confirmed-link:` 操作命名空间；拒绝数组、缺失及非法参数；保留数据库幂等性 |
| URI 解码依赖拒绝服务 | Expo Router → query-string → decode-uri-component 0.2.2，畸形百分号编码可能造成过量计算 | 限定覆盖到 0.5.0；为 query-string 7.1.3 增加 CJS/ESM 兼容补丁；测试中文、重复参数及 32KB 畸形输入（独立线程、3 秒超时） |
| uuid 依赖公告 | xcode → uuid 7.0.3 命中边界写入公告 | 仅对 xcode 的依赖覆盖为支持 CommonJS 的 11.1.1；原生 Widget Xcode 工程测试及实际 prebuild 通过 |
| 小数修正误判 | `0.3 - 0.1 - 0.2` 的浮点余数可能被当作负数拒绝 | 写入边界使用微小容差，显示汇总清理微小余数，真实超额扣减仍被拒绝；新增真实 SQLite 回归测试 |
| 非法数值和时间 | 非有限计时参数、过大记录值或操作 ID 可进入数据处理路径 | 校验有限数值、有效整数时间戳、长度；手动记录与目标绝对值范围为 0.000001–1,000,000；非法输入不写入 SQLite |
| 回拨时钟产生重叠 | 暂停后将系统时间调早，再恢复时可能重复计算已经保存的时间段 | 恢复时间不早于最后已结束片段；结束时间不早于片段末尾；测试回拨后不重叠。仍使用系统时间，不声称能恢复人为改钟期间真实的单调时长 |
| pnpm 干净安装后测试失败 | 原测试直接 require xcode，但未声明直接依赖 | 明确声明 xcode 开发依赖；固定 pnpm 版本和锁文件；测试入口改为 Node + tsx loader，不再依赖 tsx CLI 的 IPC 服务 |
| 计时重复点击与无效刷新 | 首次 render 更新前可再次触发按钮；暂停和后台仍定时重绘 | 用 ref 同步锁住操作；只有运行且前台可见时每秒刷新；数据精度仍由持久化时间戳决定 |
| 历史统计重复遍历 | 日期 × 任务反复扫描完整记录列表 | 更新记录时建立 日期→任务→合计 索引，首页、30 天历史与趋势复用；新增与原计算结果一致的测试 |
| 开屏提前消失 | 数据库与主题加载未与原生开屏显式协调 | 持有原生开屏，数据就绪或加载失败后隐藏；失败时可显示重试，不设人为等待时间 |

链接确认是本次有意调整的用户流程：Widget 的 +1 也会先打开应用确认。URL 的 `widget-` 前缀不被当作身份凭证；这避免仅凭自定义 scheme 写入数据。

## 仍需处理：node-forge

- 公告：GHSA-86w9-cpqp-85rv / CVE-2026-85393，RSA PKCS#1 v1.5 签名验证问题；扫描版本 1.4.0。
- 路径：Expo → @expo/cli → node-forge，及 @expo/code-signing-certificates。
- 截至检查日，公告的 Patched versions 为 None，因此没有伪造“升级完成”，也没有未经验证改写密码学实现。
- 本次生成的 iOS / Android / Web source map 中未发现 node-forge 源文件。这支持其属于构建工具链的判断，不等于工具链不受影响或未来配置不会引入它。
- 后续：上游发布修复后更新兼容 Expo 工具链，重新执行 `pnpm audit`、项目检查、prebuild 和构建。此前不应依赖受影响的 node-forge 验证不可信外部 RSA 签名或证书。
- `pnpm audit` 当前会因这项告警返回非零状态；它没有被忽略或隐藏。

## 素材与接入

以现有奶油白、森林绿、鼠尾草绿为基础，增加少量青柠和暖桃色。先使用图像生成制作概念稿，再人工重绘为真正的 SVG 路径。

- 叶片形 `d+` 标志：浅色、深色；1024px 不透明应用图标；Android 自适应前景及单色前景。
- 原生开屏：浅/深色背景与透明标志 PNG；源码保留 SVG。Expo 原生配置使用 PNG，应用内部通过 `react-native-svg` 渲染矢量。
- 三组插画：生长、专注、完成，各有浅色和深色 SVG，以及 1200×800 PNG 和无损 WebP。
- 已用于首次引导三页、首页空状态/休息日/全部完成、历史空状态、首页品牌和设置页品牌。
- SVG 不包含 base64 位图、外部链接或脚本；只包含可编辑路径和基本图形。
- `docs/design/preview.png` 为素材与开屏布局预览，不是真机截图。

## 验证记录与边界

| 项目 | 结果 |
| --- | --- |
| `pnpm typecheck` | 通过 |
| `pnpm lint` | 通过 |
| `pnpm test` | 36/36，通过 |
| iOS / Android / Web `expo export --platform all --source-maps` | 通过，产物已生成 |
| `expo prebuild --no-install --platform all` | 通过，验证插件生成原生项目；不是原生编译或签名 |
| `expo install --check` | 在线校验遇到代理超时；离线依据已安装 SDK 报告版本匹配，工具提示离线校验可靠性有限 |
| `pnpm audit --json` | 0 中危、1 高危、0 严重；高危见上文 |
| 基础密钥模式扫描 | src/modules/plugins 未发现私钥块及常见密钥格式；不是穷尽式秘密扫描 |
| 矢量渲染与尺寸检查 | 图标、浅/深色插画和预览已渲染并检查；平台图标无透明圆角遮罩 |
| 浏览器交互截图 | 当前环境浏览器未能正常启动，未声称通过端到端页面点击验收 |
| iOS/Android 真机 | 未执行 APK/IPA 原生编译、签名、安装和真机验收 |

已覆盖数据库迁移、跨午夜/夏令时/重启恢复、事务回滚、重复提交、归档恢复、设置持久化、中英文键一致性、Widget 工程结构和提醒计划。没有发现拼接用户输入执行 SQL 的路径；repository 使用参数化 SQL。应用仍是本地 SQLite，不是加密数据库；操作系统备份、解锁设备访问和越狱/root 不在本次修复范围内。

## 使用和后续真机验收

请使用 pnpm 安装，否则安全覆盖与补丁可能不生效：

```sh
npx pnpm@11.25.0 install --frozen-lockfile
npx pnpm@11.25.0 check
npx pnpm@11.25.0 start
```

图标、开屏、原生 Widget 配置变化需要重新 prebuild 和原生构建，热更新 JS 不能更新桌面图标；Expo Go 也不能作为原生开屏/Widget 验收依据。

建议发布前依次验证：创建与多次记录→退出重启；计时前后台/暂停/跨午夜；深链接打开不变更记录、确认后仅变更一次；浅深色、中英文、大字体；通知拒绝/授权/关闭；iOS/Android 各尺寸 Widget 与新图标裁切。长期大量历史仍会整体载入内存，未来数据规模较大时可再做 repository 分页和 SQL 聚合。

## 来源

- [decode-uri-component 维护者安全公告](https://github.com/SamVerschueren/decode-uri-component/security/advisories/GHSA-vcc3-ghjq-m6fr)
- [uuid 安全公告](https://github.com/advisories/GHSA-w5hq-g745-h8pq)
- [node-forge 安全公告](https://github.com/advisories/GHSA-86w9-cpqp-85rv)
- [Android：不安全的深链接使用](https://developer.android.com/privacy-and-security/risks/unsafe-use-of-deeplinks)
- [Expo SDK 57 SplashScreen](https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/)
- [Expo：开屏与应用图标](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/)
