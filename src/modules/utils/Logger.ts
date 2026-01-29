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

/**
 * 日志等级。
 *
 * 说明：
 * - Zotero 插件常见调试方式是 `Zotero.debug()`，但在不同运行环境（开发/生产）和不同 Zotero 版本中
 *   可用性与输出位置可能不同。
 * - 因此这里做一层薄封装，保证日志输出“可控、可关闭、可统一前缀”。
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * 轻量日志器。
 *
 * 设计目标：
 * - 在不引入额外依赖的情况下，为模块化架构提供统一日志入口；
 * - 通过前缀将日志与 Zotero 其他组件区分开；
 * - 支持在生产环境降低输出噪音，避免影响用户体验。
 */
export class Logger {
  private readonly prefix: string;
  private readonly enableDebug: boolean;

  /**
   * @param prefix 日志前缀（建议包含模块名），用于快速定位日志来源。
   * @param enableDebug 是否启用 debug 输出。
   */
  public constructor(prefix: string, enableDebug: boolean) {
    this.prefix = prefix;
    this.enableDebug = enableDebug;
  }

  /**
   * 创建默认 Logger。
   *
   * 为什么提供静态工厂：
   * - 避免每个模块都手写 `pkg.config.addonName` 与环境判断逻辑；
   * - 保证统一的前缀格式，便于软著审查/维护人员阅读日志。
   */
  public static create(moduleName: string): Logger {
    const env = __env__;
    const enableDebug = env === "development";
    const prefix = `[${pkg.config.addonName}][${moduleName}]`;
    return new Logger(prefix, enableDebug);
  }

  /**
   * 输出 debug 日志。
   *
   * @param message 日志消息
   */
  public debug(message: string): void {
    if (!this.enableDebug) return;
    this.print("debug", message);
  }

  /**
   * 输出 info 日志。
   *
   * @param message 日志消息
   */
  public info(message: string): void {
    this.print("info", message);
  }

  /**
   * 输出 warn 日志。
   *
   * @param message 日志消息
   */
  public warn(message: string): void {
    this.print("warn", message);
  }

  /**
   * 输出 error 日志。
   *
   * @param message 日志消息
   */
  public error(message: string): void {
    this.print("error", message);
  }

  /**
   * 将日志实际写入 Zotero 或控制台。
   *
   * 兼容性说明：
   * - `Zotero.debug()` 在多数场景可用，但它的类型在本项目的 typings 中为 `any`，
   *   为了最大兼容，这里采用运行时探测。
   * - 如果 Zotero debug 不存在，则退化到 `console`，确保开发时不丢信息。
   */
  private print(level: LogLevel, message: string): void {
    const finalMessage = `${this.prefix} ${message}`;

    const z = Zotero as unknown as { debug?: (msg: string) => void };
    if (typeof z?.debug === "function") {
      // Zotero.debug 通常不区分等级，因此这里统一输出
      z.debug(finalMessage);
      return;
    }

    // 开发环境下的兜底输出
    const c: Partial<Console> = console;
    const fn =
      level === "error"
        ? c.error
        : level === "warn"
          ? c.warn
          : level === "info"
            ? c.info
            : c.log;
    if (typeof fn === "function") {
      fn.call(console, finalMessage);
    }
  }
}
