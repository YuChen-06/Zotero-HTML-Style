/*
 * Copyright (C) 2026 YuChen
 *
 * This file is part of Zotero Theme Switcher.
 *
 * Zotero Theme Switcher is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Zotero Theme Switcher is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Zotero Theme Switcher.  If not, see <https://www.gnu.org/licenses/>.
 */

import pkg from "../../../package.json";
import { THEME_ORDER, PRESETS, type ThemeKey } from "../../themes";
import type {
  ConfigManager,
  ConfigChangeEvent,
  ThemeSwitcherSettings,
} from "../config/ConfigManager";
import {
  CompositeDisposable,
  disposeFn,
  type Disposable,
} from "../utils/Disposable";
import { createLogger } from "../utils/Logger";
import type { ThemeMenuItem } from "../ui/UIRenderer";
import { UIRenderer } from "../ui/UIRenderer";
import type { StyleInjector, InjectScope } from "../style/StyleInjector";
import {
  ReaderAdapter,
  type ReaderEventHandler,
  type RenderToolbarEvent,
  type ZoteroReaderAPI,
  type ZoteroReaderInstance,
} from "./ReaderAdapter";
import { ReaderRegistry } from "./ReaderRegistry";

/**
 * ReaderController 的构造参数。
 */
export interface ReaderControllerOptions {
  /** 配置管理器（负责 Pref 读取、监听与广播） */
  configManager: ConfigManager;

  /** 样式注入器（负责注入与应用主题/CSS 变量） */
  styleInjector: StyleInjector;

  /** 可选：自定义注入范围（默认对子 iframe 递归注入） */
  injectScope?: InjectScope;
}

/**
 * ReaderController：总控模块。
 *
 * 核心职责（对应你提出的“闭环要求”）：
 * - 注册 Zotero Reader 的 `renderToolbar` 事件，用于初始化每个 Reader 页签；
 * - 在工具栏渲染时：
 *   - 登记 Reader（用于后续热更新遍历）；
 *   - 渲染工具栏按钮与菜单（UIRenderer）；
 *   - 等待 iframe 文档就绪后注入/应用样式（ReaderAdapter + StyleInjector）。
 * - 订阅 ConfigManager 的配置变更事件：
 *   - 遍历 ReaderRegistry 中仍存活的 Reader；
 *   - 对每个 Reader 重新应用样式，实现“不重启即生效”。
 * - 实现 `dispose()`：
 *   - 注销 Reader 事件监听（若 API 支持）；
 *   - 取消配置订阅；
 *   - 清理内部资源引用，避免内存泄漏。
 */
export class ReaderController implements Disposable {
  private readonly log = createLogger("ReaderController");

  private readonly disposables = new CompositeDisposable();

  private readonly configManager: ConfigManager;
  private readonly styleInjector: StyleInjector;
  private readonly readerAdapter = new ReaderAdapter();
  private readonly registry = new ReaderRegistry();
  private readonly uiRenderer = new UIRenderer();

  private readonly injectScope: InjectScope;

  /**
   * 记录每个 Reader 当前主题。
   *
   * 为什么使用 WeakMap：
   * - key 为 Reader 实例；
   * - Reader 被关闭后应可被 GC 回收；
   * - WeakMap 不会形成强引用链，符合内存泄漏审计要求。
   */
  private readonly currentThemeByReader = new WeakMap<
    ZoteroReaderInstance,
    ThemeKey
  >();

  /** Reader 事件 handler（需要保留引用以便卸载） */
  private readonly onRenderToolbar: ReaderEventHandler;

  public constructor(options: ReaderControllerOptions) {
    this.configManager = options.configManager;
    this.styleInjector = options.styleInjector;
    this.injectScope = options.injectScope ?? "documentAndSubFrames";

    this.onRenderToolbar = (event) => {
      void this.handleRenderToolbar(event);
    };
  }

  /**
   * 启动控制器：注册事件与订阅配置变化。
   *
   * 调用时机建议：
   * - 在 `hooks.onStartup()` 完成 Zotero 初始化等待后调用。
   */
  public start(): void {
    this.configManager.onChange = (ev) => this.onConfigChanged(ev);

    // 注册 Reader 工具栏渲染事件
    const api = this.getReaderAPI();
    api.registerEventListener(
      "renderToolbar",
      this.onRenderToolbar,
      pkg.config.addonID,
    );

    // 卸载逻辑（若 API 支持）
    this.disposables.add(
      disposeFn(() => {
        const unregister = api.unregisterEventListener;
        if (typeof unregister === "function") {
          try {
            unregister(
              "renderToolbar",
              this.onRenderToolbar,
              pkg.config.addonID,
            );
          } catch {
            // best-effort
          }
        }
      }),
    );

    this.log.debug("ReaderController started");
  }

