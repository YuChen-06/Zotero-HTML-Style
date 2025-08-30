import pkg from "../package.json";
import { getPref, setPref } from "./utils/prefs";
import { buildCSS, THEME_ORDER, PRESETS, ThemeKey } from "./themes";

const STYLE_ID = "theme-switcher-style";

export function registerReaderUI() {
  // 注册 Reader 工具栏按钮与初始化注入
  const type = "renderToolbar" as const;
  const handler = (event: any) => {
    const { reader, doc, append } = event;

    // 仅针对主内容为 HTML 的 Reader 生效
    const mainWin = reader?._iframeWindow as Window | undefined;
    const mainDoc = mainWin?.document as Document | undefined;
    if (!mainWin || !mainDoc || !isHTMLDocument(mainDoc)) return;

    // 工具栏按钮防重
    if (doc.getElementById("theme-switcher-button")) return;

    const btn = doc.createElement("button");
    btn.id = "theme-switcher-button";
    btn.textContent = "Theme";
    btn.setAttribute("title", "切换阅读主题");
    btn.style.padding = "2px 8px";
    btn.style.border = "1px solid var(--grey-30, #ccc)";
    btn.style.borderRadius = "4px";
    btn.style.background = "var(--grey-10, #f5f5f5)";
    btn.style.cursor = "pointer";

    btn.addEventListener("click", () => {
      const next = nextTheme(getLastTheme() || (getPref("defaultTheme" as any) as ThemeKey) || "light");
      applyThemeToReader(reader, next);
      setLastTheme(next);
    });

    append(btn);

    // 初次渲染时，确保注入与主题应用
    const initial = (getLastTheme() || (getPref("defaultTheme" as any) as ThemeKey) || "light") as ThemeKey;
    ensureInjectedAndApply(reader, initial);
  };
  // @ts-ignore Zotero Reader API
  Zotero.Reader.registerEventListener(type, handler, pkg.config.addonID);
}

function getLastTheme(): ThemeKey | undefined {
  const t = (Zotero.Prefs.get(`${pkg.config.prefsPrefix}.lastTheme`, true) as string) || "";
  return (THEME_ORDER as string[]).includes(t) ? (t as ThemeKey) : undefined;
}
function setLastTheme(t: ThemeKey) {
  Zotero.Prefs.set(`${pkg.config.prefsPrefix}.lastTheme`, t, true);
}
function nextTheme(cur: ThemeKey): ThemeKey {
  const idx = THEME_ORDER.indexOf(cur);
  return THEME_ORDER[(idx + 1) % THEME_ORDER.length];
}

function ensureInjectedAndApply(reader: any, theme: ThemeKey) {
  const win = reader?._iframeWindow as Window | undefined;
  if (!win) return;
  const tryApply = () => {
    try {
      if (!win.document || !isHTMLDocument(win.document)) return false;
      injectStylesOnce(win.document);
      applyTheme(win.document, theme);
      // 注入子 frame
      injectIntoSubFrames(win.document, (doc) => {
        injectStylesOnce(doc);
        applyTheme(doc, theme);
      });
      return true;
    } catch (e) {
      return false;
    }
  };
  if (!tryApply()) {
    const onReady = () => {
      tryApply();
    };
    win.document.addEventListener("DOMContentLoaded", onReady, { once: true });
    win.addEventListener("load", onReady, { once: true });
  }
}

function applyThemeToReader(reader: any, theme: ThemeKey) {
  const win = reader?._iframeWindow as Window | undefined;
  if (!win) return;
  if (!win.document || !isHTMLDocument(win.document)) return;
  injectStylesOnce(win.document);
  applyTheme(win.document, theme);
  injectIntoSubFrames(win.document, (doc) => {
    injectStylesOnce(doc);
    applyTheme(doc, theme);
  });
}

function isHTMLDocument(doc: Document) {
  const ct = (doc as any).contentType || doc.contentType;
  if (ct && typeof ct === "string") return ct.includes("html");
  return doc.documentElement?.nodeName.toLowerCase() === "html";
}

function injectStylesOnce(doc: Document) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = buildCSS(PRESETS);
  doc.documentElement.appendChild(style);

  // 应用用户自定义变量（全局 JSON）
  try {
    const json = (Zotero.Prefs.get(`${pkg.config.prefsPrefix}.customVariablesJSON`, true) as string) || "{}";
    const vars = JSON.parse(json || "{}");
    if (vars && typeof vars === "object") {
      for (const [k, v] of Object.entries(vars)) {
        (doc.documentElement as HTMLElement).style.setProperty(`--${k}`, String(v));
      }
    }
  } catch {}
}

function applyTheme(doc: Document, theme: ThemeKey) {
  const html = doc.documentElement as HTMLElement;
  for (const t of THEME_ORDER) html.classList.remove(`theme-${t}`);
  html.classList.add(`theme-${theme}`);
}

function injectIntoSubFrames(doc: Document, fn: (doc: Document) => void) {
  const iframes = Array.from(doc.querySelectorAll("iframe"));
  for (const iframe of iframes) {
    try {
      const cw = (iframe as HTMLIFrameElement).contentWindow;
      const cd = cw?.document;
      if (cw && cd && isHTMLDocument(cd)) {
        fn(cd);
      }
    } catch {
      // 跨域 frame 跳过
    }
  }
}
