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

import { Logger } from "../utils/Logger";
import type { ZoteroReaderInstance } from "./ReaderTypes";

/**
 * ReaderRegistry：用于跟踪“曾经出现过/仍可能存活”的 Reader 实例集合。
 *
 * 关键设计目标（对应你的审计要求）：
 * - **不能用强引用集合（如 Set<Reader>）**，否则会阻止已关闭 Reader 被 GC 回收，引发内存泄漏；
 * - 需要支持“尽力遍历”以实现热更新：配置变更时，尝试对仍存活的 Reader 重新应用样式。
 *
 * 实现策略说明（为什么同时使用 WeakMap + WeakRef Set）：
 * - `WeakSet/WeakMap` 本身不可遍历，因此无法直接用于“热更新遍历”。
 * - 解决方案：
 *   1) 使用 `WeakMap<Reader, WeakRef<Reader>>` 进行去重（弱键不阻止 GC）。
 *   2) 使用 `Set<WeakRef<Reader>>` 保存可遍历的弱引用包装对象。
 *      - 注意：Set 持有的是 WeakRef 对象本身（不是 Reader），不会阻止 Reader 被回收。
 *   3) 遍历时 `deref()`，若已回收则从 Set 中清理。
 *
 * 兼容性备注：
 * - Zotero 7 基于 Firefox ESR（较新的 SpiderMonkey）通常支持 WeakRef/FinalizationRegistry。
 * - 这里即便没有 FinalizationRegistry 也能工作（只是清理会延迟到下一次遍历）。
 */
export class ReaderRegistry {
  private readonly log = Logger.create("ReaderRegistry");

  private readonly dedupe = new WeakMap<ZoteroReaderInstance, WeakRef<ZoteroReaderInstance>>();
  private readonly refs = new Set<WeakRef<ZoteroReaderInstance>>();

  // 尽力使用 FinalizationRegistry，在 Reader 被回收时自动清理 WeakRef
  private readonly finalizer: FinalizationRegistry<WeakRef<ZoteroReaderInstance>> | null;

  public constructor() {
    this.finalizer =
      typeof FinalizationRegistry === "function"
        ? new FinalizationRegistry((ref) => {
            // 注意：finalizer 回调中不能做复杂操作，做最小清理即可
            this.refs.delete(ref);
          })
        : null;
  }

  /**
   * 登记一个 Reader 实例。
   *
   * @param reader Reader 实例
   */
  public register(reader: ZoteroReaderInstance): void {
    if (this.dedupe.has(reader)) return;

    const ref = new WeakRef(reader);
    this.dedupe.set(reader, ref);
    this.refs.add(ref);

    // 注册 finalizer：当 reader 被 GC 后，自动清理对应 WeakRef
    // token 直接使用 ref 对象本身，便于在回调中定位
    this.finalizer?.register(reader, ref);
  }

  /**
   * 遍历仍存活的 Reader。
   *
   * 输入输出说明：
   * - 输入：回调函数 `fn`。
   * - 输出：无。
   *
   * 行为说明：
   * - 本方法是 best-effort：遍历过程中如遇到异常会跳过，不影响其他 Reader。
   * - 会在遍历时清理已经失效的 WeakRef，避免集合无限增长。
   */
  public forEachAlive(fn: (reader: ZoteroReaderInstance) => void): void {
    for (const ref of Array.from(this.refs)) {
      const reader = ref.deref();
      if (!reader) {
        this.refs.delete(ref);
        continue;
      }

      try {
        fn(reader);
      } catch {
        // best-effort
      }
    }
  }

  /**
   * 估算当前集合中的弱引用数量。
   *
   * 注意：
   * - 这是“弱引用包装对象”的数量，不等价于存活 Reader 数量。
   * - 主要用于调试与日志观测。
   */
  public get weakRefCount(): number {
    return this.refs.size;
  }

  /**
   * 主动触发一次清理。
   *
   * 为什么需要：
   * - 即使有 FinalizationRegistry，回调触发时机也不确定；
   * - 在热更新/定时维护时主动清理可以减少集合膨胀。
   */
  public compact(): void {
    let removed = 0;
    for (const ref of Array.from(this.refs)) {
      if (!ref.deref()) {
        this.refs.delete(ref);
        removed += 1;
      }
    }

    if (removed > 0) {
      this.log.debug(`compact: removed=${removed}, weakRefCount=${this.refs.size}`);
    }
  }
}
