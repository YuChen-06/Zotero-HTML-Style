import { expect } from "chai";
import { PRESETS, THEME_ORDER, buildCSS } from "../../src/themes.js";

const EXPECTED_THEME_KEYS = [
  "light",
  "deep-night",
  "midnight",
  "beige",
  "green-dou",
  "lilac",
  "deep-beige",
];

const EXPECTED_VAR_KEYS = [
  "ts-bg",
  "ts-fg",
  "ts-link",
  "ts-code-bg",
  "ts-code-fg",
  "ts-border",
  "ts-muted",
  "ts-selection",
  "ts-font-size",
  "ts-line-height",
  "ts-paragraph-spacing",
];

describe("themes", function () {
  describe("PRESETS", function () {
    it("should contain all 7 themes", function () {
      for (const key of EXPECTED_THEME_KEYS) {
        expect(PRESETS).to.have.property(key);
      }
    });

    it("each theme should have all expected variable keys", function () {
      for (const key of EXPECTED_THEME_KEYS) {
        const theme = PRESETS[key as keyof typeof PRESETS];
        for (const varKey of EXPECTED_VAR_KEYS) {
          expect(theme).to.have.property(varKey);
        }
      }
    });
  });

  describe("THEME_ORDER", function () {
    it("should have correct length (7)", function () {
      expect(THEME_ORDER).to.have.lengthOf(7);
    });

    it("should contain all theme keys", function () {
      for (const key of EXPECTED_THEME_KEYS) {
        expect(THEME_ORDER).to.include(key);
      }
    });
  });

  describe("buildCSS", function () {
    let css: string;

    before(function () {
      css = buildCSS(PRESETS);
    });

    it("should contain all 7 theme class selectors", function () {
      for (const key of EXPECTED_THEME_KEYS) {
        expect(css).to.include(`html.theme-${key}`);
      }
    });

    it("should contain base styles", function () {
      expect(css).to.include(":root");
      expect(css).to.include("body");
      expect(css).to.include("::selection");
    });

    it("should use correct CSS variable format", function () {
      expect(css).to.include("--ts-bg:");
      expect(css).to.include("--ts-fg:");
      expect(css).to.include("--ts-font-size:");
    });
  });
});
