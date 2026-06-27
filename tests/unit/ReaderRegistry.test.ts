import { expect } from "chai";
import { ReaderRegistry } from "../../src/modules/reader/ReaderRegistry.js";
import type { ZoteroReaderInstance } from "../../src/modules/reader/ReaderAdapter.js";

function makeReader(): ZoteroReaderInstance {
  return { _iframeWindow: undefined };
}

describe("ReaderRegistry", function () {
  it("should register and iterate readers", function () {
    const reg = new ReaderRegistry();
    const r1 = makeReader();
    const r2 = makeReader();
    reg.register(r1);
    reg.register(r2);

    const found: ZoteroReaderInstance[] = [];
    reg.forEachAlive((r) => found.push(r));
    expect(found).to.have.lengthOf(2);
  });

  it("should deduplicate registrations", function () {
    const reg = new ReaderRegistry();
    const r1 = makeReader();
    reg.register(r1);
    reg.register(r1);

    const found: ZoteroReaderInstance[] = [];
    reg.forEachAlive((r) => found.push(r));
    expect(found).to.have.lengthOf(1);
  });

  it("should handle errors in forEachAlive callback", function () {
    const reg = new ReaderRegistry();
    const r1 = makeReader();
    const r2 = makeReader();
    reg.register(r1);
    reg.register(r2);

    const found: ZoteroReaderInstance[] = [];
    reg.forEachAlive((r) => {
      if (r === r1) throw new Error("test");
      found.push(r);
    });
    expect(found).to.have.lengthOf(1);
    expect(found[0]).to.equal(r2);
  });

  it("compact should remove dead refs", function () {
    const reg = new ReaderRegistry();
    const r1 = makeReader();
    reg.register(r1);
    reg.compact();

    const found: ZoteroReaderInstance[] = [];
    reg.forEachAlive((r) => found.push(r));
    expect(found).to.have.lengthOf(1);
  });
});
