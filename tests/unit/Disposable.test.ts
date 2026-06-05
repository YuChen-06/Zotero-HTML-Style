import { expect } from "chai";
import {
  FunctionDisposable,
  NoopDisposable,
  CompositeDisposable,
  toDisposable,
} from "../../src/modules/utils/Disposable.js";

describe("Disposable", () => {
  describe("FunctionDisposable", () => {
    it("should call the function on dispose", () => {
      let called = false;
      const d = new FunctionDisposable(() => {
        called = true;
      });
      d.dispose();
      expect(called).to.be.true;
    });

    it("should be idempotent (second call is no-op)", () => {
      let callCount = 0;
      const d = new FunctionDisposable(() => {
        callCount++;
      });
      d.dispose();
      d.dispose();
      expect(callCount).to.equal(1);
    });
  });

  describe("NoopDisposable", () => {
    it("should not throw on dispose", () => {
      const d = new NoopDisposable();
      expect(() => d.dispose()).to.not.throw();
    });
  });

  describe("CompositeDisposable", () => {
    it("should dispose in LIFO order", () => {
      const order: number[] = [];
      const composite = new CompositeDisposable();
      composite.add({ dispose: () => order.push(1) });
      composite.add({ dispose: () => order.push(2) });
      composite.add({ dispose: () => order.push(3) });
      composite.dispose();
      expect(order).to.deep.equal([3, 2, 1]);
    });

    it("should auto-dispose items added after dispose", () => {
      const composite = new CompositeDisposable();
      composite.dispose();

      let called = false;
      composite.add({
        dispose: () => {
          called = true;
        },
      });
      expect(called).to.be.true;
    });

    it("should be idempotent on dispose", () => {
      let callCount = 0;
      const composite = new CompositeDisposable();
      composite.add({
        dispose: () => {
          callCount++;
        },
      });
      composite.dispose();
      composite.dispose();
      expect(callCount).to.equal(1);
    });
  });

  describe("toDisposable", () => {
    it("should return a FunctionDisposable", () => {
      let called = false;
      const d = toDisposable(() => {
        called = true;
      });
      d.dispose();
      expect(called).to.be.true;
    });
  });
});
