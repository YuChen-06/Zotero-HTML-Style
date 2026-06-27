import pkg from "../package.json";
import hooks from "./hooks";

class Addon {
  public data: {
    config: typeof pkg.config;
    env: "development" | "production";
    initialized?: boolean;
  };
  public hooks: typeof hooks;
  public api: Record<string, any>;

  constructor() {
    this.data = {
      config: pkg.config,
      env: __env__,
      initialized: false,
    };
    this.hooks = hooks;
    this.api = {};
  }
}

export default Addon;
