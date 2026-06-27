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
import { safeParseJSON, normalizeToStringMap } from "../utils/JsonUtils";
import { CompositeDisposable, type Disposable } from "../utils/Disposable";
import { createLogger } from "../utils/Logger";
import { observePrefPrefix } from "../utils/PrefObserver";
import type { ThemeKey } from "../../themes";

// --- Types (previously ConfigTypes.ts) ---

export type PluginPrefsMap = _ZoteroTypes.Prefs["PluginPrefsMap"];
export type PluginPrefKey = keyof PluginPrefsMap;
export type ClickBehavior = "menu" | "cycle";
export type CustomCSSVariables = Record<string, string>;

export interface ThemeSwitcherSettings {
  defaultTheme: ThemeKey;
  clickBehavior: ClickBehavior;
  showToolbar: boolean;
  customVariables: CustomCSSVariables;
}

export interface ConfigChangeEvent {
  changedKeys: PluginPrefKey[];
  settings: ThemeSwitcherSettings;
  source: "init" | "prefs";
}

/** Reads/writes plugin prefs, broadcasts config changes to ReaderController. */
export class ConfigManager implements Disposable {
  private readonly log = createLogger("ConfigManager");
  private readonly disposables = new CompositeDisposable();

  // ponytail: single consumer (ReaderController), no need for Set-based pub/sub
  public onChange: ((ev: ConfigChangeEvent) => void) | null = null;

  // Batch pref changes within a microtask to avoid redundant hot-refreshes
  private pendingChangedKeys = new Set<PluginPrefKey>();
  private flushScheduled = false;

  private readonly prefsPrefix: string = pkg.config.prefsPrefix;

  private fullKey<K extends PluginPrefKey>(key: K): string {
    return `${this.prefsPrefix}.${String(key)}`;
  }

  /** Set defaults for prefs that don't exist yet (first install). */
  public initDefaults(): void {
    const currentDefaultTheme = this.getPref("defaultTheme");
    if (!currentDefaultTheme) {
      this.setPref("defaultTheme", "light" as ThemeKey);
    }

    const currentJSON = this.getPref("customVariablesJSON");
    if (!currentJSON) {
      this.setPref("customVariablesJSON", "{}");
    }

    const cb = this.getPref("clickBehavior");
    if (cb === undefined || cb === null || cb === "") {
      this.setPref("clickBehavior", "menu");
    }

    const st = this.getPref("showToolbar");
    if (st === undefined) {
      this.setPref("showToolbar", true);
    }
  }

  /** Start listening for pref changes. Call once after Zotero init. */
  public startObserve(): void {
    const prefix = `${this.prefsPrefix}.`;

    const d = observePrefPrefix(prefix, (fullPrefKey) => {
      const short = this.toShortKey(fullPrefKey);
      if (!short) return;
      this.enqueueChange(short, "prefs");
    });

    this.disposables.add(d);

    // 启动时广播一次 init 事件，便于上层立即渲染 UI/注入样式
    this.emit({
      changedKeys: [
        "defaultTheme",
        "customVariablesJSON",
        "clickBehavior",
        "showToolbar",
      ],
      settings: this.getSettings(),
      source: "init",
    });
  }

  private toShortKey(fullPrefKey: string): PluginPrefKey | null {
    const prefix = `${this.prefsPrefix}.`;
    if (!fullPrefKey.startsWith(prefix)) return null;
    const maybeKey = fullPrefKey.slice(prefix.length) as string;

    // 仅接受我们已声明的键名，避免监听到其他插件/系统 Pref 造成误触发
    const keys: PluginPrefKey[] = [
      "defaultTheme",
      "customVariablesJSON",
      "clickBehavior",
      "showToolbar",
    ];
    if (keys.includes(maybeKey as PluginPrefKey)) {
      return maybeKey as PluginPrefKey;
    }
    return null;
  }

  private enqueueChange(
    key: PluginPrefKey,
    source: ConfigChangeEvent["source"],
  ): void {
    this.pendingChangedKeys.add(key);

    if (this.flushScheduled) return;
    this.flushScheduled = true;

    queueMicrotask(() => {
      this.flushScheduled = false;
      const changedKeys = Array.from(this.pendingChangedKeys);
      this.pendingChangedKeys.clear();

      const settings = this.getSettings();
      this.emit({ changedKeys, settings, source });
    });
  }

  /** Returns a complete settings snapshot. customVariables is always parsed+validated. */
  public getSettings(): ThemeSwitcherSettings {
    const defaultTheme = (this.getPref("defaultTheme") || "light") as ThemeKey;

    const clickBehaviorRaw = (this.getPref("clickBehavior") ||
      "menu") as string;
    const clickBehavior: ClickBehavior =
      clickBehaviorRaw === "cycle" ? "cycle" : "menu";

    const showToolbar = this.getPref("showToolbar") !== false;

    const jsonRaw = (this.getPref("customVariablesJSON") || "{}") as string;
    const customVariables = this.parseCustomVariables(jsonRaw).vars;

    return {
      defaultTheme,
      clickBehavior,
      showToolbar,
      customVariables,
    };
  }

  public parseCustomVariables(raw: string): {
    vars: CustomCSSVariables;
    errors: string[];
  } {
    const parsed = safeParseJSON<unknown>(raw, {});
    if (!parsed.ok) {
      return {
        vars: {},
        errors: [
          `JSON 解析失败：${parsed.errorMessage || "未知错误"}`,
          "请确认输入是合法 JSON 且顶层为对象。",
        ],
      };
    }

    return normalizeToStringMap(parsed.value);
  }

  private emit(ev: ConfigChangeEvent): void {
    this.log.debug(
      `配置变更: ${ev.changedKeys.join(", ")} (source=${ev.source})`,
    );
    try {
      this.onChange?.(ev);
    } catch {
      // best-effort
    }
  }

  public getPref<K extends PluginPrefKey>(
    key: K,
  ): PluginPrefsMap[K] | undefined {
    const full = this.fullKey(key);
    const z = Zotero as unknown as {
      Prefs: {
        get: (pref: string, global?: boolean) => unknown;
      };
    };

    const v = z.Prefs.get(full, true) as unknown;
    return v as PluginPrefsMap[K] | undefined;
  }

  public setPref<K extends PluginPrefKey>(
    key: K,
    value: PluginPrefsMap[K],
  ): void {
    const full = this.fullKey(key);
    const z = Zotero as unknown as {
      Prefs: {
        set: (pref: string, value: unknown, global?: boolean) => void;
      };
    };

    z.Prefs.set(full, value as unknown, true);
  }

  public dispose(): void {
    this.disposables.dispose();
    this.onChange = null;
  }
}
