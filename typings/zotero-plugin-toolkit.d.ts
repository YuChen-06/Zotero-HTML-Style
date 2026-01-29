declare module "zotero-plugin-toolkit" {
  /**
   * zotero-plugin-toolkit 的最小可用类型声明（Stub）。
   *
   * 设计目标：
   * - 仅用于消除 TypeScript/IDE 的“找不到模块或类型声明”的报错；
   * - 不追求完整覆盖（完整类型应以上游项目为准）。
   */
  export class BasicTool {
    /**
     * 获取 Zotero 沙盒环境中的全局对象。
     *
     * 注意：该返回值在不同运行时可能具有不同结构，因此这里使用 unknown。
     */
    getGlobal(name: "Zotero"): any;
    getGlobal(name: string): unknown;
  }

  /**
   * ZoteroToolkit 最小 stub。
   *
   * 仅覆盖本项目当前使用到的字段结构。
   */
  export class ZoteroToolkit {
    basicOptions: {
      log: {
        prefix: string;
        disableConsole: boolean;
      };
      api: {
        pluginID: string;
      };
    };

    UI: {
      basicOptions: {
        ui: {
          enableElementJSONLog: boolean;
          enableElementDOMLog: boolean;
        };
      };
    };
  }

  export class UITool {
    constructor(tool: BasicTool);

    basicOptions: {
      ui: {
        enableElementJSONLog: boolean;
        enableElementDOMLog: boolean;
      };
    };
  }

  export function unregister(tool: BasicTool): void;
}
