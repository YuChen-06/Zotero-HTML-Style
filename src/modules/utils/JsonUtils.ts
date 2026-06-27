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

/** Safe JSON parse — returns {ok, value, errorMessage} instead of throwing. */
export function safeParseJSON<T>(raw: string, fallback: T): {
  ok: boolean;
  value: T;
  errorMessage?: string;
} {
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch (e) {
    return {
      ok: false,
      value: fallback,
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}

/** JSON.stringify with fallback to "{}" on failure. */
export function prettyJSON(value: unknown, spaces = 2): string {
  try {
    return JSON.stringify(value, null, spaces);
  } catch {
    return "{}";
  }
}

const CSS_VAR_KEY_RE = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;

/**
 * Normalize unknown JSON value to Record<string, string> for CSS variable injection.
 * Coerces all values to strings; filters invalid key names.
 */
export function normalizeToStringMap(value: unknown): {
  vars: Record<string, string>;
  errors: string[];
} {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {
      vars: {},
      errors: ['JSON 必须是对象（Object），例如：{"ts-bg": "#ffffff"}'],
    };
  }

  const errors: string[] = [];
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (!CSS_VAR_KEY_RE.test(k)) {
      errors.push(`变量名不合法: ${k}`);
      continue;
    }
    vars[k] = String(v);
  }

  return { vars, errors };
}
