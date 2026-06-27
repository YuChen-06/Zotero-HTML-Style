import { BasicTool } from "zotero-plugin-toolkit";
import Addon from "./addon";
import pkg from "../package.json";
import { ConfigManager } from "./modules/config/ConfigManager";
import { ReaderController } from "./modules/reader/ReaderController";
import { StyleInjector } from "./modules/style/StyleInjector";

const basicTool = new BasicTool();
const zoteroGlobal = basicTool.getGlobal("Zotero") as any;

interface ThemeSwitcherCore {
  configManager: ConfigManager;
  styleInjector: StyleInjector;
  readerController: ReaderController;
}

let coreSingleton: ThemeSwitcherCore | null = null;

export function getThemeSwitcherCore(): ThemeSwitcherCore {
  if (coreSingleton) return coreSingleton;

  const configManager = new ConfigManager();
  const styleInjector = new StyleInjector();
  const readerController = new ReaderController({
    configManager,
    styleInjector,
  });

  coreSingleton = {
    configManager,
    styleInjector,
    readerController,
  };
  return coreSingleton;
}

if (!zoteroGlobal[pkg.config.addonInstance]) {
  _globalThis.addon = new Addon();
  defineGlobal("ztoolkit", () => {
    return _globalThis.addon.data.ztoolkit;
  });
  Zotero[pkg.config.addonInstance] = addon;
  (Zotero as any).__addonInstance__ = addon;
}

try {
  const addonInstance = zoteroGlobal[pkg.config.addonInstance] as unknown as
    | { api?: Record<string, unknown> }
    | undefined;
  if (addonInstance) {
    if (!addonInstance.api) addonInstance.api = {};
    addonInstance.api.getThemeSwitcherCore = getThemeSwitcherCore;
  }
} catch {
  // ignore
}

function defineGlobal(name: Parameters<BasicTool["getGlobal"]>[0]): void;
function defineGlobal(name: string, getter: () => any): void;
function defineGlobal(name: string, getter?: () => any) {
  Object.defineProperty(_globalThis, name, {
    get() {
      return getter ? getter() : basicTool.getGlobal(name);
    },
  });
}
