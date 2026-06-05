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
 * JSON 解析结果。
 *
 * 为什么返回结构化结果：
 * - 在偏好面板中，用户输入 JSON 的质量不可控。
 * - 如果直接 `JSON.parse` 并抛错，会导致 UI 逻辑复杂且错误提示分散。
 * - 统一的解析结果能让上层（ConfigManager / Prefs Panel）用同一套方式展示错误信息，
 *   也更利于软著材料体现“输入校验与异常处理”的工程能力。
 */
export interface JSONParseResult<T> {
  /** 是否解析成功 */
  ok: boolean;
  /** 解析出的值（失败时为 fallback） */
  value: T;
  /** 错误信息（失败时可用于提示用户） */
  errorMessage?: string;
}

/**
 * 安全解析 JSON。
 *
 * @param raw 用户输入的原始 JSON 字符串
 * @param fallback 当解析失败时返回的默认值
 * @returns 结构化解析结果
 */
export function safeParseJSON<T>(raw: string, fallback: T): JSONParseResult<T> {
  try {
    const v = JSON.parse(raw) as unknown;
    return { ok: true, value: v as T };
  } catch (e) {
    return {
      ok: false,
      value: fallback,
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * JSON 美化输出。
 *
 * @param value 任意可序列化对象
 * @param spaces 缩进空格数（默认 2）
 * @returns 美化后的 JSON 字符串；如果 stringify 失败则返回 "{}"
 */
export function prettyJSON(value: unknown, spaces = 2): string {
  try {
    return JSON.stringify(value, null, spaces);
  } catch {
    return "{}";
  }
}

/**
 * 判断一个值是否为“普通对象”（plain object）。
 *
 * 为什么要区分 plain object：
 * - 用户 JSON 可能传入数组、null、Date-like 等结构；
 * - 我们的 CSS 变量映射期望是简单的 `Record<string, unknown>`。
 */
export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * CSS 自定义属性名（不含前缀 `--`）的校验。
 *
 * 为什么需要校验：
 * - CSS 变量名理论上允许更宽松的字符集，但在实践中如果允许空格/括号/引号等字符，
 *   可能导致注入失败或产生难以排查的样式问题。
 * - 软著/审计角度：输入校验可以显著降低“用户数据导致异常”的风险。
 */
const CSS_VAR_KEY_RE = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;

/**
 * 校验 CSS 变量键名。
 *
 * @param key 键名（不含 `--`）
 * @returns 若合法返回 `true`
 */
export function isValidCSSVarKey(key: string): boolean {
  return CSS_VAR_KEY_RE.test(key);
}

/**
 * 将未知对象规范化为 `Record<string, string>`，并返回错误列表。
 *
 * 输入输出说明：
 * - 输入：任意未知值，通常来自 `JSON.parse`。
 * - 输出：
 *   - `vars`：可安全写入 CSS 变量的键值对（所有值被转换为字符串）；
 *   - `errors`：无法转换或非法键名对应的错误信息。
 *
 * 为什么要做规范化：
 * - 直接把 JSON object 的 value 写入 CSS 变量会触发隐式类型转换，
 *   且当 value 是 object/array 时结果不可读。
 * - 这里统一把 value 转为 `String(value)`，并对键名做安全校验。
 */
export function normalizeToStringMap(value: unknown): {
  vars: Record<string, string>;
  errors: string[];
} {
  const errors: string[] = [];

  if (!isPlainObject(value)) {
    return {
      vars: {},
      errors: ['JSON 必须是对象（Object），例如：{"ts-bg": "#ffffff"}'],
    };
  }

  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (!isValidCSSVarKey(k)) {
      errors.push(`变量名不合法: ${k}`);
      continue;
    }

    // 将任何值规范化为字符串，避免复杂对象写入 CSS 导致不可预期
    vars[k] = String(v);
  }

  return { vars, errors };
}
