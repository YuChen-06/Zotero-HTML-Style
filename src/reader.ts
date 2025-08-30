import pkg from "../package.json";
import { getPref } from "./utils/prefs";
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

    // 是否显示工具栏按钮（默认 true）
    const showToolbar = (getPref("showToolbar") as boolean);
    if (showToolbar === false) return;

    const btn = doc.createElement("button");
    btn.id = "theme-switcher-button";
    btn.setAttribute("title", t("ts-tooltip"));
    btn.setAttribute("aria-label", t("ts-tooltip"));
    // 使用 SVG 图标，颜色继承 currentColor，随主题自适配
    btn.innerHTML = `
<span style="display:inline-flex;align-items:center;justify-content:center;">
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M11.5 13.5h5v-2h-5zM11 15q-.425 0-.712-.288T10 14v-3q0-.425.288-.712T11 10h6q.425 0 .713.288T18 11v3q0 .425-.288.713T17 15zm-7 5q-.825 0-1.412-.587T2 18V6q0-.825.588-1.412T4 4h16q.825 0 1.413.588T22 6v12q0 .825-.587 1.413T20 20zm0-2h16V8H4z"/>
  </svg>
</span>`;
    // 尽量减少自定义样式，继承 Zotero 样式
    btn.style.background = "transparent";
    btn.style.border = "none";
    btn.style.padding = "0 4px";
    btn.style.cursor = "pointer";
    (btn.style as any).colorScheme = "light dark";

    let menuEl: HTMLDivElement | null = null;
    const onCycle = () => {
      const next = nextTheme(getLastTheme() || (getPref("defaultTheme" as any) as ThemeKey) || "light");
      applyThemeToReader(reader, next);
      setLastTheme(next);
    };
    const onToggleMenu = () => {
      if (menuEl && menuEl.isConnected) {
        hideMenu();
      } else {
        showMenu();
      }
    };

    const clickBehavior = (getPref("clickBehavior") as string) || "menu";
    btn.addEventListener("click", () => {
      if (clickBehavior === "cycle") {
        onCycle();
      } else {
        onToggleMenu();
      }
    });

    append(btn);

    // 初次渲染时，确保注入与主题应用
    const initial = (getLastTheme() || (getPref("defaultTheme" as any) as ThemeKey) || "light") as ThemeKey;
    ensureInjectedAndApply(reader, initial);

    function showMenu() {
      menuEl = buildMenu(doc, THEME_ORDER, (key) => {
        applyThemeToReader(reader, key);
        setLastTheme(key);
        hideMenu();
      });
      positionMenuUnderButton(btn, menuEl!);
      doc.body.appendChild(menuEl!);
      setTimeout(() => {
        doc.addEventListener("mousedown", onDocClick, { once: true });
      }, 0);
    }
    function hideMenu() {
      if (menuEl && menuEl.parentNode) menuEl.parentNode.removeChild(menuEl);
      menuEl = null;
    }
    function onDocClick(e: MouseEvent) {
      if (!menuEl) return;
      const path = (e.composedPath?.() as any) || [];
      if (!path.includes(menuEl) && !path.includes(btn)) hideMenu();
    }
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

function positionMenuUnderButton(btn: HTMLElement, menu: HTMLDivElement) {
  const rect = btn.getBoundingClientRect();
  Object.assign(menu.style, {
    position: "fixed",
    top: `${Math.round(rect.bottom + 4)}px`,
    left: `${Math.round(rect.left)}px`,
    zIndex: "99999",
  } as Partial<CSSStyleDeclaration>);
}

function buildMenu(doc: Document, keys: ThemeKey[], onPick: (k: ThemeKey) => void) {
  const menu = doc.createElement("div");
  menu.setAttribute("role", "menu");
  Object.assign(menu.style, {
    background: "Canvas",
    color: "CanvasText",
    border: "1px solid ButtonBorder",
    borderRadius: "6px",
    boxShadow: "0 4px 16px rgba(0,0,0,.15)",
    padding: "6px 0",
    minWidth: "180px",
    fontSize: "12.5px",
  } as Partial<CSSStyleDeclaration>);
  (menu.style as any).colorScheme = "light dark";

  for (const key of keys) {
    const item = doc.createElement("div");
    item.setAttribute("role", "menuitem");
    Object.assign(item.style, {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "6px 10px",
      cursor: "pointer",
    } as Partial<CSSStyleDeclaration>);

    const dot = doc.createElement("span");
    Object.assign(dot.style, {
      position: "relative",
      width: "16px",
      height: "16px",
      borderRadius: "50%",
      background: PRESETS[key]["ts-bg"],
      border: `1px solid ${PRESETS[key]["ts-border"] || "ButtonBorder"}`,
      display: "inline-block",
      boxSizing: "border-box",
    } as Partial<CSSStyleDeclaration>);
    const fg = doc.createElement("span");
    Object.assign(fg.style, {
      position: "absolute",
      right: "-2px",
      bottom: "-2px",
      width: "9px",
      height: "9px",
      borderRadius: "50%",
      background: PRESETS[key]["ts-fg"],
      border: "1px solid rgba(0,0,0,.2)",
    } as Partial<CSSStyleDeclaration>);
    dot.appendChild(fg);

    const label = doc.createElement("span");
    label.textContent = themeDisplayName(key);

    item.appendChild(dot);
    item.appendChild(label);
    item.addEventListener("mouseenter", () => {
      item.style.background = "Highlight";
      item.style.color = "HighlightText";
    });
    item.addEventListener("mouseleave", () => {
      item.style.background = "transparent";
      item.style.color = "inherit";
    });
    item.addEventListener("click", () => onPick(key));
    menu.appendChild(item);
  }
  return menu as HTMLDivElement;
}

function getLocale(): string {
  try {
    // Zotero 有 locale，退化到浏览器
    // @ts-ignore
    return (Zotero?.locale as string) || navigator.language || "en-US";
  } catch {
    return "en-US";
  }
}

function t(id: string): string {
  const loc = getLocale().toLowerCase();
  const zh = loc.startsWith("zh");
  const map: Record<string, { zh: string; en: string }> = {
    "ts-tooltip": { zh: "切换阅读主题", en: "Switch reading theme" },
  };
  const m = map[id];
  if (!m) return id;
  return zh ? m.zh : m.en;
}

function themeDisplayName(key: ThemeKey): string {
  const loc = getLocale().toLowerCase();
  const zh = loc.startsWith("zh");
  const names: Record<ThemeKey, { zh: string; en: string }> = {
    light: { zh: "白天", en: "Light" },
    "deep-night": { zh: "暗夜", en: "Deep Night" },
    midnight: { zh: "黑夜", en: "Midnight" },
    beige: { zh: "米色", en: "Beige" },
    "green-dou": { zh: "豆沙绿", en: "Green (Dou)" },
    lilac: { zh: "浅紫", en: "Lilac" },
    "deep-beige": { zh: "深米色", en: "Deep Beige" },
  };
  const n = names[key];
  return (zh ? n.zh : n.en) || String(key);
}
