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

import { buildCSS, PRESETS, THEME_ORDER, type ThemeKey } from "../../themes";
import { isHTMLDocument } from "../utils/DomGuards";
import { createLogger } from "../utils/Logger";

// --- Types (previously StyleTypes.ts) ---

export type InjectScope = "documentOnly" | "documentAndSubFrames";

export interface StyleApplyOptions {
  theme: ThemeKey;
  customVariables: Record<string, string>;
  scope: InjectScope;
  maxFrameDepth: number;
}

/** Injects theme CSS into HTML documents. Idempotent per document. */
export class StyleInjector {
  private readonly log = createLogger("StyleInjector");

  private readonly styleElementId: string;
  private readonly defaultMaxFrameDepth: number;

  public constructor(options?: {
    styleElementId?: string;
    defaultMaxFrameDepth?: number;
  }) {
    this.styleElementId = options?.styleElementId ?? "theme-switcher-style";
    this.defaultMaxFrameDepth = options?.defaultMaxFrameDepth ?? 5;
  }

  /** Apply theme + CSS variables to a document tree (optionally recursing into iframes). */
  public applyToDocumentTree(
    rootDoc: Document,
    options: StyleApplyOptions,
  ): void {
    const visit = (doc: Document) => {
      if (!isHTMLDocument(doc)) return;
      this.ensureBaseStyleInjected(doc);
      this.applyCustomVariables(doc, options.customVariables);
      this.applyTheme(doc, options.theme);
    };

    try {
      visit(rootDoc);
    } catch (e) {
      this.log.warn(
        `根文档注入失败: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    if (options.scope === "documentAndSubFrames") {
      this.walkSubFrames(
        rootDoc,
        0,
        Math.max(0, options.maxFrameDepth),
        (doc) => {
          try {
            visit(doc);
          } catch {
            /* best-effort */
          }
        },
      );
    }
  }

  private ensureBaseStyleInjected(doc: Document): boolean {
    if (doc.getElementById(this.styleElementId)) return false;
    const style = doc.createElement("style");
    style.id = this.styleElementId;
    style.textContent = buildCSS(PRESETS);
    doc.documentElement?.appendChild(style);
    return true;
  }

  private applyCustomVariables(
    doc: Document,
    vars: Record<string, string>,
  ): void {
    const html = doc.documentElement as HTMLElement | null;
    if (!html) return;
    for (const [k, v] of Object.entries(vars)) {
      try {
        html.style.setProperty(`--${k}`, v);
      } catch {
        /* best-effort */
      }
    }
  }

  private applyTheme(doc: Document, theme: ThemeKey): void {
    const html = doc.documentElement as HTMLElement | null;
    if (!html) return;
    for (const t of THEME_ORDER) html.classList.remove(`theme-${t}`);
    html.classList.add(`theme-${theme}`);
  }

  /** Recursively visit accessible iframe documents. */
  private walkSubFrames(
    doc: Document,
    depth: number,
    maxDepth: number,
    fn: (doc: Document) => void,
  ): void {
    if (depth >= maxDepth) return;
    for (const iframe of Array.from(doc.querySelectorAll("iframe"))) {
      let childDoc: Document | null = null;
      try {
        childDoc =
          (iframe as HTMLIFrameElement).contentWindow?.document ?? null;
      } catch {
        /* cross-origin */
      }
      if (!childDoc || !isHTMLDocument(childDoc)) continue;
      fn(childDoc);
      this.walkSubFrames(childDoc, depth + 1, maxDepth, fn);
    }
  }
}