  /**
   * 处理 `renderToolbar` 事件。
   *
   * 为什么设计为 async：
   * - `renderToolbar` 回调触发时，Reader iframe 内 document 未必就绪；
   * - 我们需要等待文档就绪后再注入样式，因此必须走异步等待。
   */
  private async handleRenderToolbar(event: RenderToolbarEvent): Promise<void> {
    const { reader, doc, append } = event;
    this.log.debug("renderToolbar event received");

    // 记录 reader 以便后续热更新
    this.registry.register(reader);

    const settings = this.configManager.getSettings();

    // 用户可关闭工具栏按钮显示
    if (settings.showToolbar === false) return;

    const currentTheme = this.getOrInitThemeForReader(reader, settings);

    const themes = this.buildThemeMenuItems();

    // 渲染 UI（防重、并提供 dispose）
    const uiHandle = this.uiRenderer.render({
      doc,
      append,
      tooltip: this.t("ts-tooltip"),
      clickBehavior: settings.clickBehavior,
      currentTheme,
      themes,
      onPickTheme: (key) => {
        this.setThemeForReader(reader, key);
        // 关键：不能复用 renderToolbar 触发时的 settings 快照。
        // 用户可能已在设置面板中修改配置；此处必须获取最新 settings。
        const latest = this.configManager.getSettings();
        void this.applyToReader(reader, latest, key);
      },
      onCycleTheme: () => {
        const next = this.nextTheme(
          this.getOrInitThemeForReader(reader, settings),
        );
        this.setThemeForReader(reader, next);
        const latest = this.configManager.getSettings();
        void this.applyToReader(reader, latest, next);
      },
    });

    // 注意：这里不把 uiHandle 存入全局强引用集合，避免 Reader 关闭后无法回收。
    // UI 的生命周期主要由工具栏 document 自身销毁来管理。
    // 在第三步后续的更完善版本中，我们会在 ReaderRegistry 里建立 per-reader 的 disposable 容器（同样使用 WeakMap）。
    void uiHandle;

    // 初次渲染时确保注入
    await this.applyToReader(reader, settings, currentTheme);
  }

  /**
   * 当配置变化时触发热更新。
   */
  private onConfigChanged(ev: ConfigChangeEvent): void {
    const settings = ev.settings;

    // 合理的性能策略：只有相关 key 变化才触发热更新
    // （showToolbar 变化也会影响 UI，但其处理主要发生在下一次 renderToolbar；这里仍做样式刷新是安全的）
    const needRefresh = ev.changedKeys.some((k) =>
      [
        "defaultTheme",
        "customVariablesJSON",
        "showToolbar",
        "clickBehavior",
      ].includes(String(k)),
    );
    if (!needRefresh) return;

    this.log.debug(
      `Config changed (${ev.changedKeys.join(", ")}), hot refreshing readers...`,
    );

    // 主动 compact 一次，减少 WeakRef 膨胀
    this.registry.compact();

    // 遍历存活 reader，尽力刷新
    this.registry.forEachAlive((reader) => {
      const theme = this.getOrInitThemeForReader(reader, settings);
      void this.applyToReader(reader, settings, theme);
    });
  }

  /**
   * 对某个 Reader 重新应用样式。
   *
   * @param reader Reader 实例
   * @param settings 最新配置
   * @param theme 要应用的主题
   */
  private async applyToReader(
    reader: ZoteroReaderInstance,
    settings: ThemeSwitcherSettings,
    theme: ThemeKey,
  ): Promise<void> {
    const doc = await this.readerAdapter.waitForHTMLDocument(reader);
    if (!doc) {
      this.log.debug("applyToReader: no HTML document found, skipping");
      return;
    }
    this.log.debug(`applyToReader: applying theme "${theme}"`);
    if (!doc) return;

    const options = this.styleInjector.buildOptionsFromSettings(
      settings,
      theme,
      this.injectScope,
    );

    this.styleInjector.applyToDocumentTree(doc, options);
  }

  /**
   * 从内存/偏好中获取当前主题。
   *
   * 规则：
   * 1) 优先使用 WeakMap 中的当前主题（用户在该 Reader 内手动切换的结果）；
   * 2) 如果没有，则尝试读取 lastTheme（跨页签记忆）；
   * 3) 再退化到 defaultTheme。
   */
  private getOrInitThemeForReader(
    reader: ZoteroReaderInstance,
    settings: ThemeSwitcherSettings,
  ): ThemeKey {
    const mem = this.currentThemeByReader.get(reader);
    if (mem) return mem;

    const last = this.getLastTheme();
    const theme = (last || settings.defaultTheme) as ThemeKey;
    this.currentThemeByReader.set(reader, theme);
    return theme;
  }

