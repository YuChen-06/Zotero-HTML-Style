import pkg from "../package.json";
import hooks from "./hooks";
import { createZToolkit } from "./utils/ztoolkit";

class Addon {
  public data: {
    alive: boolean;
    config: typeof pkg.config;
    env: "development" | "production";
    initialized?: boolean;
    ztoolkit: any;
  };
  public hooks: typeof hooks;
  public api: Record<string, any>;

  constructor() {
    this.data = {
      alive: true,
      config: pkg.config,
      env: __env__,
      initialized: false,
      ztoolkit: createZToolkit(),
    };
    this.hooks = hooks;
    this.api = {};
  }
}

export default Addon;
