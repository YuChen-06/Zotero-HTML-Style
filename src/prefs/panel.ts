import { ConfigManager } from "../modules/config/ConfigManager";
import { getById } from "../modules/utils/DomGuards";
import {
  CompositeDisposable,
  disposeFn,
  type Disposable,
} from "../modules/utils/Disposable";
import { prettyJSON, safeParseJSON } from "../modules/utils/JsonUtils";
import type { ThemeKey } from "../themes";

type ValueElement = HTMLElement & { value?: unknown };

/** Bind the preferences panel. Idempotent — safe to call multiple times. */
export function bindPrefsPanel(win: Window): Disposable {
  const doc = win.document;
  const root = doc.documentElement;
  if (root?.getAttribute("data-ts-bound-prefs") === "1") {
    return { dispose() {} };
  }
  root?.setAttribute("data-ts-bound-prefs", "1");

  const disposables = new CompositeDisposable();
  const cm = resolveConfigManager();
  const s = cm.getSettings();

  const themeList = getById<ValueElement>(doc, "ts-default-theme");
  const clickList = getById<ValueElement>(doc, "ts-click-behavior");
  const toolbarCb = getById<HTMLInputElement>(doc, "ts-show-toolbar");
  const jsonArea = getById<HTMLTextAreaElement>(doc, "ts-json");
  const btnSave = getById<HTMLButtonElement>(doc, "ts-json-save");
  const btnReset = getById<HTMLButtonElement>(doc, "ts-json-reset");

  if (themeList) {
    try {
      themeList.value = s.defaultTheme;
    } catch {
      /* ignore */
    }
    bind(
      doc,
      themeList,
      "command",
      () => {
        try {
          cm.setPref(
            "defaultTheme",
            String(themeList.value ?? "light") as ThemeKey,
          );
        } catch (e) {
          alertErr(win, "保存默认主题", e);
        }
      },
      disposables,
    );
  }

  if (clickList) {
    try {
      clickList.value = s.clickBehavior;
    } catch {
      /* ignore */
    }
    bind(
      doc,
      clickList,
      "command",
      () => {
        try {
          const raw = String(clickList.value ?? "menu");
          cm.setPref("clickBehavior", raw === "cycle" ? "cycle" : "menu");
        } catch (e) {
          alertErr(win, "保存按钮行为", e);
        }
      },
      disposables,
    );
  }

  if (toolbarCb) {
    try {
      toolbarCb.checked = s.showToolbar !== false;
    } catch {
      /* ignore */
    }
    bind(
      doc,
      toolbarCb,
      "command",
      () => {
        try {
          cm.setPref("showToolbar", Boolean(toolbarCb.checked));
        } catch (e) {
          alertErr(win, "保存工具栏开关", e);
        }
      },
      disposables,
    );
  }

  if (jsonArea) {
    jsonArea.value = safePrettyJSON(
      (cm.getPref("customVariablesJSON") as string | undefined) ?? "{}",
    );
  }

  if (btnSave && jsonArea) {
    bind(
      doc,
      btnSave,
      "command",
      () => {
        const txt = jsonArea.value.trim() || "{}";
        const parsed = safeParseJSON<unknown>(txt, {});
        if (!parsed.ok) {
          alertIfPossible(
            win,
            `JSON 解析失败：${parsed.errorMessage || "未知错误"}\n\n示例：\n{\n  "ts-bg": "#ffffff",\n  "ts-fg": "#000000"\n}`,
          );
          return;
        }
        const normalized = cm.parseCustomVariables(txt);
        if (normalized.errors.length > 0) {
          alertIfPossible(
            win,
            `JSON 校验失败：\n- ${normalized.errors.join("\n- ")}`,
          );
          return;
        }
        try {
          cm.setPref("customVariablesJSON", txt);
          jsonArea.value = safePrettyJSON(txt);
          alertIfPossible(win, "已保存。已打开的阅读器页签将实时热更新。");
        } catch (e) {
          alertErr(win, "保存", e);
        }
      },
      disposables,
    );
  }

  if (btnReset && jsonArea) {
    bind(
      doc,
      btnReset,
      "command",
      () => {
        try {
          cm.setPref("customVariablesJSON", "{}");
          jsonArea.value = safePrettyJSON("{}");
          alertIfPossible(win, "已恢复默认 JSON ({}).");
        } catch (e) {
          alertErr(win, "恢复", e);
        }
      },
      disposables,
    );
  }

  const onUnload = () => disposables.dispose();
  win.addEventListener("unload", onUnload, { once: true });
  disposables.add(
    disposeFn(() => {
      try {
        win.removeEventListener("unload", onUnload);
      } catch {
        /* best-effort */
      }
    }),
  );

  return { dispose: () => disposables.dispose() };
}

function safePrettyJSON(input: string): string {
  const parsed = safeParseJSON<unknown>(input || "{}", {});
  return parsed.ok ? prettyJSON(parsed.value, 2) : input || "{}";
}

function resolveConfigManager(): ConfigManager {
  try {
    const core = (
      addon as unknown as { api?: { getThemeSwitcherCore?: () => unknown } }
    )?.api?.getThemeSwitcherCore?.() as
      | { configManager?: ConfigManager }
      | undefined;
    if (core?.configManager) return core.configManager;
  } catch {
    /* ignore */
  }
  return new ConfigManager();
}

function bind(
  doc: Document,
  el: Element,
  event: string,
  handler: () => void,
  disposables: CompositeDisposable,
): void {
  el.addEventListener(event, handler);
  disposables.add(
    disposeFn(() => {
      try {
        el.removeEventListener(event, handler);
      } catch {
        /* best-effort */
      }
    }),
  );
}

function alertIfPossible(win: Window, msg: string): void {
  try {
    (win as any).alert?.(msg);
  } catch {
    /* ignore */
  }
}

function alertErr(win: Window, action: string, e: unknown): void {
  alertIfPossible(
    win,
    `${action}失败: ${e instanceof Error ? e.message : String(e)}`,
  );
}
