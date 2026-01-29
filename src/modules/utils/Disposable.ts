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

/**
 * 可释放资源（Disposable）接口。
 *
 * 设计动机：
 * - Zotero 插件运行在长期驻留的宿主进程中，如果不显式释放事件监听器、Observer、定时器等资源，
 *   即使逻辑上“功能已经不再使用”，闭包与 DOM 引用仍可能被保留，从而形成内存泄漏。
 * - 在软著审查场景下，提供统一的资源管理抽象也能体现工程化与复杂度。
 */
export interface Disposable {
  /**
   * 释放资源。
   *
   * 约束：
   * - `dispose()` 必须是幂等的：重复调用不应抛异常、不应造成二次释放错误。
   * - `dispose()` 不返回值，调用方应假设释放行为已尽力完成。
   */
  dispose(): void;
}

/**
 * 一个什么都不做的 Disposable。
 *
 * 用途：
 * - 当某个分支不需要注册任何资源时，可以返回它来简化调用方代码（避免 `null`/`undefined` 判断）。
 */
export class NoopDisposable implements Disposable {
  public dispose(): void {
    // intentionally empty
  }
}

/**
 * 用函数实现的 Disposable。
 *
 * 为什么需要：
 * - 很多 Zotero/DOM API 的反注册方式天然就是“回调函数”（例如 `removeEventListener`、`clearTimeout`），
 *   用 `FunctionDisposable` 可以把这些释放动作统一封装为 `Disposable`。
 */
export class FunctionDisposable implements Disposable {
  private disposed = false;
  private readonly fn: () => void;

  /**
   * @param fn 释放时要执行的函数。建议捕获最少的外部变量，避免意外延长对象生命周期。
   */
  public constructor(fn: () => void) {
    this.fn = fn;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.fn();
  }
}

/**
 * 用于集中管理多个 Disposable 的组合容器。
 *
 * 为什么要做组合管理：
 * - 插件的一个功能模块往往会注册多种资源（Observer、Reader 事件、DOM 监听、计时器等）。
 * - 如果释放逻辑分散在各处，不仅容易漏掉，还不利于代码审计。
 * - 组合容器使得“创建-登记-统一释放”的生命周期清晰可见。
 */
export class CompositeDisposable implements Disposable {
  private disposed = false;
  private readonly disposables: Disposable[] = [];

  /**
   * 添加一个需要被统一释放的资源。
   *
   * 输入输出说明：
   * - 输入：任意实现了 `Disposable` 的对象。
   * - 输出：返回同一个对象，方便链式写法（例如 `return this.add(x)`）。
   *
   * 行为约束：
   * - 如果当前容器已经处于 disposed 状态，则会立即调用传入对象的 `dispose()`，
   *   以保证调用方不会因为时序问题而泄漏。
   */
  public add<T extends Disposable>(d: T): T {
    if (this.disposed) {
      d.dispose();
      return d;
    }
    this.disposables.push(d);
    return d;
  }

  /**
   * 释放所有已登记资源。
   *
   * 释放顺序说明：
   * - 采用“后进先出”（LIFO）顺序释放更符合实际：
   *   后注册的资源通常依赖先注册的资源（例如先创建菜单，再注册 document 点击关闭菜单的监听）。
   */
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    for (let i = this.disposables.length - 1; i >= 0; i -= 1) {
      try {
        this.disposables[i].dispose();
      } catch {
        // 释放阶段应尽量“best-effort”，避免因为个别释放失败导致其他资源未释放
      }
    }

    this.disposables.length = 0;
  }
}

/**
 * 工具函数：把“释放函数”包装为 `Disposable`。
 *
 * @param fn 释放时执行的函数
 * @returns `Disposable` 实例
 */
export function toDisposable(fn: () => void): Disposable {
  return new FunctionDisposable(fn);
}
