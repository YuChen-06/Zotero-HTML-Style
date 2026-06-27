import { expect } from "chai";
import {
  safeParseJSON,
  prettyJSON,
  normalizeToStringMap,
} from "../../src/modules/utils/JsonUtils.js";

describe("JsonUtils", function () {
  describe("safeParseJSON", function () {
    it("should parse valid JSON", function () {
      const result = safeParseJSON('{"a":1}', {});
      expect(result.ok).to.be.true;
      expect(result.value).to.deep.equal({ a: 1 });
      expect(result.errorMessage).to.be.undefined;
    });

    it("should return fallback on invalid JSON", function () {
      const fallback = { default: true };
      const result = safeParseJSON("not json", fallback);
      expect(result.ok).to.be.false;
      expect(result.value).to.equal(fallback);
    });

    it("should include error message on failure", function () {
      const result = safeParseJSON("{bad}", {});
      expect(result.ok).to.be.false;
      expect(result.errorMessage).to.be.a("string");
      expect(result.errorMessage!.length).to.be.greaterThan(0);
    });
  });

  describe("prettyJSON", function () {
    it("should format a normal object", function () {
      const output = prettyJSON({ a: 1, b: 2 });
      expect(output).to.include('"a": 1');
      expect(output).to.include('"b": 2');
    });

    it("should return '{}' on stringify failure", function () {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      const output = prettyJSON(circular);
      expect(output).to.equal("{}");
    });
  });

  describe("normalizeToStringMap", function () {
    it("should normalize a valid object", function () {
      const result = normalizeToStringMap({ "ts-bg": "#fff", count: 42 });
      expect(result.vars).to.deep.equal({ "ts-bg": "#fff", count: "42" });
      expect(result.errors).to.have.lengthOf(0);
    });

    it("should return error for non-object input", function () {
      const result = normalizeToStringMap("not an object");
      expect(result.vars).to.deep.equal({});
      expect(result.errors).to.have.lengthOf(1);
    });

    it("should reject null", function () {
      const result = normalizeToStringMap(null);
      expect(result.vars).to.deep.equal({});
      expect(result.errors).to.have.lengthOf(1);
    });

    it("should reject array", function () {
      const result = normalizeToStringMap([1, 2, 3]);
      expect(result.vars).to.deep.equal({});
      expect(result.errors).to.have.lengthOf(1);
    });

    it("should filter invalid keys and report errors", function () {
      const result = normalizeToStringMap({ valid: "ok", "123bad": "nope" });
      expect(result.vars).to.deep.equal({ valid: "ok" });
      expect(result.errors).to.have.lengthOf(1);
      expect(result.errors[0]).to.include("123bad");
    });

    it("should coerce values to string", function () {
      const result = normalizeToStringMap({ num: 3.14, bool: true });
      expect(result.vars.num).to.equal("3.14");
      expect(result.vars.bool).to.equal("true");
    });

    it("should accept valid names with hyphen", function () {
      const result = normalizeToStringMap({ "ts-bg": "#fff" });
      expect(result.errors).to.have.lengthOf(0);
    });

    it("should reject names with spaces", function () {
      const result = normalizeToStringMap({ "has space": "val" });
      expect(result.vars).to.deep.equal({});
      expect(result.errors).to.have.lengthOf(1);
    });

    it("should accept Object.create(null)", function () {
      const obj = Object.create(null);
      obj["ts-bg"] = "#fff";
      const result = normalizeToStringMap(obj);
      expect(result.vars).to.deep.equal({ "ts-bg": "#fff" });
      expect(result.errors).to.have.lengthOf(0);
    });
  });
});
