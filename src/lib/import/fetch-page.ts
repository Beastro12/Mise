import { lookup } from "node:dns/promises";
import net from "node:net";
import { config } from "../env";

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 12_000;

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:127.");
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
