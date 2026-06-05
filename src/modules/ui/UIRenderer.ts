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
  FunctionDisposable,
  type Disposable,
} from "../utils/Disposable";
import { Logger } from "../utils/Logger";

/**
 * 主题菜单项数据结构。
 *
 * 为什么单独定义：
 * - UIRenderer 只负责“如何展示”，不应该硬编码主题列表与颜色值；
 * - 上层（ReaderController）可以根据内置预设/用户扩展，在不改 UI 代码的情况下扩展主题。
 */
export interface ThemeMenuItem {
  /** 主题 key（业务标识） */
  key: ThemeKey;
  /** 主题显示文本（已本地化/可读） */
  label: string;
  /** 用于预览的小圆点背景色（通常对应 ts-bg） */
  swatchBg: string;
  /** 用于预览的小圆点前景色（通常对应 ts-fg） */
  swatchFg: string;
  /** 用于预览边框色（可选） */
  swatchBorder?: string;
}

/**
 * 工具栏按钮的点击行为。
 */
export type ToolbarClickBehavior = "menu" | "cycle";

/**
 * UIRenderer 的渲染输入。
 */
export interface UIRenderOptions {
  /** Zotero 提供的工具栏 document（不是 Reader iframe 内 document） */
  doc: Document;

  /** Zotero 提供的挂载函数 */
  append: (el: HTMLElement) => void;

  /** 工具栏按钮 tooltip 文案（已本地化） */
  tooltip: string;

  /** 点击行为（打开菜单或循环主题） */
  clickBehavior: ToolbarClickBehavior;

  /** 当前主题（用于在 UI 上标记/用于 cycle 逻辑） */
  currentTheme: ThemeKey;

  /** 可选主题列表（用于菜单渲染与 cycle 逻辑） */
  themes: ThemeMenuItem[];

  /** 当用户选择某个主题时触发 */
  onPickTheme: (key: ThemeKey) => void;

  /** 当用户执行“循环切换”时触发（由控制层决定下一个主题） */
  onCycleTheme: () => void;
}

/**
 * 一次渲染产出的 UI 句柄。
 *
 * 为什么需要句柄：
 * - 工具栏按钮与菜单会注册事件监听器；
 * - 需要提供显式 `dispose()` 以满足“可证明清理”的审计/软著要求。
 */
export interface UIHandle extends Disposable {
  /** 工具栏按钮元素 */
  button: HTMLButtonElement;
}

/**
 * UI 渲染器：负责在 Reader 工具栏渲染按钮与弹出菜单。
 *
 * 设计边界（重要）：
 * - 本模块不直接读写 Pref、不直接注入 Reader iframe 样式；
 * - 主题列表/本地化文案由控制层提供；
 * - UI 只通过回调把“用户意图”回传给控制层。
 */
export class UIRenderer {
  private readonly log = Logger.create("UIRenderer");

  /** 工具栏按钮固定 id，用于防重（幂等渲染） */
  private static readonly BUTTON_ID = "theme-switcher-button";

  /**
   * 兼容 `CSSStyleDeclaration.colorScheme` 的最小类型扩展。
   *
   * 为什么需要：
   * - TS 的 DOM lib 在不同版本中对 `colorScheme` 的声明不一致；
   * - 这里用“可选字段”扩展，避免引入 `any`。
   */
  private static setColorScheme(
    style: CSSStyleDeclaration,
    value: string,
  ): void {
    (style as CSSStyleDeclaration & { colorScheme?: string }).colorScheme =
      value;
  }

