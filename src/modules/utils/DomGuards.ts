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
 * 判断 Document 是否为 HTML 文档。
 *
 * 为什么需要这个判断：
 * - Zotero Reader 可能打开 PDF/EPUB/快照等多种内容，其 iframe 内的 `contentType` 并非一定是 HTML。
 * - 盲目向非 HTML 文档注入 `<style>`/class 会导致异常或无意义的 DOM 操作。
 * - 做显式判断是“防御式编程”，可以减少兼容性问题并提升稳定性。
 *
 * @param doc 目标文档
 * @returns `true` 表示可以按 HTML 文档处理
 */
export function isHTMLDocument(doc: Document): boolean {
  // 部分环境下 `contentType` 可能缺失，因此需多策略判定
  const anyDoc = doc as Document & { contentType?: string };
  const ct = anyDoc.contentType;
  if (typeof ct === "string" && ct.length > 0) {
    return ct.toLowerCase().includes("html");
  }
  const nodeName = doc.documentElement?.nodeName;
  return typeof nodeName === "string" && nodeName.toLowerCase() === "html";
}

/**
 * 在 DOM 上做“防重复绑定”标记。
 *
 * 典型应用：
 * - 偏好设置面板可能触发多次 load（或同一窗口内多次初始化逻辑）。
 * - 如果不做标记，`addEventListener` 可能被重复注册，造成重复触发甚至内存泄漏。
 *
 * 输入输出说明：
 * - 输入：一个 `Document`、一个业务 key（建议全局唯一）。
 * - 输出：
 *   - 返回 `true`：表示已绑定过（调用方应直接 return）；
 *   - 返回 `false`：表示首次绑定（调用方可以继续绑定监听）。
 */
export function isAlreadyBound(doc: Document, key: string): boolean {
  const root = doc.documentElement;
  if (!root) return false;

  const attr = `data-ts-bound-${key}`;
  if (root.getAttribute(attr) === "1") return true;
  root.setAttribute(attr, "1");
  return false;
}

/**
 * 尝试安全获取元素。
 *
 * 为什么不直接抛异常：
 * - Zotero UI 或面板 DOM 可能随版本变化。
 * - 在软著申请与长期维护中，容错逻辑能显著降低“升级即崩”的风险。
 *
 * @param doc 目标文档
 * @param id 元素 id
 * @returns 找到则返回元素，否则返回 `null`
 */
export function getById<T extends HTMLElement>(
  doc: Document,
  id: string,
): T | null {
  return doc.getElementById(id) as T | null;
}
