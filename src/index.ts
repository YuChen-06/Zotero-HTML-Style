import { BasicTool } from "zotero-plugin-toolkit";
import Addon from "./addon";
import pkg from "../package.json";

const basicTool = new BasicTool();

if (!basicTool.getGlobal("Zotero")[pkg.config.addonInstance]) {
  _globalThis.addon = new Addon();
  defineGlobal("ztoolkit", () => {
    return _globalThis.addon.data.ztoolkit;
  });
  Zotero[pkg.config.addonInstance] = addon;
  (Zotero as any).__addonInstance__ = addon;
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
