export type ThemeKey = "light" | "dark" | "eye-yellow" | "eye-green";

export const THEME_ORDER: ThemeKey[] = [
  "light",
  "dark",
  "eye-yellow",
  "eye-green",
];

export type VarMap = Record<string, string>;

export const BASE_VARS: VarMap = {
  "ts-font-size": "16px",
  "ts-line-height": "1.7",
  "ts-paragraph-spacing": "0.6em",
};

export const PRESETS: Record<ThemeKey, VarMap> = {
  light: {
    ...BASE_VARS,
    "ts-bg": "#ffffff",
    "ts-fg": "#111111",
    "ts-link": "#0b57d0",
    "ts-code-bg": "#f6f8fa",
    "ts-code-fg": "#0f172a",
    "ts-border": "#e5e7eb",
    "ts-muted": "#4b5563",
    "ts-selection": "#e0f2fe",
  },
  dark: {
    ...BASE_VARS,
    "ts-bg": "#0b0f14",
    "ts-fg": "#e5e7eb",
    "ts-link": "#8ab4f8",
    "ts-code-bg": "#111827",
    "ts-code-fg": "#e5e7eb",
    "ts-border": "#1f2937",
    "ts-muted": "#9ca3af",
    "ts-selection": "#1e3a8a",
  },
  "eye-yellow": {
    ...BASE_VARS,
    "ts-bg": "#fff8dc", // cornsilk-like
    "ts-fg": "#2b2b2b",
    "ts-link": "#275d9d",
    "ts-code-bg": "#fff2bf",
    "ts-code-fg": "#1f2937",
    "ts-border": "#e4d9a6",
    "ts-muted": "#5b5b5b",
    "ts-selection": "#fde68a",
  },
  "eye-green": {
    ...BASE_VARS,
    "ts-bg": "#f1f8e9",
    "ts-fg": "#263238",
    "ts-link": "#2b7a78",
    "ts-code-bg": "#e6f4ea",
    "ts-code-fg": "#1b4332",
    "ts-border": "#c8e6c9",
    "ts-muted": "#546e7a",
    "ts-selection": "#b2dfdb",
  },
};

export function mergeVars(base: VarMap, override?: VarMap): VarMap {
  return { ...base, ...(override || {}) };
}

export function buildCSS(presets: Record<ThemeKey, VarMap>): string {
  const themeBlocks = THEME_ORDER.map((key) => {
    const vars = presets[key];
    const decls = Object.entries(vars)
      .map(([k, v]) => `  --${k}: ${v};`)
      .join("\n");
    return `html.theme-${key} {\n${decls}\n}`;
  }).join("\n\n");

  const base = `/* Theme Switcher injected styles */\n:root {\n  /* 用户 JSON 可覆盖以下变量 */\n  --ts-font-size: ${BASE_VARS["ts-font-size"]};\n  --ts-line-height: ${BASE_VARS["ts-line-height"]};\n  --ts-paragraph-spacing: ${BASE_VARS["ts-paragraph-spacing"]};\n}\n\n/* 应用变量到常见元素 */\nbody {\n  background: var(--ts-bg, #ffffff) !important;\n  color: var(--ts-fg, #111111) !important;\n  font-size: var(--ts-font-size);\n  line-height: var(--ts-line-height);\n}\n\nmain, article, section, p {\n  margin-block-end: var(--ts-paragraph-spacing);\n}\n\na {\n  color: var(--ts-link, #0b57d0);\n}\n\ncode, pre, kbd, samp {\n  background: var(--ts-code-bg, #f6f8fa);\n  color: var(--ts-code-fg, #0f172a);\n  border: 1px solid var(--ts-border, #e5e7eb);\n  border-radius: 4px;\n  padding: 0.1em 0.3em;\n}\n\n::selection {\n  background: var(--ts-selection, rgba(180, 213, 255, 0.6));\n}\n`;

  return [themeBlocks, base].join("\n\n");
}
