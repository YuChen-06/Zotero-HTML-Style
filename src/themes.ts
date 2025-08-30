export type ThemeKey =
  | "light"
  | "deep-night"
  | "midnight"
  | "beige"
  | "green-dou"
  | "lilac"
  | "deep-beige";

export const THEME_ORDER: ThemeKey[] = [
  "light",
  "deep-night",
  "midnight",
  "beige",
  "green-dou",
  "lilac",
  "deep-beige",
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
    "ts-link": "LinkText",
    "ts-code-bg": "#f6f8fa",
    "ts-code-fg": "#0f172a",
    "ts-border": "#e5e7eb",
    "ts-muted": "#4b5563",
    "ts-selection": "Highlight",
  },
  "deep-night": {
    ...BASE_VARS,
    "ts-bg": "#323542",
    "ts-fg": "#c4cbe0",
    "ts-link": "LinkText",
    "ts-code-bg": "#2b2e3a",
    "ts-code-fg": "#e6eaff",
    "ts-border": "#3e4251",
    "ts-muted": "#9aa2b4",
    "ts-selection": "Highlight",
  },
  midnight: {
    ...BASE_VARS,
    "ts-bg": "#22262b",
    "ts-fg": "#fcfcff",
    "ts-link": "LinkText",
    "ts-code-bg": "#1b1f24",
    "ts-code-fg": "#e6eaf0",
    "ts-border": "#2d3238",
    "ts-muted": "#a9b1ba",
    "ts-selection": "Highlight",
  },
  beige: {
    ...BASE_VARS,
    "ts-bg": "#ede9e1",
    "ts-fg": "#000000",
    "ts-link": "LinkText",
    "ts-code-bg": "#f2ede6",
    "ts-code-fg": "#111111",
    "ts-border": "#e0d9cd",
    "ts-muted": "#4b5563",
    "ts-selection": "Highlight",
  },
  "green-dou": {
    ...BASE_VARS,
    "ts-bg": "#c8edcc",
    "ts-fg": "#000000",
    "ts-link": "LinkText",
    "ts-code-bg": "#d6f2d9",
    "ts-code-fg": "#111111",
    "ts-border": "#b8e2bd",
    "ts-muted": "#374151",
    "ts-selection": "Highlight",
  },
  lilac: {
    ...BASE_VARS,
    "ts-bg": "#dbe2f2",
    "ts-fg": "#000000",
    "ts-link": "LinkText",
    "ts-code-bg": "#e6ebf8",
    "ts-code-fg": "#111111",
    "ts-border": "#cdd5ea",
    "ts-muted": "#374151",
    "ts-selection": "Highlight",
  },
  "deep-beige": {
    ...BASE_VARS,
    "ts-bg": "#e2eccd",
    "ts-fg": "#000000",
    "ts-link": "LinkText",
    "ts-code-bg": "#e8f0d8",
    "ts-code-fg": "#111111",
    "ts-border": "#d3ddb9",
    "ts-muted": "#374151",
    "ts-selection": "Highlight",
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
