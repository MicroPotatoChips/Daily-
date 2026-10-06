# Daily+ 视觉素材

风格：奶油白、森林绿、鼠尾草绿，少量青柠/暖桃色；叶片形 d+ 与生长、专注、完成三组插画。使用内置图像生成工具获得概念稿，然后人工重绘为可编辑 SVG 路径。原稿、提示词和矢量源文件全部保留。

| 文件 | 用途 |
| --- | --- |
| `assets/vectors/mark.svg`、`mark-dark.svg` | 浅/深色品牌标志 |
| `assets/vectors/growth.svg`、`focus.svg`、`celebrate.svg` | 插画主源文件 |
| 同名 `-dark.svg` | 自动生成的深色变体 |
| `assets/icon.png`、`icon-dark.png` | 1024×1024 不透明平台图标 |
| `assets/adaptive-icon.png`、`monochrome-icon.png` | Android 透明前景；系统负责形状遮罩 |
| `assets/splash.png`、`splash-dark.png` | 原生开屏标志；背景在 app.config.ts 设置 |
| `assets/illustrations/*` | 浅/深色 1200×800 PNG / 无损 WebP |
| `src/brand/artwork.ts` | 从 SVG 生成的本地矢量字符串，供 BrandArt 使用 |
| `docs/design/originals/*` | 四张图像生成概念稿，不进入应用包 |
| `docs/design/PROMPTS.json` | 完整生成提示词与制作方式 |
| `docs/design/preview.png`、`preview.svg` | 素材/开屏布局预览，不是真机截图 |

在项目中编辑四个主 SVG 后执行：

```sh
pnpm assets:build
node scripts/build-preview.mjs
```

深色颜色替换和平台图标安全区由 `scripts/build-assets.mjs` 统一控制。不要单独编辑自动生成的 `-dark.svg` 或 `artwork.ts`。运行时不加载远程图片。插画是装饰，不向屏幕阅读器重复朗读；界面文案保留在 i18n 中。

如果将本素材包单独用于其他项目，直接使用 SVG 或 PNG/WebP 文件即可；它们不依赖 Daily+ 的代码。概念稿存在质感光晕，最终 SVG 已去掉光晕并简化为干净的路径，不是将 PNG 包进 SVG。
