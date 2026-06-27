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

export interface Disposable {
  dispose(): void;
}

/** Create a Disposable from a cleanup function. Idempotent. */
export function disposeFn(fn: () => void): Disposable {
  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      fn();
    },
  };
}

/** Manage multiple disposables. Disposes in LIFO order. */
export class CompositeDisposable implements Disposable {
  private disposed = false;
  private readonly items: Disposable[] = [];

  public add<T extends Disposable>(d: T): T {
    if (this.disposed) {
      d.dispose();
      return d;
    }
    this.items.push(d);
    return d;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (let i = this.items.length - 1; i >= 0; i--) {
      try { this.items[i].dispose(); } catch { /* best-effort */ }
    }
    this.items.length = 0;
  }
}
