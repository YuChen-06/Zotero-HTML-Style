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

import pkg from "../../../package.json";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/** Create a prefixed logger for a module. Debug output is gated by __env__. */
export function createLogger(moduleName: string): Logger {
  const isDev = __env__ === "development";
  const prefix = `[${pkg.config.addonName}][${moduleName}]`;

  function print(level: LogLevel, message: string): void {
    const msg = `${prefix} ${message}`;
    const z = Zotero as unknown as { debug?: (msg: string) => void };
    if (typeof z?.debug === "function") {
      z.debug(msg);
      return;
    }
    const c: Partial<Console> = console;
    const fn =
      level === "error"
        ? c.error
        : level === "warn"
          ? c.warn
          : level === "info"
            ? c.info
            : c.log;
    if (typeof fn === "function") fn.call(console, msg);
  }

  return {
    debug(message: string): void {
      if (isDev) print("debug", message);
    },
    info(message: string): void {
      print("info", message);
    },
    warn(message: string): void {
      print("warn", message);
    },
    error(message: string): void {
      print("error", message);
    },
  };
}
