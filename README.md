# Zotero Theme Switcher（Zotero 7–9 插件）

一个针对 Zotero Reader 中"从 Zotero 打开的 HTML 页面"的主题切换插件。

本项目的重点不只是"换个背景色"，而是通过 **分层架构（Config -> Controller -> UI/Adapter/Injector）** 把功能组织成可维护、可审计、可用于软著材料的工程化实现。

## 功能特性

- **多主题切换**：内置主题 `light` / `deep-night` / `midnight` / `beige` / `green-dou` / `lilac` / `deep-beige`。
- **工具栏 UI**：Reader 工具栏按钮 + 弹出菜单；支持"打开菜单 / 循环切换"两种点击行为。
- **自定义 CSS 变量**：在偏好面板中以 JSON 方式配置，自定义配色。
- **实时热更新（不重启生效）**：修改偏好后，已打开的 Reader 也会实时刷新样式。
- **三级容错适配**：针对 Reader iframe 就绪时机不稳定的问题，采用"同步快速路径 -> 事件驱动 -> 轮询兜底"的三重策略。
- **弱引用资源管理**：通过 `WeakMap/WeakRef` 跟踪 Reader，避免窗口关闭后仍被强引用导致内存泄漏。

## 安装与使用

### 1) 从发行版安装

- 前往仓库 [Releases](https://github.com/YuChen-06/Zotero-Theme-Switcher/releases) 页面下载安装包（`.xpi`）。
- 在 Zotero 中：工具 → 插件 → 齿轮 → 从文件安装，选择 `.xpi`。

### 2) 本地构建安装（开发者）

- 环境要求：Node.js ≥ 20（建议 20 LTS）。
- 安装依赖：`npm install`
- 构建：`npm run build`
- 构建输出目录：`.scaffold/build/`
  - 发布命令 `npm run release` 会在 `.scaffold/release/` 生成安装包

使用：

- 安装后，在 Zotero 中打开 HTML 页面。
- 阅读器工具栏会出现主题按钮（悬停提示"切换阅读主题"）。
  - 默认点击打开主题菜单。
  - 若在偏好设置中选择"直接循环切换"，则点击会按顺序轮换主题。

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

## 开发指南

### 常用命令

| 命令 | 说明 |
|------|------|
| `npm install` | 安装依赖 |
| `npm run build` | 构建插件 + 类型检查 |
| `npm run test:unit` | 运行单元测试 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run lint:check` | 检查代码格式 |
| `npm run lint:fix` | 自动修复格式 |
| `npm run ci` | 完整 CI 流水线 |

### 构建输出

- `.scaffold/build/addon/` — 插件目录
- `.scaffold/build/zotero-theme-switcher.xpi` — 可安装的 XPI 包

### 单元测试

```bash
npm run test:unit
```

运行 mocha 测试，覆盖纯模块（JsonUtils、themes、Disposable）。无需 Zotero 安装。

### CI/CD

项目使用 GitHub Actions 自动运行：
- Lint 检查（Prettier + ESLint）
- 单元测试
- TypeScript 类型检查
- 构建验证

## 目录结构

```
├── .github/workflows/ci.yml     # CI 配置
├── addon/                       # 插件静态资源
│   ├── bootstrap.js             # 插件入口
│   ├── manifest.json            # 插件清单
│   ├── prefs.js                 # 默认偏好项
│   ├── content/                 # XHTML 偏好面板
│   └── locale/                  # 国际化资源
├── src/                         # TypeScript 源码
│   ├── index.ts                 # 入口：单例创建 + 全局挂载
│   ├── hooks.ts                 # 生命周期钩子
│   ├── themes.ts                # 主题定义
│   ├── prefs/panel.ts           # 偏好面板绑定
│   └── modules/                 # 核心模块
│       ├── config/              # 配置管理
│       ├── reader/              # Reader 控制器
│       ├── style/               # 样式注入器
│       ├── ui/                  # UI 渲染器
│       └── utils/               # 工具函数
├── tests/unit/                  # 单元测试
├── scripts/                     # 工具脚本
├── typings/                     # TypeScript 类型声明
├── eslint.config.js             # ESLint 配置
├── .prettierignore              # Prettier 排除规则
├── patch-scaffold-notifier.mjs  # Build fix 脚本
├── DEVELOPMENT.md               # 开发文档
└── RUNTIME_TESTING.md           # Zotero 9 测试指南
```

## 兼容性

- 适配 Zotero 7–9（`manifest.json`: `strict_min_version: 7.0`, `strict_max_version: 9.*`）。
- 已在 Zotero 9.0.4 上测试通过。
- 详见 [RUNTIME_TESTING.md](RUNTIME_TESTING.md)。

## 许可证

- [Apache License 2.0](LICENSE)

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
- Triple-fallback adapter: sync fast-path -> event-driven -> polling fallback.
- Memory-safety: tracks Readers using `WeakMap/WeakRef` to avoid leaks.

## Installation

### From Release

1. Download `.xpi` from [Releases](https://github.com/YuChen-06/Zotero-Theme-Switcher/releases).
2. In Zotero: Tools → Add-ons → Gear icon → Install Add-on From File.

### Build from Source

```bash
npm install
npm run build
```

Output: `.scaffold/build/zotero-theme-switcher.xpi`

## Development

| Command | Description |
|---------|-------------|
| `npm run build` | Build plugin + type check |
| `npm run test:unit` | Run unit tests |
| `npm run typecheck` | TypeScript type check |
| `npm run lint:check` | Check formatting |
| `npm run ci` | Full CI pipeline |

## Compatibility

- Zotero 7–9 (`strict_min_version: 7.0`, `strict_max_version: 9.*`)
- Tested on Zotero 9.0.4

## License

- [Apache License 2.0](LICENSE)

</details>
