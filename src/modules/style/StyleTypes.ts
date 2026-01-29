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

/**
 * 样式注入的目标范围。
 *
 * 设计说明：
 * - Zotero Reader 的 HTML 页面通常在一个 iframe 中渲染；同时页面内部可能存在嵌套 iframe。
 * - 为了实现“护眼模式对整页生效”，我们需要决定是否向子 iframe 递归注入。
 */
export type InjectScope = "documentOnly" | "documentAndSubFrames";

/**
 * 样式注入/应用的输入参数。
 *
 * 为什么要把参数集中成一个对象：
 * - 主题切换、CSS 变量写入、子 iframe 注入是三个相关但可独立控制的维度。
 * - 使用对象参数可以避免未来扩展（例如：按域名白名单、按选择器排除区域）时破坏调用方签名。
 */
export interface StyleApplyOptions {
  /**
   * 目标主题。
   *
   * 说明：
   * - 主题最终体现在 `<html>` 上的 class：`theme-${key}`。
   * - 为了保证幂等与互斥，我们会先移除所有已知主题 class，再添加目标主题。
   */
  theme: ThemeKey;

  /**
   * 用户自定义 CSS 变量（不含 `--` 前缀）。
   *
   * 输入输出约束：
   * - key 必须是合法的 CSS 自定义属性名片段（例如 `ts-bg`）。
   * - value 会被原样写入（例如 `#fff`、`rgb(...)`、`var(...)`）。
   */
  customVariables: Record<string, string>;

  /** 注入范围 */
  scope: InjectScope;

  /**
   * 递归注入最大深度。
   *
   * 为什么需要最大深度：
   * - 在理论上，页面可能出现循环引用或非常深的 iframe 嵌套（尤其是复杂的 HTML 文档）。
   * - 设置上限可以避免极端情况下的性能问题或死循环。
   */
  maxFrameDepth: number;
}

/**
 * 样式注入器的运行结果。
 *
 * 该结果主要用于调试与统计（软著材料中也可用于展示“可观测性设计”）。
 */
export interface StyleApplyResult {
  /** 本次实际处理的 HTML 文档数量（包含主文档与可访问的子 iframe 文档） */
  processedDocuments: number;

  /** 本次成功注入 style 标签的文档数量 */
  injectedStyleDocuments: number;

  /** 本次跳过的文档数量（例如非 HTML / 不可访问的跨域 iframe） */
  skippedDocuments: number;
}

/**
 * StyleInjector 的公共配置。
 */
export interface StyleInjectorOptions {
  /**
   * 注入 style 标签的 DOM id。
   *
   * 为什么要固定 id：
   * - 幂等注入：通过 `getElementById` 快速判断是否已注入。
   * - 热更新：如果未来要支持更新 base CSS，可以定位并替换该节点。
   */
  styleElementId: string;

  /**
   * 默认最大 iframe 递归深度。
   *
   * 说明：
   * - Zotero Reader 的 HTML 页面通常不会有很深的嵌套；
   * - 设一个合理上限可以兼顾性能与兼容性。
   */
  defaultMaxFrameDepth: number;
}
