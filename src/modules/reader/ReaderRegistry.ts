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

import { createLogger } from "../utils/Logger";
import type { ZoteroReaderInstance } from "./ReaderAdapter";

/**
 * Tracks Reader instances using WeakRef for GC-friendly traversal.
 * Uses WeakMap for dedup + Set<WeakRef> for iteration.
 * compact() and forEachAlive prune dead refs on each traversal.
 */
export class ReaderRegistry {
  private readonly log = createLogger("ReaderRegistry");

  private readonly dedupe = new WeakMap<
    ZoteroReaderInstance,
    WeakRef<ZoteroReaderInstance>
  >();
  private readonly refs = new Set<WeakRef<ZoteroReaderInstance>>();

  public register(reader: ZoteroReaderInstance): void {
    if (this.dedupe.has(reader)) return;
    const ref = new WeakRef(reader);
    this.dedupe.set(reader, ref);
    this.refs.add(ref);
  }

  /** Iterate surviving readers. Prunes dead refs. Best-effort on errors. */
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
        /* best-effort */
      }
    }
  }

  /** Remove dead weak refs. Called before hot-refresh traversal. */
  public compact(): void {
    let removed = 0;
    for (const ref of Array.from(this.refs)) {
      if (!ref.deref()) {
        this.refs.delete(ref);
        removed++;
      }
    }
    if (removed > 0) {
      this.log.debug(`compact: removed=${removed}, refs=${this.refs.size}`);
    }
  }
}
