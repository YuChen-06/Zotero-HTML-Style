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

export interface ReaderControllerOptions {
  configManager: ConfigManager;
  styleInjector: StyleInjector;
  injectScope?: InjectScope;
}

/** Registers renderToolbar, renders UI, injects styles, hot-refreshes on config change. */
export class ReaderController implements Disposable {
  private readonly log = createLogger("ReaderController");

  private readonly disposables = new CompositeDisposable();

  private readonly configManager: ConfigManager;
  private readonly styleInjector: StyleInjector;
  private readonly readerAdapter = new ReaderAdapter();
  private readonly registry = new ReaderRegistry();
  private readonly uiRenderer = new UIRenderer();

  private readonly injectScope: InjectScope;

  private readonly currentThemeByReader = new WeakMap<
    ZoteroReaderInstance,
    ThemeKey
  >();

  private readonly onRenderToolbar: ReaderEventHandler;

  public constructor(options: ReaderControllerOptions) {
    this.configManager = options.configManager;
    this.styleInjector = options.styleInjector;
    this.injectScope = options.injectScope ?? "documentAndSubFrames";

    this.onRenderToolbar = (event) => {
      void this.handleRenderToolbar(event);
    };
  }

  public start(): void {
    this.configManager.onChange = (ev) => this.onConfigChanged(ev);

    const api = this.getReaderAPI();
    api.registerEventListener(
      "renderToolbar",
      this.onRenderToolbar,
      pkg.config.addonID,
    );

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

  private async handleRenderToolbar(event: RenderToolbarEvent): Promise<void> {
    const { reader, doc, append } = event;
    this.registry.register(reader);

    const settings = this.configManager.getSettings();
    if (settings.showToolbar === false) return;

    const currentTheme = this.getOrInitThemeForReader(reader, settings);
    const themes = this.buildThemeMenuItems();

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

    void uiHandle; // ponytail: UI lifetime managed by toolbar document destruction

    // 初次渲染时确保注入
    await this.applyToReader(reader, settings, currentTheme);
  }

  private onConfigChanged(ev: ConfigChangeEvent): void {
    const settings = ev.settings;
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
      `Config changed (${ev.changedKeys.join(", ")}), hot refreshing...`,
    );
    this.registry.compact();
    this.registry.forEachAlive((reader) => {
      const theme = this.getOrInitThemeForReader(reader, settings);
      void this.applyToReader(reader, settings, theme);
    });
  }

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

    this.styleInjector.applyToDocumentTree(doc, {
      theme,
      customVariables: settings.customVariables,
      scope: this.injectScope,
      maxFrameDepth: 5,
    });
  }

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

  private setThemeForReader(
    reader: ZoteroReaderInstance,
    theme: ThemeKey,
  ): void {
    this.currentThemeByReader.set(reader, theme);
    this.setLastTheme(theme);
  }

  // ponytail: lastTheme is runtime state, not in ConfigManager's typed map
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

  private setLastTheme(theme: ThemeKey): void {
    const full = `${pkg.config.prefsPrefix}.lastTheme`;
    try {
      (Zotero as any).Prefs.set(full, theme, true);
    } catch {
      // ignore
    }
  }

  private nextTheme(cur: ThemeKey): ThemeKey {
    const idx = THEME_ORDER.indexOf(cur);
    return THEME_ORDER[(idx + 1) % THEME_ORDER.length];
  }

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

  private getReaderAPI(): ZoteroReaderAPI {
    const api = (Zotero as any).Reader as ZoteroReaderAPI | undefined;
    if (!api || typeof api.registerEventListener !== "function") {
      throw new Error("Zotero.Reader API 不可用：无法注册 renderToolbar 事件");
    }
    return api;
  }

  private getLocale(): string {
    try {
      return (Zotero?.locale as string) || navigator.language || "en-US";
    } catch {
      return "en-US";
    }
  }

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

  public dispose(): void {
    this.disposables.dispose();
  }
}
