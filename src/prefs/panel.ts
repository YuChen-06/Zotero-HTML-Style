import { getPref, setPref } from "../utils/prefs";
import { ThemeKey } from "../themes";

export function bindPrefsPanel(win: Window) {
  const doc = win.document;

  const themeList = doc.getElementById("ts-default-theme") as any;
  const jsonArea = doc.getElementById("ts-json") as HTMLTextAreaElement | null;
  const btnSave = doc.getElementById("ts-json-save") as HTMLButtonElement | null;
  const btnReset = doc.getElementById("ts-json-reset") as HTMLButtonElement | null;

  // Initialize values
  if (themeList) {
    const cur = (getPref("defaultTheme" as any) as ThemeKey) || ("light" as ThemeKey);
    try {
      themeList.value = cur;
    } catch {}
    themeList.addEventListener("command", () => {
      try {
        const val = String(themeList.value) as ThemeKey;
        setPref("defaultTheme" as any, val);
      } catch (e) {
        alertIfPossible(win, `无法保存默认主题: ${e}`);
      }
    });
  }

  if (jsonArea) {
    const raw = (getPref("customVariablesJSON" as any) as string) || "{}";
    jsonArea.value = safePrettyJSON(raw);
  }

  if (btnSave && jsonArea) {
    btnSave.addEventListener("command", () => {
      try {
        const txt = jsonArea.value.trim() || "{}";
        // Validate JSON
        const obj = JSON.parse(txt || "{}");
        if (!obj || typeof obj !== "object") throw new Error("JSON must be an object");
        setPref("customVariablesJSON" as any, JSON.stringify(obj));
        alertIfPossible(win, "已保存。新打开的阅读器页签将应用新变量。");
      } catch (e) {
        alertIfPossible(win, `JSON 无效: ${e}`);
      }
    });
  }

  if (btnReset && jsonArea) {
    btnReset.addEventListener("command", () => {
      try {
        const d = {} as Record<string, string>;
        setPref("customVariablesJSON" as any, JSON.stringify(d));
        jsonArea.value = safePrettyJSON("{}");
        alertIfPossible(win, "已恢复默认 JSON ({}).");
      } catch (e) {
        alertIfPossible(win, `恢复失败: ${e}`);
      }
    });
  }
}

function safePrettyJSON(input: string) {
  try {
    const obj = JSON.parse(input || "{}");
    return JSON.stringify(obj, null, 2);
  } catch {
    return input || "{}";
  }
}

function alertIfPossible(win: Window, msg: string) {
  try {
    (win as any).alert?.(msg);
  } catch {}
}
