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

import { isHTMLDocument } from "../utils/DomGuards";
import { Logger } from "../utils/Logger";
import type { ZoteroReaderInstance } from "./ReaderTypes";

/**
 * ReaderAdapter 的行为参数。
 */
export interface ReaderAdapterOptions {
  /**
   * 重试次数。
   *
   * 为什么需要重试：
   * - `renderToolbar` 事件触发时，Reader iframe 的 document 未必已经完全就绪；
   * - 直接读取 `reader._iframeWindow.document` 可能得到 `null` 或非 HTML 文档；
   * - 通过小步重试 + 事件监听，可以显著降低“偶现失效”的兼容性问题。
   */
  maxAttempts: number;

  /**
   * 每次轮询重试的间隔（毫秒）。
   *
   * 说明：
   * - 这里不是为了高频轮询，而是作为事件监听失败时的兜底策略；
   * - 间隔应尽量小但不要为 0，避免阻塞主线程。
   */
  retryIntervalMs: number;

  /**
   * 整体等待超时时间（毫秒）。
   *
   * 为什么需要超时：
   * - 防止极端情况下 Reader 永远无法就绪，导致 Promise 永不 resolve、闭包长期存活；
   * - 超时后会尽力清理事件监听器，避免潜在内存泄漏。
   */
  timeoutMs: number;
}

/**
 * Reader 的兼容性适配层。
 *
 * 关键职责（对应你的“Zotero 7 兼容性核心要求”）：
 * - 安全地获取 `reader._iframeWindow`；
 * - 在 window/document 未就绪时进行容错与重试；
 * - 将“私有字段访问的不稳定性”集中在一个模块内，避免污染业务逻辑。
 */
export class ReaderAdapter {
  private readonly log = Logger.create("ReaderAdapter");
  private readonly options: ReaderAdapterOptions;

  public constructor(options?: Partial<ReaderAdapterOptions>) {
    this.options = {
      maxAttempts: options?.maxAttempts ?? 20,
      retryIntervalMs: options?.retryIntervalMs ?? 50,
      timeoutMs: options?.timeoutMs ?? 2500,
    };
  }

  /**
   * 尝试同步获取 Reader 的 iframe Window。
   *
   * 为什么提供同步方法：
   * - 有些调用点只需要“尽力而为”的立即结果；
   * - 同步方法不会注册任何事件监听器，因此不会引入额外资源管理复杂度。
   *
   * @param reader Reader 实例
   * @returns Window 或 `null`
   */
  public tryGetIframeWindow(reader: ZoteroReaderInstance): Window | null {
    try {
      const win = reader._iframeWindow;
      return win && typeof win === "object" ? win : null;
    } catch {
      return null;
    }
  }

  /**
   * 尝试同步获取 Reader iframe 的 HTML Document。
   *
   * @param reader Reader 实例
   * @returns HTML Document 或 `null`
   */
  public tryGetHTMLDocument(reader: ZoteroReaderInstance): Document | null {
    const win = this.tryGetIframeWindow(reader);
    if (!win) return null;

    try {
      const doc = win.document;
      if (!doc) return null;
      if (!isHTMLDocument(doc)) return null;
      return doc;
    } catch {
      return null;
    }
  }

  /**
   * 等待 Reader iframe 的 HTML Document 就绪。
   *
   * 核心策略（详细说明）：
   * 1) **动态获取策略**：每次尝试都重新读取 `reader._iframeWindow`，而不是缓存。
   *    - 原因：私有字段可能在 Reader 生命周期中被替换（例如重新加载/重建 iframe）。
   * 2) **事件优先**：如果能拿到 window/document，则优先监听 `DOMContentLoaded`/`load`。
   *    - 原因：事件驱动比轮询更节能，也更符合浏览器文档就绪模型。
   * 3) **轮询兜底**：如果事件无法触发（极端时序），以小间隔轮询重试。
   * 4) **超时终止 + 清理**：无论成功或失败，都尽力移除监听器/定时器，避免闭包泄漏。
   *
   * 输入输出说明：
   * - 输入：Reader 实例
   * - 输出：
   *   - resolve 为 `Document`：表示已拿到可注入的 HTML 文档；
   *   - resolve 为 `null`：表示在超时/重试耗尽后仍无法获取。
   *
   * @param reader Reader 实例
   */
  public async waitForHTMLDocument(reader: ZoteroReaderInstance): Promise<Document | null> {
    const startedAt = Date.now();

    // 先尝试一次快速路径
    const fast = this.tryGetHTMLDocument(reader);
    if (fast) return fast;

    let attempts = 0;

    return await new Promise<Document | null>((resolve) => {
      let settled = false;
      let timerId: number | null = null;
      let timeoutId: number | null = null;

      const cleanup = () => {
        if (timerId !== null) {
          clearInterval(timerId);
          timerId = null;
        }
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        // 移除可能注册的事件监听器（best-effort）
        try {
          const win = this.tryGetIframeWindow(reader);
          win?.removeEventListener("load", onMaybeReady);
          win?.document?.removeEventListener("DOMContentLoaded", onMaybeReady);
        } catch {
          // ignore
        }
      };

      const finish = (doc: Document | null) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(doc);
      };

      const onMaybeReady = () => {
        const doc = this.tryGetHTMLDocument(reader);
        if (doc) {
          finish(doc);
        }
      };

      // 设置总超时，避免 Promise 悬挂
      timeoutId = setTimeout(() => {
        const elapsed = Date.now() - startedAt;
        this.log.warn(`等待 Reader 文档超时（${elapsed}ms），将放弃本次注入。`);
        finish(null);
      }, this.options.timeoutMs) as unknown as number;

      // 如果可以拿到 window/document，则优先注册事件监听（once=false，便于触发多次就绪检查；最终 cleanup 会移除）
      try {
        const win = this.tryGetIframeWindow(reader);
        if (win) {
          win.addEventListener("load", onMaybeReady);
          win.document?.addEventListener("DOMContentLoaded", onMaybeReady);
        }
      } catch {
        // ignore
      }

      // 轮询兜底
      timerId = setInterval(() => {
        attempts += 1;
        const doc = this.tryGetHTMLDocument(reader);
        if (doc) {
          finish(doc);
          return;
        }

        if (attempts >= this.options.maxAttempts) {
          const elapsed = Date.now() - startedAt;
          this.log.warn(
            `多次尝试仍无法获取 Reader HTML 文档（attempts=${attempts}, ${elapsed}ms），将放弃本次注入。`,
          );
          finish(null);
        }
      }, this.options.retryIntervalMs) as unknown as number;
    });
  }
}
