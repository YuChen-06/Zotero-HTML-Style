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
import type { ThemeSwitcherSettings } from "../config/ConfigManager";

// --- Types (previously StyleTypes.ts) ---

export type InjectScope = "documentOnly" | "documentAndSubFrames";

export interface StyleApplyOptions {
  theme: ThemeKey;
  customVariables: Record<string, string>;
  scope: InjectScope;
  maxFrameDepth: number;
}

export interface StyleApplyResult {
  processedDocuments: number;
  injectedStyleDocuments: number;
  skippedDocuments: number;
}

export interface StyleInjectorOptions {
  styleElementId: string;
  defaultMaxFrameDepth: number;
}

/**
 * 样式注入器。
 *
 * 主要能力：
 * - 向 HTML 文档注入本插件的基础 CSS（通过 `<style>` 标签）；
 * - 写入用户自定义 CSS 变量（用于动态定制配色）；
 * - 给 `<html>` 节点应用互斥的主题 class，实现主题切换；
 * - 可选地对可访问的子 iframe 进行递归注入。
 *
 * 为什么要独立成一个模块：
 * - “注入样式”是纯 DOM 操作，应该与 Reader 事件、UI 交互解耦；
 * - 便于做幂等性审计：同一文档只注入一次，避免重复 style 标签导致的性能与维护问题；
 * - 热更新实现的关键：当 Pref 变化时，只要再次调用 `applyToDocumentTree` 即可刷新所有已打开页面。
 */
export class StyleInjector {
  private readonly log = createLogger("StyleInjector");

  private readonly options: StyleInjectorOptions;

  /**
   * @param options 注入器配置
   */
  public constructor(options?: Partial<StyleInjectorOptions>) {
    this.options = {
      styleElementId: options?.styleElementId ?? "theme-switcher-style",
      defaultMaxFrameDepth: options?.defaultMaxFrameDepth ?? 5,
    };
  }

  /**
   * 将 ConfigManager 的配置快照转换为 StyleApplyOptions。
   *
   * 为什么提供该方法：
   * - 上层（ReaderController）通常只关心业务配置，不想手动拼装注入参数；
   * - 这也是一种“模块边界协议”，让样式层能稳定演进而不影响控制层。
   *
   * @param settings 配置快照
   * @param theme 当前要应用的主题（可能与 defaultTheme 不同，例如用户临时切换）
   * @param scope 注入范围
   */
  public buildOptionsFromSettings(
    settings: ThemeSwitcherSettings,
    theme: ThemeKey,
    scope: InjectScope,
  ): StyleApplyOptions {
    return {
      theme,
      customVariables: settings.customVariables,
      scope,
      maxFrameDepth: this.options.defaultMaxFrameDepth,
    };
  }

