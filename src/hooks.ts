import { bindPrefsPanel } from "./prefs/panel";
import { ConfigManager } from "./modules/config/ConfigManager";
import { ReaderController } from "./modules/reader/ReaderController";
import { StyleInjector } from "./modules/style/StyleInjector";

/**
 * 插件核心单例（运行态）。
 *
 * 为什么需要单例：
 * - Zotero 的生命周期回调可能被多次触发（例如热重载/窗口重建），我们必须保证初始化幂等；
 * - ConfigManager/ReaderController 都持有监听器与资源句柄，重复创建会导致重复监听与潜在泄漏。
 */
let configManagerSingleton: ConfigManager | null = null;
let readerControllerSingleton: ReaderController | null = null;

type CoreLike = {
  configManager: ConfigManager;
  readerController: ReaderController;
};

let coreSnapshot: CoreLike | null = null;

/**
 * 获取（或创建）核心单例。
 *
 * 说明：
 * - 这里不在模块顶层直接 new，是为了避免 Zotero 尚未完成初始化就提前触发 Pref/Reader API。
 */
function ensureCore(): {
  configManager: ConfigManager;
  readerController: ReaderController;
} {
  // 优先使用 index.ts 挂载到 addon.api 的 getter（避免 hooks.ts 直接 import index.ts 引发循环依赖）。
  // - index.ts -> addon.ts -> hooks.ts
  // - 若 hooks.ts import index.ts，会形成环。
  try {
    const maybeGetter = (
      addon as unknown as { api?: { getThemeSwitcherCore?: () => unknown } }
    )?.api?.getThemeSwitcherCore;
    if (typeof maybeGetter === "function") {
      const core = maybeGetter() as unknown as {
        configManager?: ConfigManager;
        readerController?: ReaderController;
      };
      if (core?.configManager && core?.readerController) {
        coreSnapshot = {
          configManager: core.configManager,
          readerController: core.readerController,
        };
        configManagerSingleton = core.configManager;
        readerControllerSingleton = core.readerController;
        return coreSnapshot;
      }
    }
  } catch {
    // ignore
  }

  if (configManagerSingleton && readerControllerSingleton) {
    coreSnapshot = {
      configManager: configManagerSingleton,
      readerController: readerControllerSingleton,
    };
    return coreSnapshot;
  }

  const configManager = new ConfigManager();
  const styleInjector = new StyleInjector();
  const readerController = new ReaderController({
    configManager,
    styleInjector,
  });

  configManagerSingleton = configManager;
  readerControllerSingleton = readerController;
  coreSnapshot = { configManager, readerController };
  return coreSnapshot;
}

async function onStartup() {
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
}

async function onMainWindowLoad(_win: Window): Promise<void> {
  // Reserved for future use
}

async function onMainWindowUnload(_win: Window): Promise<void> {
  // Reserved for future use
}

function onShutdown(): void {
  // 注意清理顺序：先停业务（ReaderController），再停配置（ConfigManager）
  try {
    (coreSnapshot?.readerController ?? readerControllerSingleton)?.dispose();
  } catch {
    // best-effort
  } finally {
    readerControllerSingleton = null;
  }

  try {
    (coreSnapshot?.configManager ?? configManagerSingleton)?.dispose();
  } catch {
    // best-effort
  } finally {
    configManagerSingleton = null;
  }

  coreSnapshot = null;
}

async function onNotify(
  _event: string,
  _type: string,
  _ids: Array<string | number>,
  _extraData: { [key: string]: any },
) {
  // Reserved for future use
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

function onShortcuts(_type: string) {
  // Reserved for future use
}

function onDialogEvents(_type: string) {
  // Reserved for future use
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
