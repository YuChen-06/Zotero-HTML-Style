import { getPref, setPref } from "./utils/prefs";
import { registerReaderUI } from "./reader";
import { bindPrefsPanel } from "./prefs/panel";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  // 初始化默认首选项（若未设置）
  if (!getPref("defaultTheme")) {
    setPref("defaultTheme" as any, "light" as any);
  }
  if (!getPref("customVariablesJSON")) {
    setPref("customVariablesJSON" as any, "{}" as any);
  }

  // 注册 Reader 事件与工具栏按钮
  registerReaderUI();

  addon.data.initialized = true;
}

async function onMainWindowLoad(win: Window): Promise<void> {
  // 目前无需针对主窗口做额外处理
}

async function onMainWindowUnload(win: Window): Promise<void> {
  // 释放 UI 资源（如后续注册了全局菜单/窗口资源，可在此卸载）
}

function onShutdown(): void {
  // 卸载由 registerReaderUI 注册的事件监听器（由 Zotero 根据 pluginID 自动清理，这里预留手动清理接口）
}

async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  // 暂无需要处理的通知
}

async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  if (type === "load" && data?.window) {
    try {
      bindPrefsPanel(data.window as Window);
    } catch (e) {
      Zotero.debug?.(`Theme Switcher prefs bind error: ${e}`);
    }
  }
}

function onShortcuts(type: string) {
  // 预留：快捷键支持（后续可加）
}

function onDialogEvents(type: string) {
  // 预留：对话框示例（不使用）
}

export default {
  onStartup,
  onMainWindowLoad,
  onMainWindowUnload,
  onShutdown,
  onNotify,
  onPrefsEvent,
  onShortcuts,
  onDialogEvents,
};