  /**
   * 对一个文档（以及可选的子 iframe）注入并应用样式。
   *
   * 幂等性保证（关键）：
   * - `ensureBaseStyleInjected()` 会通过 `styleElementId` 检测是否已注入；
   * - 若已存在则不会重复创建 `<style>` 节点。
   *
   * @param rootDoc 根文档（通常是 Reader iframe 内的 document）
   * @param options 应用参数（主题、CSS 变量、递归范围等）
   * @returns 运行统计结果
   */
  public applyToDocumentTree(
    rootDoc: Document,
    options: StyleApplyOptions,
  ): StyleApplyResult {
    const result: StyleApplyResult = {
      processedDocuments: 0,
      injectedStyleDocuments: 0,
      skippedDocuments: 0,
    };

    const scope = options.scope;
    const maxDepth = Math.max(0, options.maxFrameDepth);

    const visit = (doc: Document) => {
      if (!isHTMLDocument(doc)) {
        result.skippedDocuments += 1;
        return;
      }

      result.processedDocuments += 1;

      const injected = this.ensureBaseStyleInjected(doc);
      if (injected) result.injectedStyleDocuments += 1;

      this.applyCustomVariables(doc, options.customVariables);
      this.applyTheme(doc, options.theme);
    };

    // 先处理根文档
    try {
      visit(rootDoc);
    } catch (e) {
      this.log.warn(
        `根文档注入失败: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    // 决定是否递归处理子 iframe
    if (scope === "documentAndSubFrames") {
      this.walkSubFrames(rootDoc, 0, maxDepth, (doc) => {
        try {
          visit(doc);
        } catch {
          // best-effort
        }
      });
    }

    return result;
  }

  /**
   * 确保基础 CSS 已注入到目标文档。
   *
   * @param doc 目标文档
   * @returns `true` 表示本次新注入了 style；`false` 表示之前已注入或无法注入
   */
  private ensureBaseStyleInjected(doc: Document): boolean {
    const id = this.options.styleElementId;

    // 防重复注入：如果已存在同 id 的 style 节点，则直接跳过
    if (doc.getElementById(id)) return false;

    const style = doc.createElement("style");
    style.id = id;

    // 基础 CSS：来自内置主题预设
    // 说明：buildCSS 会生成 `html.theme-*` 的变量块 + 一份 base 样式
    style.textContent = buildCSS(PRESETS);

    // 注入到 documentElement 是最稳妥的位置：
    // - 可以避免 body 尚未创建时注入失败；
    // - 对于某些 HTML 结构更稳定。
    const target = doc.documentElement;
    if (!target) return false;

    target.appendChild(style);
    return true;
  }

  /**
   * 应用用户自定义 CSS 变量。
   *
   * 为什么写在 `<html>` 上：
   * - 变量在 `:root`/`html` 上的作用域覆盖整个文档；
   * - 即使 body 内部替换/重渲染，变量仍能保持。
   *
   * @param doc 目标文档
   * @param vars CSS 变量映射（不含 `--`）
   */
  private applyCustomVariables(
    doc: Document,
    vars: Record<string, string>,
  ): void {
    const html = doc.documentElement as HTMLElement | null;
    if (!html) return;

    for (const [k, v] of Object.entries(vars)) {
      try {
        html.style.setProperty(`--${k}`, String(v));
      } catch {
        // best-effort：单个变量写入失败不影响整体
      }
    }
  }

  /**
   * 给文档应用主题 class。
   *
   * 实现策略：
   * - 先移除所有已知主题 class（互斥）；
   * - 再添加目标主题 class。
   *
   * 这样做的原因：
   * - 多主题共存会导致 CSS 变量冲突；
   * - 明确互斥逻辑更利于审计与维护。
   *
   * @param doc 目标文档
   * @param theme 主题 key
   */
  private applyTheme(doc: Document, theme: ThemeKey): void {
    const html = doc.documentElement as HTMLElement | null;
    if (!html) return;

    for (const t of THEME_ORDER) {
      html.classList.remove(`theme-${t}`);
    }
    html.classList.add(`theme-${theme}`);
  }

  /**
   * 遍历子 iframe 文档并执行回调。
   *
   * 关键要求：递归注入。
   *
   * 为什么这里采用“递归 + 最大深度限制”：
   * - 子 iframe 可能进一步嵌套 iframe；
   * - 递归遍历可以保证注入覆盖完整页面；
   * - 最大深度限制可以避免极端页面造成性能问题或潜在死循环。
   *
   * @param doc 根文档
   * @param depth 当前深度
   * @param maxDepth 最大深度
   * @param fn 对每个可访问 HTML 子文档执行的函数
   */
  private walkSubFrames(
    doc: Document,
    depth: number,
    maxDepth: number,
    fn: (doc: Document) => void,
  ): void {
    if (depth >= maxDepth) return;

    const iframes = Array.from(doc.querySelectorAll("iframe"));
    for (const iframe of iframes) {
      let childDoc: Document | null = null;
      try {
        const cw = (iframe as HTMLIFrameElement).contentWindow;
        childDoc = cw?.document ?? null;
      } catch {
        // 跨域 iframe 或不可访问 iframe：跳过
        childDoc = null;
      }

      if (!childDoc) {
        // 不可访问/尚未加载
        continue;
      }

      // 仅处理 HTML 文档
      if (!isHTMLDocument(childDoc)) {
        continue;
      }

      fn(childDoc);

      // 递归处理下一层
      this.walkSubFrames(childDoc, depth + 1, maxDepth, fn);
    }
  }
}
