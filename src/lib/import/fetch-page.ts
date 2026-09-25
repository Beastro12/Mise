import { lookup } from "node:dns/promises";
import net from "node:net";
import { config } from "../env";

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 12_000;

/**
 * Addresses a server-side fetch must never reach: loopback, private, link-local
 * (cloud metadata), carrier-grade NAT, multicast, reserved and documentation
 * ranges. BlockList also matches IPv4-mapped IPv6 forms such as ::ffff:a9fe:a9fe.
 */
const BLOCKED = new net.BlockList();
for (const [net4, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) BLOCKED.addSubnet(net4, prefix, "ipv4");
for (const [net6, prefix] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["100::", 64], ["2001:db8::", 32], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) BLOCKED.addSubnet(net6, prefix, "ipv6");

export function isPrivateIp(ip: string): boolean {
  const family = net.isIPv4(ip) ? "ipv4" : net.isIPv6(ip) ? "ipv6" : null;
  return family === null || BLOCKED.check(ip, family);
}

async function assertPublicUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http(s) links can be imported.");
  if (config.allowPrivateFetch) return;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error("That address points to a private network and can't be fetched.");
}

export type FetchedPage = { html: string; finalUrl: string };

/** Fetch an HTML page with timeout, size cap, SSRF guard and manual redirects. */
export async function fetchPage(input: string): Promise<FetchedPage> {
  let url = new URL(input);
  for (let hop = 0; hop < 5; hop++) {
    await assertPublicUrl(url);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; Aitta/1.0; personal recipe import)",
          accept: "text/html,application/xhtml+xml",
          "accept-language": "fi,en;q=0.8",
        },
      });
    } catch (e) {
      clearTimeout(timer);
      throw new Error(`Could not fetch the page (${(e as Error).name === "AbortError" ? "timed out" : (e as Error).message}).`);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      clearTimeout(timer);
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    if (!res.ok) {
      clearTimeout(timer);
      throw new Error(`The site answered HTTP ${res.status}.`);
    }
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) {
          ctrl.abort();
          break;
        }
        chunks.push(value);
      }
    }
    clearTimeout(timer);
    const html = new TextDecoder("utf-8").decode(Buffer.concat(chunks));
    return { html, finalUrl: url.toString() };
  }
  throw new Error("Too many redirects.");
}

const IMAGE_MAX = 6 * 1024 * 1024;

/** Download a recipe photo (same safety rules as pages). Returns null on any problem. */
export async function fetchImage(input: string): Promise<{ data: Buffer; mime: string; filename: string } | null> {
  // One deadline for all hops and the body, so a slow server can't hold the request open.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let url = new URL(input);
    let res: Response | null = null;
    for (let hop = 0; hop < 4; hop++) {
      await assertPublicUrl(url); // re-checked on every redirect hop
      res = await fetch(url, { signal: ctrl.signal, redirect: "manual", headers: { accept: "image/webp,image/jpeg,image/png,image/*" } });
      const loc = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && loc) {
        url = new URL(loc, url);
        res = null;
        continue;
      }
      break;
    }
    if (!res) return null;
    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!res.ok || !/^image\/(jpeg|png|webp|gif)$/.test(mime)) return null;
    if (Number(res.headers.get("content-length") ?? 0) > IMAGE_MAX) return null;
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = res.body?.getReader();
    if (!reader) return null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > IMAGE_MAX) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const buf = Buffer.concat(chunks);
    if (buf.byteLength < 200) return null;
    const ext = mime.split("/")[1].replace("jpeg", "jpg");
    return { data: buf, mime, filename: `recipe-photo.${ext}` };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
