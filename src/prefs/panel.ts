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
    return { dispose: () => {} };
  }
  root?.setAttribute("data-ts-bound-prefs", "1");

  const disposables = new CompositeDisposable();

  const configManager = resolveConfigManager();
  const settings = configManager.getSettings();

  const themeList = getById<ValueElement>(doc, "ts-default-theme");
  const clickBehaviorList = getById<ValueElement>(doc, "ts-click-behavior");
  const showToolbarCheckbox = getById<HTMLInputElement>(doc, "ts-show-toolbar");
  const jsonArea = getById<HTMLTextAreaElement>(doc, "ts-json");
  const btnSave = getById<HTMLButtonElement>(doc, "ts-json-save");
  const btnReset = getById<HTMLButtonElement>(doc, "ts-json-reset");

  if (themeList) {
    try {
      themeList.value = settings.defaultTheme;
    } catch {
      // ignore
    }

    const onThemeChanged = () => {
      try {
        const val = String(themeList.value ?? "light") as ThemeKey;
        configManager.setPref("defaultTheme", val);
      } catch (e) {
        alertIfPossible(
          win,
          `无法保存默认主题: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    };

    themeList.addEventListener("command", onThemeChanged);
    disposables.add(
      disposeFn(() => {
        try {
          themeList.removeEventListener("command", onThemeChanged);
        } catch {
          // ignore
        }
      }),
    );
  }

  if (clickBehaviorList) {
    try {
      clickBehaviorList.value = settings.clickBehavior;
    } catch {
      // ignore
    }

    const onClickBehaviorChanged = () => {
      try {
        const raw = String(clickBehaviorList.value ?? "menu");
        const val: "menu" | "cycle" = raw === "cycle" ? "cycle" : "menu";
        configManager.setPref("clickBehavior", val);
      } catch (e) {
        alertIfPossible(
          win,
          `无法保存按钮行为: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    };

    clickBehaviorList.addEventListener("command", onClickBehaviorChanged);
    disposables.add(
      disposeFn(() => {
        try {
          clickBehaviorList.removeEventListener(
            "command",
            onClickBehaviorChanged,
          );
        } catch {
          // ignore
        }
      }),
    );
  }

  if (showToolbarCheckbox) {
    try {
      showToolbarCheckbox.checked = settings.showToolbar !== false;
    } catch {
      // ignore
    }

    const onShowToolbarChanged = () => {
      try {
        configManager.setPref(
          "showToolbar",
          Boolean(showToolbarCheckbox.checked),
        );
      } catch (e) {
        alertIfPossible(
          win,
          `无法保存工具栏开关: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    };

    showToolbarCheckbox.addEventListener("command", onShowToolbarChanged);
    disposables.add(
      disposeFn(() => {
        try {
          showToolbarCheckbox.removeEventListener(
            "command",
            onShowToolbarChanged,
          );
        } catch {
          // ignore
        }
      }),
    );
  }

  if (jsonArea) {
    // 显示 raw JSON（而不是 settings.customVariables），这样可以保留用户原始书写习惯。
    const raw =
      (configManager.getPref("customVariablesJSON") as unknown as
        | string
        | undefined) ?? "{}";
    jsonArea.value = safePrettyJSON(raw);
  }

  if (btnSave && jsonArea) {
    const onSave = () => {
      const txt = jsonArea.value.trim() || "{}";

      const parsed = safeParseJSON<unknown>(txt, {});
      if (!parsed.ok) {
        alertIfPossible(
          win,
          `JSON 解析失败：${parsed.errorMessage || "未知错误"}\n\n示例：\n{\n  "ts-bg": "#ffffff",\n  "ts-fg": "#000000"\n}`,
        );
        return;
      }

      const normalized = configManager.parseCustomVariables(txt);
      if (normalized.errors.length > 0) {
        alertIfPossible(
          win,
          `JSON 校验失败：\n- ${normalized.errors.join("\n- ")}`,
        );
        return;
      }

      try {
        // 保存用户输入的 JSON（而不是 normalize 后的 map），便于用户后续继续编辑。
        configManager.setPref("customVariablesJSON", txt);
        jsonArea.value = safePrettyJSON(txt);
        alertIfPossible(
          win,
          "已保存。已打开的阅读器页签将实时热更新。\n（若个别页签未刷新，可能是 iframe 尚未就绪，将在下一次重试时生效。）",
        );
      } catch (e) {
        alertIfPossible(
          win,
          `保存失败: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    };

    btnSave.addEventListener("command", onSave);
    disposables.add(
      disposeFn(() => {
        try {
          btnSave.removeEventListener("command", onSave);
        } catch {
          // ignore
        }
      }),
    );
  }

  if (btnReset && jsonArea) {
    const onReset = () => {
      try {
        const txt = "{}";
        configManager.setPref("customVariablesJSON", txt);
        jsonArea.value = safePrettyJSON(txt);
        alertIfPossible(
          win,
          "已恢复默认 JSON ({}). 已打开的阅读器页签将实时热更新。",
        );
      } catch (e) {
        alertIfPossible(
          win,
          `恢复失败: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    };

    btnReset.addEventListener("command", onReset);
    disposables.add(
      disposeFn(() => {
        try {
          btnReset.removeEventListener("command", onReset);
        } catch {
          // ignore
        }
      }),
    );
  }

  const onUnload = () => {
    disposables.dispose();
  };
  win.addEventListener("unload", onUnload, { once: true });
  disposables.add(
    disposeFn(() => {
      try {
        win.removeEventListener("unload", onUnload);
      } catch {
        // ignore
      }
    }),
  );

  return {
    dispose: () => {
      disposables.dispose();
    },
  };
}

function safePrettyJSON(input: string): string {
  const parsed = safeParseJSON<unknown>(input || "{}", {});
  if (!parsed.ok) return input || "{}";
  return prettyJSON(parsed.value, 2);
}

function resolveConfigManager(): ConfigManager {
  try {
    const maybeGetter = (
      addon as unknown as { api?: { getThemeSwitcherCore?: () => unknown } }
    )?.api?.getThemeSwitcherCore;
    if (typeof maybeGetter === "function") {
      const core = maybeGetter() as unknown as {
        configManager?: ConfigManager;
      };
      if (core?.configManager) return core.configManager;
    }
  } catch {
    // ignore
  }

  // fallback：在极端情况下（core 未挂载/热重载顺序异常）仍保证面板可用。
  return new ConfigManager();
}

function alertIfPossible(win: Window, msg: string): void {
  try {
    (win as unknown as { alert?: (m: string) => void }).alert?.(msg);
  } catch {
    // ignore
  }
}
