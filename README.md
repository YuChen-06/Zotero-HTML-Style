# Zotero-Theme-Switcher

一个针对 Zotero 阅读器中“从 Zotero 打开的 HTML 页面”的主题扩展插件。项目定位为对「Style」类插件的功能扩充：提供内置多套配色主题（亮/暗/护眼黄/护眼绿），并允许通过自定义 CSS 变量实现更灵活的外观定制。

## 功能特性

- 内置主题：亮、暗、护眼黄、护眼绿。
- 偏好设置面板：一键切换默认主题，实时保存。
- 自定义 CSS 变量：在偏好面板中以 JSON 形式定义，全局应用于受控的 HTML 页面。
- 针对 Reader 打开的 HTML 生效，不影响 Zotero 其他界面。
- 基于 Fluent 的本地化框架，支持多语言（`addon/locale/`）。

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
- 右上角有一个白色的名为Theme的按钮，点击即可切换样式

## 偏好设置与自定义

- 默认主题（`defaultTheme`）
  - 可选值：`light` | `dark` | `yellow` | `green`。

## 目录结构（关键文件）

- `addon/`：
  - `manifest.json`：Zotero 插件清单。
  - `bootstrap.js`：插件入口与生命周期钩子。
  - `content/`：最终打包脚本与资源的目标路径。
  - `locale/`：Fluent 本地化资源。
- `src/`：
  - `index.ts`：初始化并暴露 `Zotero.__addonInstance__`。
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
- 本项目使用 `zotero-plugin-scaffold` 与 `zotero-plugin-toolkit`。
- 首次克隆后如遇类型或依赖问题，先执行 `npm install` 并重启编辑器。

## 兼容性

- 适配 Zotero 7 及以上版本（`manifest.json` 限定 `strict_min_version: 6.999`，`strict_max_version: 8.*`）。

## 许可证

- Apache License

## 致谢

- 感谢 Zotero 团队与社区。
- 灵感来源于「Style」类插件；并使用了 `zotero-plugin-toolkit` 与 `zotero-plugin-scaffold`。
