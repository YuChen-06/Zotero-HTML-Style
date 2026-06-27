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

import type { ThemeKey } from "../../themes";
import {
  CompositeDisposable,
  disposeFn,
  type Disposable,
} from "../utils/Disposable";
import { createLogger } from "../utils/Logger";

export interface ThemeMenuItem {
  key: ThemeKey;
  label: string;
  swatchBg: string;
  swatchFg: string;
  swatchBorder?: string;
}

interface UIRenderOptions {
  doc: Document;
  append: (el: HTMLElement) => void;
  tooltip: string;
  clickBehavior: "menu" | "cycle";
  currentTheme: ThemeKey;
  themes: ThemeMenuItem[];
  onPickTheme: (key: ThemeKey) => void;
  onCycleTheme: () => void;
}

/** Renders toolbar button + theme menu. Idempotent per document. */
export class UIRenderer {
  private readonly log = createLogger("UIRenderer");
  private static readonly BUTTON_ID = "theme-switcher-button";

  public render(options: UIRenderOptions): Disposable {
    const { doc, append } = options;

    const existing = doc.getElementById(UIRenderer.BUTTON_ID);
    if (existing && existing instanceof HTMLButtonElement) {
      return { dispose() {} };
    }

    const disposables = new CompositeDisposable();

    const btn = doc.createElement("button");
    btn.id = UIRenderer.BUTTON_ID;
    btn.setAttribute("title", options.tooltip);
    btn.setAttribute("aria-label", options.tooltip);
    btn.innerHTML = `<span style="display:inline-flex;align-items:center;justify-content:center;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11.5 13.5h5v-2h-5zM11 15q-.425 0-.712-.288T10 14v-3q0-.425.288-.712T11 10h6q.425 0 .713.288T18 11v3q0 .425-.288.713T17 15zm-7 5q-.825 0-1.412-.587T2 18V6q0-.825.588-1.412T4 4h16q.825 0 1.413.588T22 6v12q0 .825-.587 1.413T20 20zm0-2h16V8H4z"/></svg></span>`;
    btn.style.background = "transparent";
    btn.style.border = "none";
    btn.style.padding = "0 4px";
    btn.style.cursor = "pointer";
    (btn.style as any).colorScheme = "light dark";
    append(btn);

    let menuEl: HTMLDivElement | null = null;
    let docClickTimer: ReturnType<typeof setTimeout> | null = null;

    const hideMenu = () => {
      if (docClickTimer) {
        clearTimeout(docClickTimer);
        docClickTimer = null;
      }
      try {
        doc.removeEventListener("mousedown", onDocClick);
      } catch {
        /* best-effort */
      }
      if (menuEl) {
        try {
          menuEl.remove();
        } catch {
          /* best-effort */
        }
        menuEl = null;
      }
    };

    disposables.add(disposeFn(() => hideMenu()));

    const onDocClick = (e: MouseEvent) => {
      if (!menuEl) return;
      const path = (e.composedPath?.() as unknown[]) ?? [];
      if (!path.includes(menuEl) && !path.includes(btn)) hideMenu();
    };

    const showMenu = () => {
      hideMenu();
      menuEl = this.buildMenu(doc, options.themes, (key) => {
        hideMenu();
        options.onPickTheme(key);
      });
      this.positionMenuUnderButton(btn, menuEl);
      doc.body.appendChild(menuEl);
      docClickTimer = setTimeout(() => {
        try {
          doc.addEventListener("mousedown", onDocClick, { once: true });
        } catch {
          /* best-effort */
        }
      }, 0);
    };

    const onButtonClick = () => {
      if (options.clickBehavior === "cycle") {
        options.onCycleTheme();
        return;
      }
      if (menuEl?.isConnected) hideMenu();
      else showMenu();
    };

    btn.addEventListener("click", onButtonClick);
    disposables.add(
      disposeFn(() => {
        try {
          btn.removeEventListener("click", onButtonClick);
        } catch {
          /* best-effort */
        }
      }),
    );

    return {
      dispose: () => {
        hideMenu();
        disposables.dispose();
      },
    };
  }

  private buildMenu(
    doc: Document,
    themes: ThemeMenuItem[],
    onPick: (key: ThemeKey) => void,
  ): HTMLDivElement {
    const menu = doc.createElement("div");
    menu.setAttribute("role", "menu");
    Object.assign(menu.style, {
      background: "Canvas",
      color: "CanvasText",
      border: "1px solid ButtonBorder",
      borderRadius: "6px",
      boxShadow: "0 4px 16px rgba(0,0,0,.15)",
      padding: "6px 0",
      minWidth: "180px",
      fontSize: "12.5px",
    } as Partial<CSSStyleDeclaration>);
    (menu.style as any).colorScheme = "light dark";

    for (const theme of themes) {
      const item = doc.createElement("div");
      item.setAttribute("role", "menuitem");
      Object.assign(item.style, {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 10px",
        cursor: "pointer",
      } as Partial<CSSStyleDeclaration>);

      const dot = doc.createElement("span");
      Object.assign(dot.style, {
        position: "relative",
        width: "16px",
        height: "16px",
        borderRadius: "50%",
        background: theme.swatchBg,
        border: `1px solid ${theme.swatchBorder || "ButtonBorder"}`,
        display: "inline-block",
        boxSizing: "border-box",
      } as Partial<CSSStyleDeclaration>);

      const fg = doc.createElement("span");
      Object.assign(fg.style, {
        position: "absolute",
        right: "-2px",
        bottom: "-2px",
        width: "9px",
        height: "9px",
        borderRadius: "50%",
        background: theme.swatchFg,
        border: "1px solid rgba(0,0,0,.2)",
      } as Partial<CSSStyleDeclaration>);
      dot.appendChild(fg);

      const label = doc.createElement("span");
      label.textContent = theme.label;
      item.appendChild(dot);
      item.appendChild(label);

      item.addEventListener("mouseenter", () => {
        item.style.background = "Highlight";
        item.style.color = "HighlightText";
      });
      item.addEventListener("mouseleave", () => {
        item.style.background = "transparent";
        item.style.color = "inherit";
      });
      item.addEventListener("click", () => onPick(theme.key));
      menu.appendChild(item);
    }
    return menu;
  }

  private positionMenuUnderButton(
    btn: HTMLElement,
    menu: HTMLDivElement,
  ): void {
    const rect = btn.getBoundingClientRect();
    Object.assign(menu.style, {
      position: "fixed",
      top: `${Math.round(rect.bottom + 4)}px`,
      left: `${Math.round(rect.left)}px`,
      zIndex: "99999",
    } as Partial<CSSStyleDeclaration>);
  }
}
