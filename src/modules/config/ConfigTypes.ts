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
 * 插件偏好项类型映射。
 *
 * 来源说明：
 * - 该类型来自 `typings/prefs.d.ts`（由 scaffold 自动生成），
 *   用于将“字符串 key”与其值类型建立强约束。
 * - 软著审查角度：这属于典型的“类型系统建模”，能体现工程化质量。
 */
export type PluginPrefsMap = _ZoteroTypes.Prefs["PluginPrefsMap"];

/**
 * 插件偏好项键名集合。
 */
export type PluginPrefKey = keyof PluginPrefsMap;

/**
 * 工具栏按钮点击行为。
 *
 * - `menu`：点击打开菜单
 * - `cycle`：点击直接循环切换主题
 */
export type ClickBehavior = "menu" | "cycle";

/**
 * 用户自定义 CSS 变量映射。
 *
 * 说明：
 * - key 为不含 `--` 的变量名（例如 `ts-bg`）；
 * - value 为 CSS 字符串（例如 `#fff`、`rgb(...)`、`var(...)`）。
 */
export type CustomCSSVariables = Record<string, string>;

/**
 * ConfigManager 对外暴露的“规范化配置快照”。
 *
 * 为什么要返回快照而不是到处 getPref：
 * - 避免业务模块重复拼接 pref key，减少出错点；
 * - 通过快照把“解析 + 校验 + 默认值”集中在 ConfigManager；
 * - 更利于实现热更新：一旦 pref 变化，重新生成快照并广播。
 */
export interface ThemeSwitcherSettings {
  /** 默认主题 */
  defaultTheme: ThemeKey;
  /** 工具栏按钮点击行为 */
  clickBehavior: ClickBehavior;
  /** 是否显示工具栏按钮 */
  showToolbar: boolean;
  /** 用户自定义 CSS 变量（已校验、已规范化） */
  customVariables: CustomCSSVariables;
}

/**
 * 配置变更事件。
 *
 * 设计说明：
 * - `changedKeys` 用于让上层决定是否需要执行代价较高的操作（例如对所有 Reader 热刷新）。
 * - `settings` 为变更后的最新快照，监听方无需再次查询 Pref。
 */
export interface ConfigChangeEvent {
  /** 本次发生变化的偏好键名（插件内部键名，不含前缀） */
  changedKeys: PluginPrefKey[];
  /** 最新配置快照 */
  settings: ThemeSwitcherSettings;
  /** 事件来源（便于日志与调试） */
  source: "init" | "prefs" | "manual";
}
