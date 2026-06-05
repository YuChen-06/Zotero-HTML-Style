# Zotero Theme Switcher（Zotero 7 插件）

一个针对 Zotero Reader 中“从 Zotero 打开的 HTML 页面”的主题切换插件。

本项目的重点不只是“换个背景色”，而是通过 **分层架构（Config -> Controller -> UI/Adapter/Injector）** 把功能组织成可维护、可审计、可用于软著材料的工程化实现。

## 功能特性

- **多主题切换**：内置主题 `light` / `deep-night` / `midnight` / `beige` / `green-dou` / `lilac` / `deep-beige`。
- **工具栏 UI**：Reader 工具栏按钮 + 弹出菜单；支持“打开菜单 / 循环切换”两种点击行为。
- **自定义 CSS 变量**：在偏好面板中以 JSON 方式配置，自定义配色。
- **实时热更新（不重启生效）**：修改偏好后，已打开的 Reader 也会实时刷新样式。
- **Zotero 7 三级容错适配**：针对 Reader iframe 就绪时机不稳定的问题，采用“同步快速路径 -> 事件驱动 -> 轮询兜底”的三重策略。
- **弱引用资源管理**：通过 `WeakMap/WeakRef` 跟踪 Reader，避免窗口关闭后仍被强引用导致内存泄漏。

## 安装与使用

### 1) 从发行版安装

- 前往仓库 Releases 页面下载安装包（`.xpi`）。
- 在 Zotero 中：工具 → 插件 → 齿轮 → 从文件安装，选择 `.xpi`。

### 2) 本地构建安装（开发者）

- 环境要求：Node.js ≥ 20（建议 20 LTS）。
- 安装依赖：`npm install`
- 构建：`npm run build`
- 构建输出目录：`.scaffold/build/`
  - 发布命令 `npm run release` 会在 `.scaffold/release/` 生成安装包

使用：

- 安装后，在 Zotero 中打开 HTML 页面。
- 阅读器工具栏会出现主题按钮（悬停提示“切换阅读主题”）。
  - 默认点击打开主题菜单。
  - 若在偏好设置中选择“直接循环切换”，则点击会按顺序轮换主题。

## 偏好设置与自定义

- **默认主题**（`defaultTheme`）
  - 可选值：`light` | `deep-night` | `midnight` | `beige` | `green-dou` | `lilac` | `deep-beige`
- **按钮点击行为**（`clickBehavior`）
  - `menu`：打开菜单
  - `cycle`：循环切换
- **显示工具栏按钮**（`showToolbar`）
  - `true/false`
- **自定义变量 JSON**（`customVariablesJSON`）
  - 顶层必须是对象，例如：
    ```json
    {
      "ts-bg": "#ffffff",
      "ts-fg": "#000000"
    }
    ```

## 软著源码导出（60 页源码材料）

本仓库提供脚本 `scripts/generate_source_dump.js`，用于把 `src/` 下的所有 `.ts` 合并输出到 `source_code_dump.txt`：

```bash
node scripts/generate_source_dump.js
```

说明：

- 默认仅抓取 `src/**/*.ts`（排除 `node_modules`、`dist`、`.git`、`.vscode` 等目录）。
- 自动在每个文件前插入分隔头：`// ================= FILE: ... =================`。
- 默认会压缩连续空行以节省页数，可用 `--no-compress` 关闭。

## 目录结构（关键文件）

- `src/`
  - `index.ts`：核心导出与单例出口（`getThemeSwitcherCore()`）。
  - `hooks.ts`：生命周期入口（启动/关闭时 init + dispose）。
  - `prefs/panel.ts`：偏好面板（通过 `ConfigManager` 读写，驱动热更新）。
  - `modules/`
    - `config/`：`ConfigManager` + 配置类型
    - `reader/`：`ReaderController` / `ReaderAdapter` / `ReaderRegistry`
    - `style/`：`StyleInjector`
    - `ui/`：`UIRenderer`
    - `utils/`：Disposable/PrefObserver/JsonUtils/DomGuards/Logger
- `typings/`：TypeScript 类型声明（含最小 stub）

## 兼容性

- 适配 Zotero 7–9（`manifest.json`: `strict_min_version: 7.0`, `strict_max_version: 9.*`）。
- 已在 Zotero 9.0.4 上测试通过。

## 许可证

- Apache License

---

<details>
<summary>English</summary>

# Zotero Theme Switcher (Zotero 7–9 Add-on)

A theme switcher add-on for **HTML pages opened inside Zotero Reader**.

This project emphasizes an **engineered, auditable architecture** (Config -> Controller -> UI/Adapter/Injector), not just a quick CSS tweak.

## Highlights

- Built-in themes: `light`, `deep-night`, `midnight`, `beige`, `green-dou`, `lilac`, `deep-beige`.
- Toolbar UI: button + popup menu; supports `menu` / `cycle` click behaviors.
- Custom CSS variables via JSON in Preferences.
- Hot reload: existing Reader tabs refresh styles immediately after config changes.
- Zotero 7 “triple-fallback” adapter: sync fast-path -> event-driven -> polling fallback.
- Memory-safety: tracks Readers using `WeakMap/WeakRef` to avoid leaks.

## Build & Install (Developer)

- Node.js >= 20 recommended.
- `npm install`
- `npm run build`

## Source Dump for Software Copyright

Generate a merged source text from `src/**/*.ts`:

```bash
node scripts/generate_source_dump.js
```

Use `--no-compress` to keep blank lines.

</details>
