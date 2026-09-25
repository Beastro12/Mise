import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({}));

const { isPrivateIp } = await import("@/lib/import/fetch-page");
const { addFailure, isLocked, LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS } = await import("@/lib/login-throttle");

describe("URL import: private address guard", () => {
  it("blocks loopback, private, link-local, CGNAT and reserved ranges", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("blocks IPv6 private forms, including IPv4-mapped addresses as URLs normalise them", () => {
    for (const host of ["[::1]", "[fd00::1]", "[fe80::1]", "[::ffff:169.254.169.254]", "[::ffff:10.0.0.1]", "[64:ff9b::a9fe:a9fe]"]) {
      const ip = new URL(`http://${host}/`).hostname.replace(/^\[|\]$/g, "");
      expect(isPrivateIp(ip), host).toBe(true);
    }
  });

  it("allows public addresses and rejects non-IPs", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("2a00:1450:4010:c05::8b")).toBe(false);
    expect(isPrivateIp("::ffff:8.8.8.8")).toBe(false);
    expect(isPrivateIp("not-an-ip")).toBe(true);
  });
});

describe("login attempt limit", () => {
  it("locks after the maximum failures within the window, then unlocks", () => {
    let s = null as ReturnType<typeof addFailure> | null;
    const t0 = 1_000_000;
    for (let i = 0; i < LOGIN_MAX_FAILURES - 1; i++) s = addFailure(s, t0 + i);
    expect(isLocked(s, t0 + 100)).toBe(false);
    s = addFailure(s, t0 + 200);
    expect(isLocked(s, t0 + 300)).toBe(true);
    expect(isLocked(s, t0 + LOGIN_WINDOW_MS)).toBe(false);
  });

  it("starts a new window after the old one ends", () => {
    const s = addFailure({ count: 9, since: 0 }, LOGIN_WINDOW_MS + 1);
    expect(s).toEqual({ count: 1, since: LOGIN_WINDOW_MS + 1 });
  });
});
