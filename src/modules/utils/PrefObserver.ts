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

import { FunctionDisposable, type Disposable } from "./Disposable";
import { Logger } from "./Logger";

/**
 * 偏好变更回调。
 *
 * @param fullPrefKey 发生变更的偏好 key（完整 key，例如 `extensions.zotero.theme-switcher.defaultTheme`）
 */
export type PrefChangeListener = (fullPrefKey: string) => void;

/**
 * 用于监听 Zotero 偏好项变化的适配器。
 *
 * 关键设计点（为什么不直接在业务代码里调用 Zotero API）：
 * - Zotero/Firefox 的 Pref Observer 机制在不同版本、不同运行环境（sandbox vs. chrome）里可能存在差异。
 * - 业务代码（ConfigManager / ReaderController）只关心“某个前缀下的偏好变更事件”，
 *   不应被底层实现细节污染。
 * - 这里通过运行时探测（feature detection）选择可用的监听方式，并统一返回 `Disposable` 用于释放。
 */
export class PrefObserver {
  private readonly log = Logger.create("PrefObserver");

  /**
   * 监听某个前缀下的偏好变化。
   *
   * 输入输出说明：
   * - 输入：
   *   - `prefix`：偏好前缀，例如 `extensions.zotero.theme-switcher.`（注意通常以 `.` 结尾）。
   *   - `listener`：变化回调。
   * - 输出：`Disposable`，用于在插件 shutdown 或模块 dispose 时反注册 observer。
   *
   * 兼容性说明：
   * - 首选使用 Zotero 提供的高级 API（如果存在）。
   * - 如果不存在，则退化到 Firefox/XPCOM 的 `Services.prefs.addObserver`。
   */
  public observePrefix(prefix: string, listener: PrefChangeListener): Disposable {
    const z = Zotero as unknown as {
      Prefs?: {
        registerObserver?: (
          prefBranchOrPrefix: string,
          callback: (fullKey: string) => void,
          global?: boolean,
        ) => unknown;
        unregisterObserver?: (
          prefBranchOrPrefix: string,
          callback: (fullKey: string) => void,
          global?: boolean,
        ) => unknown;
      };
    };

    const register = z?.Prefs?.registerObserver;
    const unregister = z?.Prefs?.unregisterObserver;

    if (typeof register === "function") {
      this.log.debug(
        `使用 Zotero.Prefs.registerObserver 监听前缀: ${prefix}`,
      );
      register(prefix, listener, true);

      // 如果 Zotero 提供 unregisterObserver，则优先用它；否则以 best-effort 方式释放
      if (typeof unregister === "function") {
        return new FunctionDisposable(() => {
          try {
            unregister(prefix, listener, true);
          } catch {
            // best-effort
          }
        });
      }

      return new FunctionDisposable(() => {
        // 某些实现可能没有提供反注册 API，这里只能做到“模块级别不再引用 listener”
        // 实际上依然依赖 Zotero 在插件卸载时的清理机制。
      });
    }

    // ---------- 退化实现：Services.prefs ----------
    // 注意：该对象在 typings 中未必有完善声明，因此这里使用最小必要类型描述。
    type nsIObserver = {
      observe: (
        subject: unknown,
        topic: string,
        data: string | null,
      ) => void;
    };

    type PrefService = {
      addObserver: (domain: string, observer: nsIObserver, holdWeak: boolean) => void;
      removeObserver: (domain: string, observer: nsIObserver) => void;
    };

    const maybeServices = (globalThis as unknown as { Services?: { prefs?: PrefService } }).Services;
    const prefs = maybeServices?.prefs;

    if (!prefs || typeof prefs.addObserver !== "function") {
      this.log.warn(
        `无法找到可用的 Pref Observer API（prefix: ${prefix}），将禁用实时热更新。`,
      );
      return new FunctionDisposable(() => {
        // no-op
      });
    }

    this.log.debug(`使用 Services.prefs.addObserver 监听前缀: ${prefix}`);

    const observer: nsIObserver = {
      observe: (_subject, topic, data) => {
        // 在 Firefox Pref Observer 中：topic 通常是 "nsPref:changed"，data 是发生变化的完整 pref key
        if (topic !== "nsPref:changed") return;
        if (typeof data !== "string") return;
        if (!data.startsWith(prefix)) return;
        listener(data);
      },
    };

    prefs.addObserver(prefix, observer, false);

    return new FunctionDisposable(() => {
      try {
        prefs.removeObserver(prefix, observer);
      } catch {
        // best-effort
      }
    });
  }
}
