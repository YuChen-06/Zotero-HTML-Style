import { expect } from "chai";
import { createLogger } from "../../src/modules/utils/Logger.js";

describe("Logger", function () {
  it("should create a logger with all methods", function () {
    const log = createLogger("Test");
    expect(log).to.have.property("debug").that.is.a("function");
    expect(log).to.have.property("info").that.is.a("function");
    expect(log).to.have.property("warn").that.is.a("function");
    expect(log).to.have.property("error").that.is.a("function");
  });

  it("should not throw when calling methods", function () {
    const log = createLogger("Test");
    expect(() => log.debug("test")).to.not.throw();
    expect(() => log.info("test")).to.not.throw();
    expect(() => log.warn("test")).to.not.throw();
    expect(() => log.error("test")).to.not.throw();
  });
});