  /**
   * 设置并持久化主题。
   */
  private setThemeForReader(
    reader: ZoteroReaderInstance,
    theme: ThemeKey,
  ): void {
    this.currentThemeByReader.set(reader, theme);
    this.setLastTheme(theme);
  }

  /**
   * 从 Zotero.Prefs 读取“最近一次主题”。
   *
   * 说明：
   * - 该 pref 不属于 ConfigManager 的强类型 map（因为它是运行态状态），
   *   但仍然属于插件前缀下的持久化数据。
   */
  private getLastTheme(): ThemeKey | undefined {
    const full = `${pkg.config.prefsPrefix}.lastTheme`;
    try {
      const v = (Zotero as any).Prefs.get(full, true) as unknown;
      const s = typeof v === "string" ? v : "";
      return THEME_ORDER.includes(s as ThemeKey) ? (s as ThemeKey) : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * 将“最近一次主题”写回 Zotero.Prefs。
   */
  private setLastTheme(theme: ThemeKey): void {
    const full = `${pkg.config.prefsPrefix}.lastTheme`;
    try {
      (Zotero as any).Prefs.set(full, theme, true);
    } catch {
      // ignore
    }
  }

  /**
   * 计算下一个主题（用于 cycle 行为）。
   */
  private nextTheme(cur: ThemeKey): ThemeKey {
    const idx = THEME_ORDER.indexOf(cur);
    return THEME_ORDER[(idx + 1) % THEME_ORDER.length];
  }

  /**
   * 构建 UI 主题菜单项。
   */
  private buildThemeMenuItems(): ThemeMenuItem[] {
    return THEME_ORDER.map((key) => {
      const preset = PRESETS[key];
      return {
        key,
        label: this.themeDisplayName(key),
        swatchBg: preset["ts-bg"],
        swatchFg: preset["ts-fg"],
        swatchBorder: preset["ts-border"],
      };
    });
  }

  /**
   * 获取 Zotero Reader API。
   *
   * 为什么需要运行时断言：
   * - 本项目的 `global.d.ts` 将 Zotero 声明为 `any`；
   * - 类型系统无法保证 API 存在，因此需在运行时进行最小检查。
   */
  private getReaderAPI(): ZoteroReaderAPI {
    const api = (Zotero as any).Reader as ZoteroReaderAPI | undefined;
    if (!api || typeof api.registerEventListener !== "function") {
      throw new Error("Zotero.Reader API 不可用：无法注册 renderToolbar 事件");
    }
    return api;
  }

  /**
   * 获取当前 locale。
   */
  private getLocale(): string {
    try {
      return (Zotero?.locale as string) || navigator.language || "en-US";
    } catch {
      return "en-US";
    }
  }

  /**
   * 简易 i18n：用于少量文案（tooltip）。
   *
   * 说明：
   * - 你的仓库已有 Fluent 资源；后续如果你希望统一走 Fluent，
   *   可以在这里替换为 `Zotero.ftl`/`Zotero.getString` 等机制。
   */
  private t(id: string): string {
    const loc = this.getLocale().toLowerCase();
    const zh = loc.startsWith("zh");
    const map: Record<string, { zh: string; en: string }> = {
      "ts-tooltip": { zh: "切换阅读主题", en: "Switch reading theme" },
    };
    const m = map[id];
    if (!m) return id;
    return zh ? m.zh : m.en;
  }

  /**
   * 主题显示名（用于菜单）。
   */
  private themeDisplayName(key: ThemeKey): string {
    const loc = this.getLocale().toLowerCase();
    const zh = loc.startsWith("zh");

    const names: Record<ThemeKey, { zh: string; en: string }> = {
      light: { zh: "白天", en: "Light" },
      "deep-night": { zh: "暗夜", en: "Deep Night" },
      midnight: { zh: "黑夜", en: "Midnight" },
      beige: { zh: "米色", en: "Beige" },
      "green-dou": { zh: "豆沙绿", en: "Green (Dou)" },
      lilac: { zh: "浅紫", en: "Lilac" },
      "deep-beige": { zh: "深米色", en: "Deep Beige" },
    };

    const n = names[key];
    return (zh ? n.zh : n.en) || String(key);
  }

  /**
   * 释放控制器资源。
   */
  public dispose(): void {
    this.disposables.dispose();
  }
}
