import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_EMAIL_KEY,
  forgetAdminEmail,
  readRememberedAdminEmail,
  rememberAdminEmail,
  subscribeRememberedAdminEmail,
} from "./remembered-admin-email";

function fakeWindow(store: Map<string, string>, broken = false) {
  const target = new EventTarget();
  const localStorage = {
    getItem: (k: string) => {
      if (broken) throw new Error("blocked");
      return store.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (broken) throw new Error("blocked");
      store.set(k, v);
    },
    removeItem: (k: string) => {
      if (broken) throw new Error("blocked");
      store.delete(k);
    },
  };
  return Object.assign(target, { localStorage });
}

describe("remembered admin e-mail", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("window", fakeWindow(store));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("nothing remembered by default", () => {
    expect(readRememberedAdminEmail()).toBeNull();
  });

  it("remembers a valid address, trimmed and lower-cased, and notifies", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeRememberedAdminEmail(onChange);
    rememberAdminEmail("  Admin@Example.TEST ");
    expect(readRememberedAdminEmail()).toBe("admin@example.test");
    expect(onChange).toHaveBeenCalledTimes(1);
    unsubscribe();
    forgetAdminEmail();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("ignores invalid input and tampered storage", () => {
    rememberAdminEmail("not-an-email");
    expect(store.size).toBe(0);
    store.set(ADMIN_EMAIL_KEY, "<script>");
    expect(readRememberedAdminEmail()).toBeNull();
    store.set(ADMIN_EMAIL_KEY, `${"a".repeat(250)}@b.cd`);
    expect(readRememberedAdminEmail()).toBeNull();
  });

  it("forget clears it", () => {
    rememberAdminEmail("admin@example.test");
    forgetAdminEmail();
    expect(readRememberedAdminEmail()).toBeNull();
  });

  it("blocked storage means nothing remembered, without throwing", () => {
    vi.stubGlobal("window", fakeWindow(store, true));
    expect(() => rememberAdminEmail("admin@example.test")).not.toThrow();
    expect(readRememberedAdminEmail()).toBeNull();
    expect(() => forgetAdminEmail()).not.toThrow();
  });

  it("on the server: no window, no-op", () => {
    vi.unstubAllGlobals();
    expect(readRememberedAdminEmail()).toBeNull();
    expect(() => rememberAdminEmail("admin@example.test")).not.toThrow();
    expect(subscribeRememberedAdminEmail(() => undefined)).toBeTypeOf("function");
  });
});
