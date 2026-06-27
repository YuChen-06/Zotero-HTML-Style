import { expect } from "chai";
import { isHTMLDocument } from "../../src/modules/utils/DomGuards.js";

describe("DomGuards", function () {
  describe("isHTMLDocument", function () {
    it("should return true for HTML content type", function () {
      const doc = { contentType: "text/html" } as unknown as Document;
      expect(isHTMLDocument(doc)).to.be.true;
    });

    it("should return true for XHTML content type", function () {
      const doc = {
        contentType: "application/xhtml+xml",
      } as unknown as Document;
      expect(isHTMLDocument(doc)).to.be.true;
    });

    it("should be case insensitive", function () {
      const doc = { contentType: "Text/HTML" } as unknown as Document;
      expect(isHTMLDocument(doc)).to.be.true;
    });

    it("should return false for PDF content type", function () {
      const doc = { contentType: "application/pdf" } as unknown as Document;
      expect(isHTMLDocument(doc)).to.be.false;
    });

    it("should return false for EPUB content type", function () {
      const doc = {
        contentType: "application/epub+zip",
      } as unknown as Document;
      expect(isHTMLDocument(doc)).to.be.false;
    });

    it("should return false when contentType is undefined", function () {
      const doc = {} as unknown as Document;
      expect(isHTMLDocument(doc)).to.be.false;
    });
  });
});
