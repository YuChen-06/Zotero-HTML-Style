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
 * Reader 事件类型。
 *
 * 目前我们只用到 `renderToolbar`，用于在 Reader 工具栏渲染时注入按钮。
 *
 * 为什么显式声明：
 * - 这能把“我们依赖 Zotero Reader 的哪些能力”表达为类型约束，
 *   便于后续适配 Zotero 版本差异。
 */
export type ReaderEventType = "renderToolbar";

/**
 * Zotero Reader 实例的最小类型描述。
 *
 * 兼容性说明（关键）：
 * - Zotero 7 的 Reader 内部实现并没有稳定的公开字段来直接拿到 iframe window。
 * - 现阶段社区插件常用 `reader._iframeWindow`（私有字段）。
 * - 因此这里将其建模为可选字段，并要求上层通过 ReaderAdapter 做安全访问。
 */
export interface ZoteroReaderInstance {
  /**
   * Reader 内部 iframe 的 Window（私有字段）。
   *
   * 注意：
   * - 该字段可能不存在/延迟出现/未来变更。
   * - 直接读取会有兼容性风险，因此必须通过 `ReaderAdapter` 做容错。
   */
  _iframeWindow?: Window;
}

/**
 * `renderToolbar` 事件回调参数。
 *
 * 说明：
 * - `doc` 并不是 Reader iframe 的 document，而是工具栏所在的 document。
 * - `append` 是 Zotero 提供的 UI 挂载入口。
 */
export interface RenderToolbarEvent {
  reader: ZoteroReaderInstance;
  doc: Document;
  append: (el: HTMLElement) => void;
}

/**
 * Reader 事件处理函数类型。
 */
export type ReaderEventHandler = (event: RenderToolbarEvent) => void;

/**
 * Zotero Reader API 的最小类型描述。
 *
 * 兼容性说明：
 * - Zotero 对外暴露的 API 在不同构建/类型库中可能存在差异。
 * - 我们在这里用“最小可用面”来描述：仅包含注册事件所需的方法。
 */
export interface ZoteroReaderAPI {
  registerEventListener: (
    type: ReaderEventType,
    handler: ReaderEventHandler,
    pluginID: string,
  ) => void;

  /**
   * 可选的反注册能力。
   *
   * 为什么设为可选：
   * - 不同 Zotero 版本/类型库可能未暴露该方法。
   * - 如果存在，我们将用于 `dispose()`，实现“自证清理”；
   * - 如果不存在，则只能依赖 Zotero 的插件卸载清理机制。
   */
  unregisterEventListener?: (
    type: ReaderEventType,
    handler: ReaderEventHandler,
    pluginID: string,
  ) => void;
}