  /**
   * 渲染工具栏按钮，并绑定菜单交互。
   *
   * 幂等性说明：
   * - 如果当前 doc 已存在同 id 的按钮，则不会重复创建按钮；
   * - 但仍会返回一个 handle（其 dispose 为 no-op），以简化调用方逻辑。
   *
   * @param options 渲染输入
   */
  public render(options: UIRenderOptions): UIHandle {
    const { doc, append } = options;

    const existing = doc.getElementById(UIRenderer.BUTTON_ID);
    if (existing && existing instanceof HTMLButtonElement) {
      // 说明：按钮已存在时，通常意味着 Zotero 重复触发 renderToolbar。
      // 为了避免重复绑定监听导致内存泄漏，这里直接复用已存在按钮。
      return {
        button: existing,
        dispose: () => {
          // no-op：本次没有注册任何资源
        },
      };
    }

    const disposables = new CompositeDisposable();

    const btn = doc.createElement("button");
    btn.id = UIRenderer.BUTTON_ID;
    btn.setAttribute("title", options.tooltip);
    btn.setAttribute("aria-label", options.tooltip);

    // 使用内联 SVG，颜色继承 currentColor，可随 Zotero 主题自适配
    btn.innerHTML = `
<span style="display:inline-flex;align-items:center;justify-content:center;">
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M11.5 13.5h5v-2h-5zM11 15q-.425 0-.712-.288T10 14v-3q0-.425.288-.712T11 10h6q.425 0 .713.288T18 11v3q0 .425-.288.713T17 15zm-7 5q-.825 0-1.412-.587T2 18V6q0-.825.588-1.412T4 4h16q.825 0 1.413.588T22 6v12q0 .825-.587 1.413T20 20zm0-2h16V8H4z"/>
  </svg>
</span>`;

    // 尽量继承 Zotero 样式
    btn.style.background = "transparent";
    btn.style.border = "none";
    btn.style.padding = "0 4px";
    btn.style.cursor = "pointer";
    UIRenderer.setColorScheme(btn.style, "light dark");

    append(btn);

    let menuEl: HTMLDivElement | null = null;
    let docClickTimer: ReturnType<typeof setTimeout> | null = null;

    const hideMenu = () => {
      if (docClickTimer) {
        try {
          clearTimeout(docClickTimer);
        } catch {
          // ignore
        }
        docClickTimer = null;
      }

      // best-effort：若监听已经绑定但尚未触发，尽力移除
      try {
        doc.removeEventListener("mousedown", onDocClick);
      } catch {
        // ignore
      }

      if (!menuEl) return;
      try {
        menuEl.remove();
      } catch {
        // ignore
      }
      menuEl = null;
    };

    // 通过 Disposable 统一确保菜单被移除，避免“菜单残留”
    disposables.add(new FunctionDisposable(() => hideMenu()));

    const onDocClick = (e: MouseEvent) => {
      if (!menuEl) return;
      // composedPath 能处理 Shadow DOM 等复杂场景；缺失则退化为简单逻辑
      const path = (e.composedPath?.() as unknown[]) ?? [];
      if (!path.includes(menuEl) && !path.includes(btn)) {
        hideMenu();
      }
    };

    const showMenu = () => {
      // 再次打开前先确保不存在旧菜单
      hideMenu();

      menuEl = this.buildMenu(doc, options.themes, (key) => {
        // 先收起菜单，再把用户意图回传给控制层
        hideMenu();
        options.onPickTheme(key);
      });
      this.positionMenuUnderButton(btn, menuEl);
      doc.body.appendChild(menuEl);

      // 绑定“一次性”的外部点击关闭。这样可以避免长期持有 doc 引用。
      // 注意：这里不能用 { once: true } + 立即绑定，因为某些情况下菜单刚插入就会捕获到同一次 click。
      // 通过 setTimeout 让事件在下一轮宏任务注册。
      docClickTimer = setTimeout(() => {
        try {
          doc.addEventListener("mousedown", onDocClick, { once: true });
        } catch (e) {
          this.log.warn(
            `绑定菜单关闭监听失败: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }, 0);
    };

    const onButtonClick = () => {
      if (options.clickBehavior === "cycle") {
        options.onCycleTheme();
        return;
      }

      if (menuEl && menuEl.isConnected) {
        hideMenu();
      } else {
        showMenu();
      }
    };

    btn.addEventListener("click", onButtonClick);
    disposables.add(
      new FunctionDisposable(() => {
        try {
          btn.removeEventListener("click", onButtonClick);
        } catch {
          // ignore
        }
      }),
    );

    return {
      button: btn,
      dispose: () => {
        hideMenu();
        disposables.dispose();
      },
    };
  }

  /**
   * 构建主题菜单。
   *
   * @param doc 工具栏所在 document
   * @param themes 主题列表
   * @param onPick 点击某个主题时的回调
   */
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
    UIRenderer.setColorScheme(menu.style, "light dark");

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

  /**
   * 将菜单定位到按钮下方。
   *
   * 为什么使用 fixed：
   * - Reader 工具栏可能在不同容器内，使用 `position: fixed` 可以避免受父级定位上下文影响；
   * - 同时能确保滚动时菜单位置符合用户预期。
   */
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
