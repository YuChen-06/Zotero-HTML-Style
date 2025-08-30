# Zotero-Theme-Switcher

一个针对 Zotero 阅读器中“从 Zotero 打开的 HTML 页面”的主题扩展插件。项目定位为对「Style」类插件的功能扩充：提供内置多套配色主题（亮/暗/护眼黄/护眼绿），并允许通过自定义 CSS 变量实现更灵活的外观定制。

## 功能特性

 - 内置主题：Light、Deep Night、Midnight、Beige、Green Dou、Lilac、Deep Beige。
 - 偏好设置面板：默认主题、按钮点击行为（打开菜单/直接循环）、显示工具栏按钮，实时保存。
 - 自定义 CSS 变量：在偏好面板中以 JSON 形式定义，全局应用于受控的 HTML 页面。
 - 仅作用于 Reader 打开的 HTML，不影响 Zotero 其他界面。
 - 本地化：基于 Fluent，已内置 zh-CN / en-US。

## 安装与使用

1) 从发行版安装
- 前往仓库 Releases 页面下载安装包（.xpi）。
- 在 Zotero 中：工具 → 插件 → 齿轮 → 从文件安装，选择 .xpi 即可。

2) 本地构建安装（开发者）
- 环境要求：Node.js ≥ 20（建议 20 LTS）。
- 安装依赖：`npm install`
- 构建：`npm run build`
- 构建输出目录：`.scaffold/build/`（发布命令 `npm run release` 会在 `.scaffold/release/` 生成安装包）

使用方法：
- 安装后，在 Zotero 中打开 HTML 页面。
 - 阅读器工具栏会出现主题按钮（悬停提示“切换阅读主题”）。默认点击打开主题菜单；若在偏好设置中选择“直接循环切换”，则点击会依次切换主题。

## 偏好设置与自定义

- 默认主题（`defaultTheme`）
  - 可选值：`light` | `deep-night` | `midnight` | `beige` | `green-dou` | `lilac` | `deep-beige`.

## 目录结构（关键文件）

- `addon/`：
  - `manifest.json`：Zotero 插件清单。
  - `bootstrap.js`：插件入口与生命周期钩子。
  - `content/`：最终打包脚本与资源的目标路径。
  - `locale/`：Fluent 本地化资源。
- `src/`：
  - `index.ts`：初始化并暴露 `Zotero.__addonInstance__`.
  - `addon.ts`：插件主类与数据结构。
  - `hooks.ts`：生命周期与 UI 绑定。
  - `prefs/panel.ts`：偏好面板逻辑。
  - `reader.ts`：Reader 页面主题注入与工具栏按钮逻辑。
  - `utils/`：偏好读写、Toolkit 封装等。
- `typings/`：类型声明。
- `zotero-plugin.config.ts`：构建配置。
- `tsconfig.json`：TypeScript 编译配置。

## 开发指南

- 安装依赖：`npm install`
- 开发预览：`npm start`
- 构建：`npm run build`
- 测试：`npm test`
- 代码风格：`npm run lint:check` / `npm run lint:fix`

注意：
- 本项目使用 `zotero-plugin-scaffold` 与 `zotero-plugin-toolkit`.
- 首次克隆后如遇类型或依赖问题，先执行 `npm install` 并重启编辑器.

## 兼容性

- 适配 Zotero 7 及以上版本（`manifest.json`：`strict_min_version: 7.0`，`strict_max_version: 8.*`）。

## 许可证

- Apache License

## 致谢

- 感谢 Zotero 团队与社区.
- 灵感来源于「Style」类插件；并使用了 `zotero-plugin-toolkit` 与 `zotero-plugin-scaffold`.

<details>
<summary>English</summary>

# Zotero Theme Switcher

An add-on for themes in “HTML pages opened from Zotero” inside the Zotero Reader. It extends the idea of Style add-ons: ships multiple built-in themes and lets you customize appearance via CSS variables.

## Features

- Built-in themes: Light, Deep Night, Midnight, Beige, Green Dou, Lilac, Deep Beige.
- Preferences panel: default theme, button click behavior (open menu/cycle), show toolbar button, live-save.
- Custom CSS variables: define them as JSON in Preferences and they apply to controlled HTML pages.
- Only affects HTML opened in the Reader, not other Zotero UI.
- Localization: Fluent-based, with zh-CN / en-US .

## Install & Use

1) From Releases
- Download the .xpi from the Releases page.
- In Zotero: Tools → Add-ons → gear icon → Install from File… choose the .xpi.

2) Build locally (for developers)
- Requirements: Node.js ≥ 20 (recommended 20 LTS).
- Install deps: `npm install`
- Build: `npm run build`
- Output: `.scaffold/build/` (release: `npm run release` produces `.scaffold/release/`)

Usage:
- Open an HTML page in Zotero Reader.
- A toolbar button appears (tooltip: “Switch reading theme”). By default click opens a theme menu; if you set “cycle” in Preferences, clicking will cycle themes.

## Preferences

- defaultTheme
  - One of: `light` | `deep-night` | `midnight` | `beige` | `green-dou` | `lilac` | `deep-beige`.

## Structure

- `addon/`: `manifest.json`, `bootstrap.js`, `content/`, `locale/`
- `src/`: `index.ts`, `addon.ts`, `hooks.ts`, `prefs/panel.ts`, `reader.ts`, `utils/`
- `typings/`, `zotero-plugin.config.ts`, `tsconfig.json`

## Development

- `npm install`
- `npm start`
- `npm run build`
- `npm test`
- Lint: `npm run lint:check` / `npm run lint:fix`

## Compatibility

- Targets Zotero 7+ (`manifest.json`: `strict_min_version: 7.0`, `strict_max_version: 8.*`).

## License

- Apache License

## Acknowledgements

- Thanks to the Zotero team and community.
- Inspired by Style add-ons; built with `zotero-plugin-toolkit` and `zotero-plugin-scaffold`.

</details>
