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
import { createLogger } from "../utils/Logger";

// --- Types (previously ReaderTypes.ts) ---

export type ReaderEventType = "renderToolbar";

export interface ZoteroReaderInstance {
  _iframeWindow?: Window;
}

export interface RenderToolbarEvent {
  reader: ZoteroReaderInstance;
  doc: Document;
  append: (el: HTMLElement) => void;
}

export type ReaderEventHandler = (event: RenderToolbarEvent) => void;

export interface ZoteroReaderAPI {
  registerEventListener: (
    type: ReaderEventType,
    handler: ReaderEventHandler,
    pluginID: string,
  ) => void;
  unregisterEventListener?: (
    type: ReaderEventType,
    handler: ReaderEventHandler,
    pluginID: string,
  ) => void;
}

/** Safe access to Reader iframe window with retry/wait for document readiness. */
export class ReaderAdapter {
  private readonly log = createLogger("ReaderAdapter");

  // ponytail: options were never customized by callers; hardcoded.
  private readonly maxAttempts = 20;
  private readonly retryIntervalMs = 50;
  private readonly timeoutMs = 2500;

  public tryGetIframeWindow(reader: ZoteroReaderInstance): Window | null {
    try {
      const win = reader._iframeWindow;
      return win && typeof win === "object" ? win : null;
    } catch {
      return null;
    }
  }

  public tryGetHTMLDocument(reader: ZoteroReaderInstance): Document | null {
    const win = this.tryGetIframeWindow(reader);
    if (!win) return null;
    try {
      const doc = win.document;
      if (!doc || !isHTMLDocument(doc)) return null;
      return doc;
    } catch {
      return null;
    }
  }

  /**
   * Wait for Reader iframe HTML document to be ready.
   * Strategy: fast path → event listeners (load/DOMContentLoaded) → polling fallback → timeout.
   */
  public async waitForHTMLDocument(
    reader: ZoteroReaderInstance,
  ): Promise<Document | null> {
    const startedAt = Date.now();

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
        try {
          const win = this.tryGetIframeWindow(reader);
          win?.removeEventListener("load", onMaybeReady);
          win?.document?.removeEventListener("DOMContentLoaded", onMaybeReady);
        } catch {
          /* best-effort */
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
        if (doc) finish(doc);
      };

      timeoutId = setTimeout(() => {
        this.log.warn(`等待 Reader 文档超时（${Date.now() - startedAt}ms）`);
        finish(null);
      }, this.timeoutMs) as unknown as number;

      try {
        const win = this.tryGetIframeWindow(reader);
        if (win) {
          win.addEventListener("load", onMaybeReady);
          win.document?.addEventListener("DOMContentLoaded", onMaybeReady);
        }
      } catch {
        /* ignore */
      }

      timerId = setInterval(() => {
        attempts += 1;
        const doc = this.tryGetHTMLDocument(reader);
        if (doc) {
          finish(doc);
          return;
        }
        if (attempts >= this.maxAttempts) {
          this.log.warn(
            `Reader 文档获取失败（${attempts} attempts, ${Date.now() - startedAt}ms）`,
          );
          finish(null);
        }
      }, this.retryIntervalMs) as unknown as number;
    });
  }
}
