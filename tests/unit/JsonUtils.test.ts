import { expect } from "chai";
import {
  safeParseJSON,
  prettyJSON,
  isPlainObject,
  isValidCSSVarKey,
  normalizeToStringMap,
} from "../../src/modules/utils/JsonUtils.js";

describe("JsonUtils", () => {
  describe("safeParseJSON", () => {
    it("should parse valid JSON", () => {
      const result = safeParseJSON('{"a":1}', {});
      expect(result.ok).to.be.true;
      expect(result.value).to.deep.equal({ a: 1 });
      expect(result.errorMessage).to.be.undefined;
    });

    it("should return fallback on invalid JSON", () => {
      const fallback = { default: true };
      const result = safeParseJSON("not json", fallback);
      expect(result.ok).to.be.false;
      expect(result.value).to.equal(fallback);
    });

    it("should include error message on failure", () => {
      const result = safeParseJSON("{bad}", {});
      expect(result.ok).to.be.false;
      expect(result.errorMessage).to.be.a("string");
      expect(result.errorMessage!.length).to.be.greaterThan(0);
    });
  });

  describe("prettyJSON", () => {
    it("should format a normal object", () => {
      const output = prettyJSON({ a: 1, b: 2 });
      expect(output).to.include('"a": 1');
      expect(output).to.include('"b": 2');
    });

    it("should return '{}' on stringify failure", () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      const output = prettyJSON(circular);
      expect(output).to.equal("{}");
    });
  });

  describe("isPlainObject", () => {
    it("should return false for null", () => {
      expect(isPlainObject(null)).to.be.false;
    });

    it("should return false for array", () => {
      expect(isPlainObject([1, 2, 3])).to.be.false;
    });

    it("should return true for plain object", () => {
      expect(isPlainObject({ a: 1 })).to.be.true;
    });

    it("should return true for Object.create(null)", () => {
      expect(isPlainObject(Object.create(null))).to.be.true;
    });

    it("should return false for Date", () => {
      expect(isPlainObject(new Date())).to.be.false;
    });

    it("should return false for number", () => {
      expect(isPlainObject(42)).to.be.false;
    });

    it("should return false for string", () => {
      expect(isPlainObject("hello")).to.be.false;
    });
  });

  describe("isValidCSSVarKey", () => {
    it("should accept valid names with hyphen", () => {
      expect(isValidCSSVarKey("ts-bg")).to.be.true;
    });

    it("should accept valid names with underscore", () => {
      expect(isValidCSSVarKey("ts_fg")).to.be.true;
    });

    it("should accept names starting with underscore", () => {
      expect(isValidCSSVarKey("_valid")).to.be.true;
    });

    it("should reject names starting with digit", () => {
      expect(isValidCSSVarKey("123abc")).to.be.false;
    });

    it("should reject empty string", () => {
      expect(isValidCSSVarKey("")).to.be.false;
    });

    it("should reject names with spaces", () => {
      expect(isValidCSSVarKey("has space")).to.be.false;
    });

    it("should reject names with special characters", () => {
      expect(isValidCSSVarKey("var@name")).to.be.false;
    });
  });

  describe("normalizeToStringMap", () => {
    it("should normalize a valid object", () => {
      const result = normalizeToStringMap({ "ts-bg": "#fff", count: 42 });
      expect(result.vars).to.deep.equal({ "ts-bg": "#fff", count: "42" });
      expect(result.errors).to.have.lengthOf(0);
    });

    it("should return error for non-object input", () => {
      const result = normalizeToStringMap("not an object");
      expect(result.vars).to.deep.equal({});
      expect(result.errors).to.have.lengthOf(1);
    });

    it("should filter invalid keys and report errors", () => {
      const result = normalizeToStringMap({ valid: "ok", "123bad": "nope" });
      expect(result.vars).to.deep.equal({ valid: "ok" });
      expect(result.errors).to.have.lengthOf(1);
      expect(result.errors[0]).to.include("123bad");
    });

    it("should coerce values to string", () => {
      const result = normalizeToStringMap({ num: 3.14, bool: true });
      expect(result.vars.num).to.equal("3.14");
      expect(result.vars.bool).to.equal("true");
    });
  });
});
