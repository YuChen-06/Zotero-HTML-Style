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
import type {
  ClickBehavior,
  ConfigChangeEvent,
  CustomCSSVariables,
  PluginPrefKey,
  PluginPrefsMap,
  ThemeSwitcherSettings,
} from "./ConfigTypes";
import { safeParseJSON, normalizeToStringMap } from "../utils/JsonUtils";
import {
  CompositeDisposable,
  FunctionDisposable,
  type Disposable,
} from "../utils/Disposable";
import { Logger } from "../utils/Logger";
import { PrefObserver } from "../utils/PrefObserver";
import type { ThemeKey } from "../../themes";

/**
 * 配置管理器。
 *
 * 核心职责：
 * 1) 初始化默认偏好项，保证插件首次安装即可工作；
 * 2) 将 Pref 值读取为“强类型 + 已校验”的配置快照；
 * 3) 监听 Pref 变更并广播给上层（ReaderController），实现已打开 Reader 的实时热更新；
 * 4) 提供 `dispose()`，在插件 shutdown 时释放 observer，避免内存泄漏。
 *
 * 为什么要单独做 ConfigManager：
 * - Zotero 插件常见的反模式是：业务逻辑到处 `Zotero.Prefs.get/set`，
 *   导致 pref key 字符串散落、默认值不一致、校验缺失。
 * - 将其集中化后，上层只消费结构化的 `ThemeSwitcherSettings`，从而形成清晰分层。
 */
export class ConfigManager implements Disposable {
  private readonly log = Logger.create("ConfigManager");
  private readonly disposables = new CompositeDisposable();
  private readonly prefObserver = new PrefObserver();

  /**
   * 配置变更监听器集合。
   *
   * 说明：
   * - 这里使用 Set 是为了避免重复订阅；
   * - 订阅方应在自身 dispose 时取消订阅，以避免闭包泄漏。
   */
  private readonly listeners = new Set<(ev: ConfigChangeEvent) => void>();

  /**
   * 用于合并同一轮（短时间）内的多次 Pref 变化。
   *
   * 为什么需要合并：
   * - 在 Zotero 偏好面板中，“一次保存”可能会触发多个 pref 写入；
   * - 如果每次写入都立即全量热刷新所有 Reader，会造成性能浪费与 UI 抖动。
   * - 采用 microtask 级别的合并可以在不引入复杂依赖的情况下解决问题。
   */
  private pendingChangedKeys = new Set<PluginPrefKey>();
  private flushScheduled = false;

  /**
   * 获取插件 pref 前缀（例如 `extensions.zotero.theme-switcher`）。
   */
  private readonly prefsPrefix: string = pkg.config.prefsPrefix;

  /**
   * 返回某个插件偏好项的完整 key。
   *
   * @param key 插件内部键名
   */
  private fullKey<K extends PluginPrefKey>(key: K): string {
    return `${this.prefsPrefix}.${String(key)}`;
  }

  /**
   * 初始化默认偏好项。
   *
   * 为什么必须做默认值：
   * - Zotero 插件的 Pref 在首次安装时可能完全不存在；
   * - 如果不初始化，业务侧可能读到 `undefined`，导致类型分支膨胀、或出现 UI 与逻辑不一致。
   */
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

  /**
   * 启动对 Pref 变化的监听。
   *
   * 重要：
   * - 该方法应在插件启动后调用一次。
   * - 返回的 `Disposable`/或调用 `dispose()` 必须在 `onShutdown()` 中执行，
   *   以防 observer 引用长期存在造成内存泄漏。
   */
  public startObserve(): void {
    const prefix = `${this.prefsPrefix}.`;

    const d = this.prefObserver.observePrefix(prefix, (fullPrefKey) => {
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

  /**
   * 将完整 pref key 转为插件内部键名。
   *
   * @param fullPrefKey 完整 key
   * @returns 插件内部键名（无法识别则返回 `null`）
   */
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

  /**
   * 将 Pref 变化加入待处理队列，并在微任务中批量 flush。
   */
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

  /**
   * 读取并生成当前配置快照。
   *
   * 输出保证：
   * - 永远返回完整结构（不会出现 `undefined`），便于上层逻辑保持纯粹；
   * - `customVariables` 一定是经过 JSON 解析与 key 校验后的结果。
   */
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

  /**
   * 解析并校验用户自定义 CSS 变量 JSON。
   *
   * @param raw JSON 字符串
   * @returns 规范化结果（含错误列表）
   */
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

  /**
   * 订阅配置变更。
   *
   * @param listener 监听器
   * @returns `Disposable`，用于取消订阅
   */
  public subscribe(listener: (ev: ConfigChangeEvent) => void): Disposable {
    this.listeners.add(listener);
    return new FunctionDisposable(() => {
      this.listeners.delete(listener);
    });
  }

  /**
   * 手动触发一次“配置已更新”事件。
   *
   * 典型用途：
   * - 当某些设置不是来自 Pref（未来可能来自 UI 临时状态）时，
   *   可以统一走 ConfigManager 的广播渠道。
   */
  public notifyManual(changedKeys: PluginPrefKey[]): void {
    this.emit({
      changedKeys,
      settings: this.getSettings(),
      source: "manual",
    });
  }

  /**
   * 向所有订阅者广播事件。
   */
  private emit(ev: ConfigChangeEvent): void {
    this.log.debug(
      `配置变更: ${ev.changedKeys.join(", ")} (source=${ev.source})`,
    );
    for (const listener of Array.from(this.listeners)) {
      try {
        listener(ev);
      } catch {
        // best-effort：单个监听器异常不应影响其他监听器
      }
    }
  }

  /**
   * 获取指定 pref 的值（强类型）。
   *
   * 为什么这里仍然需要类型断言：
   * - Zotero 的 Pref API 在 sandbox typings 中通常不完整；
   * - 本项目的 `global.d.ts` 将 `Zotero` 声明为 `any`，外部世界无法完全类型安全；
   * - 因此我们在模块边界处做一次断言，在模块内部保持严格类型。
   */
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

  /**
   * 写入指定 pref 的值（强类型）。
   */
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

  /**
   * 释放资源。
   *
   * 必须在 `hooks.onShutdown()` 调用，原因：
   * - Pref observer 会持有回调引用；
   * - 回调闭包可能间接引用 ConfigManager/Controller，从而阻止 GC，导致内存泄漏。
   */
  public dispose(): void {
    this.disposables.dispose();
    this.listeners.clear();
  }
}
