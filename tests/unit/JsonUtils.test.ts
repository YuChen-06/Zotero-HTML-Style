import { expect } from "chai";
import {
  safeParseJSON,
  prettyJSON,
  isPlainObject,
  isValidCSSVarKey,
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

  describe("isPlainObject", function () {
    it("should return false for null", function () {
      expect(isPlainObject(null)).to.be.false;
    });

    it("should return false for array", function () {
      expect(isPlainObject([1, 2, 3])).to.be.false;
    });

    it("should return true for plain object", function () {
      expect(isPlainObject({ a: 1 })).to.be.true;
    });

    it("should return true for Object.create(null)", function () {
      expect(isPlainObject(Object.create(null))).to.be.true;
    });

    it("should return false for Date", function () {
      expect(isPlainObject(new Date())).to.be.false;
    });

    it("should return false for number", function () {
      expect(isPlainObject(42)).to.be.false;
    });

    it("should return false for string", function () {
      expect(isPlainObject("hello")).to.be.false;
    });
  });

  describe("isValidCSSVarKey", function () {
    it("should accept valid names with hyphen", function () {
      expect(isValidCSSVarKey("ts-bg")).to.be.true;
    });

    it("should accept valid names with underscore", function () {
      expect(isValidCSSVarKey("ts_fg")).to.be.true;
    });

    it("should accept names starting with underscore", function () {
      expect(isValidCSSVarKey("_valid")).to.be.true;
    });

    it("should reject names starting with digit", function () {
      expect(isValidCSSVarKey("123abc")).to.be.false;
    });

    it("should reject empty string", function () {
      expect(isValidCSSVarKey("")).to.be.false;
    });

    it("should reject names with spaces", function () {
      expect(isValidCSSVarKey("has space")).to.be.false;
    });

    it("should reject names with special characters", function () {
      expect(isValidCSSVarKey("var@name")).to.be.false;
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
  });
});
