import { bindPrefsPanel } from "./prefs/panel";
import { ConfigManager } from "./modules/config/ConfigManager";
import { ReaderController } from "./modules/reader/ReaderController";
import { StyleInjector } from "./modules/style/StyleInjector";

let configManager: ConfigManager | null = null;
let readerController: ReaderController | null = null;

function ensureCore() {
  if (configManager && readerController) return { configManager, readerController };

  // ponytail: try addon.api getter first (avoids circular import with index.ts).
  // Fallback to local construction — can't happen in practice since index.ts
  // always mounts the getter before hooks.run.
  try {
    const core = (
      addon as unknown as { api?: { getThemeSwitcherCore?: () => unknown } }
    )?.api?.getThemeSwitcherCore?.() as
      | { configManager?: ConfigManager; readerController?: ReaderController }
      | undefined;
    if (core?.configManager && core?.readerController) {
      configManager = core.configManager;
      readerController = core.readerController;
      return { configManager, readerController };
    }
  } catch {
    // ignore
  }

  const cm = new ConfigManager();
  const si = new StyleInjector();
  const rc = new ReaderController({ configManager: cm, styleInjector: si });
  configManager = cm;
  readerController = rc;
  return { configManager: cm, readerController: rc };
}

async function onStartup() {
  Zotero.debug("Theme Switcher: startup begin");
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  const { configManager, readerController } = ensureCore();

  // 1) 初始化默认首选项（若未设置）
  configManager.initDefaults();

  // 2) 启动 Pref 监听（用于热更新广播）
  configManager.startObserve();

  // 3) 启动 ReaderController（监听 renderToolbar 并注入 UI/样式）
  readerController.start();

  addon.data.initialized = true;
  Zotero.debug("Theme Switcher: startup complete");
}

async function onMainWindowLoad(_win: Window): Promise<void> {
  // Reserved for future use
}

async function onMainWindowUnload(_win: Window): Promise<void> {
  // Reserved for future use
}

function onShutdown(): void {
  Zotero.debug("Theme Switcher: shutdown begin");
  try { readerController?.dispose(); } catch { /* best-effort */ } finally { readerController = null; }
  try { configManager?.dispose(); } catch { /* best-effort */ } finally { configManager = null; }
  Zotero.debug("Theme Switcher: shutdown complete");
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

export default {
  onStartup,
  onMainWindowLoad,
  onMainWindowUnload,
  onShutdown,
  onPrefsEvent,
};
