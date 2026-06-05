/* eslint-env node */

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

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 生成软著源代码合并文本：递归收集 src 下所有 .ts 文件，并合并输出。
 *
 * 过滤策略：
 * - 只扫描 src/ 目录
 * - 自动排除常见无关目录（node_modules/dist/.git/.vscode 等）
 * - 只纳入 .ts 文件
 *
 * 输出策略：
 * - 输出到仓库根目录：source_code_dump.txt
 * - 每个文件前加入分隔头：
 *   // ================= FILE: path/to/file =================
 * - 默认压缩连续空行（节省软著页数），可用 --no-compress 关闭
 */
function main() {
  const args = process.argv.slice(2);
  const compressBlankLines = !args.includes("--no-compress");

  const repoRoot = process.cwd();
  const srcDir = path.join(repoRoot, "src");

  if (!fs.existsSync(srcDir)) {
    throw new Error(`src directory not found: ${srcDir}`);
  }

  const ignoreDirNames = new Set([
    "node_modules",
    "dist",
    "build",
    ".git",
    ".vscode",
    ".scaffold",
  ]);

  /** @type {string[]} */
  const files = [];

  /**
   * @param {string} dir
   */
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);

      if (ent.isDirectory()) {
        if (ignoreDirNames.has(ent.name)) continue;
        walk(abs);
        continue;
      }

      if (!ent.isFile()) continue;

      if (abs.toLowerCase().endsWith(".ts")) {
        files.push(abs);
      }
    }
  }

  walk(srcDir);

  files.sort((a, b) => a.localeCompare(b));

  const outPath = path.join(repoRoot, "source_code_dump.txt");

  let out = "";
  for (const abs of files) {
    const rel = path.relative(repoRoot, abs).replace(/\\/g, "/");
    const header = `// ================= FILE: ${rel} =================\n`;

    let content = fs.readFileSync(abs, "utf8");
    content = content.replace(/\r\n/g, "\n");

    if (compressBlankLines) {
      // 将 3 行及以上连续空行压缩为 1 个空行（保留基本可读性）
      content = content.replace(/\n{3,}/g, "\n\n");
    }

    // 确保每个文件块之间至少有一个换行
    if (out.length > 0 && !out.endsWith("\n")) out += "\n";
    out += header;
    out += content;
    if (!out.endsWith("\n")) out += "\n";
    out += "\n";
  }

  fs.writeFileSync(outPath, out, "utf8");

  console.log(`Done. Files: ${files.length}. Output: ${outPath}`);
}

const isMain = (() => {
  try {
    const current = fileURLToPath(import.meta.url);
    const entry = path.resolve(process.argv[1] || "");
    return path.resolve(current) === entry;
  } catch {
    return false;
  }
})();

if (isMain) {
  main();
}
