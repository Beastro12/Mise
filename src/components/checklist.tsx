"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ClientItem, ClientList } from "@/lib/client-list";
import { groupForDisplay } from "@/lib/domain/list-builder";
import { SECTIONS } from "@/lib/domain/sections";
import { formatQty } from "@/lib/domain/units";
import { formatPrice } from "@/lib/domain/offers";
import { Badge, btn, cx, inputCls } from "./ui";

type Mode = "owner" | "share";
type QueueEntry = { itemId: string; checked: boolean };

const POLL_MS = 4000;

function readJson<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function writeJson(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage full or blocked: ignore */
  }
}

function applyQueue(list: ClientList, queue: QueueEntry[]): ClientList {
  if (!queue.length) return list;
  const m = new Map(queue.map((q) => [q.itemId, q.checked]));
  return { ...list, items: list.items.map((i) => (m.has(i.id) ? { ...i, checked: m.get(i.id)! } : i)) };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Checklist({ initial, mode, token }: { initial: ClientList; mode: Mode; token?: string }) {
  const base = mode === "owner" ? `/api/lists/${initial.id}` : `/api/share/${token}`;
  const snapKey = `mise:list:${initial.id}`;
  const queueKey = `mise:queue:${initial.id}`;

  const [list, setList] = useState<ClientList>(initial);
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [showCovered, setShowCovered] = useState(false);
  const [newItem, setNewItem] = useState("");
  const flushing = useRef(false);
  const listRef = useRef(list);
  useEffect(() => {
    listRef.current = list;
  }, [list]);

  const getQueue = useCallback(() => readJson<QueueEntry[]>(queueKey) ?? [], [queueKey]);
  const setQueue = useCallback(
    (q: QueueEntry[]) => {
      writeJson(queueKey, q);
      setPendingCount(q.length);
    },
    [queueKey],
  );

  const commit = useCallback(
    (next: ClientList) => {
      setList(next);
      writeJson(snapKey, next);
    },
    [snapKey],
  );

  const refetch = useCallback(async () => {
    const res = await fetch(base, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const fresh = (await res.json()) as ClientList;
    commit(applyQueue(fresh, getQueue()));
  }, [base, commit, getQueue]);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      let q = getQueue();
      while (q.length) {
        const e = q[0];
        let res: Response;
        try {
          res = await fetch(`${base}/items/${e.itemId}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "check", checked: e.checked }),
          });
        } catch {
          setOnline(false);
          return; // still offline; keep the queue
        }
        if (res.status >= 500) return;
        // 2xx done; 4xx (item removed meanwhile) is dropped
        q = getQueue().filter((x) => !(x.itemId === e.itemId && x.checked === e.checked));
        setQueue(q);
      }
    } finally {
      flushing.current = false;
    }
  }, [base, getQueue, setQueue]);

  // Mount: restore snapshot + pending queue (offline reloads), then sync.
  // localStorage is only readable after hydration, so this effect syncs React
  // state from that external store once.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const snap = readJson<ClientList>(snapKey);
    const q = getQueue();
    setPendingCount(q.length);
    const start = snap && snap.id === initial.id && snap.version > initial.version ? snap : initial;
    commit(applyQueue(start, q));
    setOnline(navigator.onLine);
    flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Poll for spouse's check-offs and list changes.
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (stop || document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`${base}/state`, { cache: "no-store" });
        if (!res.ok) return;
        setOnline(true);
        const s = (await res.json()) as { version: number };
        await flush();
        if (s.version !== listRef.current.version) await refetch();
      } catch {
        setOnline(false);
      }
    };
    const id = setInterval(tick, POLL_MS);
    const onOnline = () => {
      setOnline(true);
      tick();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", tick);
    return () => {
      stop = true;
      clearInterval(id);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [base, flush, refetch]);

  function toggle(item: ClientItem) {
    const checked = !item.checked;
    commit({ ...list, items: list.items.map((i) => (i.id === item.id ? { ...i, checked } : i)) });
    setQueue([...getQueue().filter((q) => q.itemId !== item.id), { itemId: item.id, checked }]);
    flush();
  }

  async function ownerCall(url: string, body: unknown, okMsg?: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as { error?: string; moved?: number };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      await refetch();
      if (okMsg) setMessage(okMsg.replace("{n}", String(json.moved ?? "")));
    } catch (e) {
      setMessage(navigator.onLine ? (e as Error).message : "You're offline: this needs a connection. Check-offs still work offline.");
    } finally {
      setBusy(false);
    }
  }

  const buy = list.items.filter((i) => i.state === "none" || (mode === "share" && i.state === "ask"));
  const ask = mode === "owner" ? list.items.filter((i) => i.state === "ask") : [];
  const covered = list.items.filter((i) => i.state === "covered" || i.state === "have");
  const groups = useMemo(() => groupForDisplay(buy, list.sectionOrder), [buy, list.sectionOrder]);
  const checkedToPantry = list.items.filter((i) => i.checked && !i.movedToPantry).length;
  const storeName = (id: string) => list.stores.find((s) => s.id === id)?.name ?? (id === "lidl" ? "Lidl" : "S-market");
  const done = buy.filter((i) => i.checked).length;
  const shareUrl = typeof window !== "undefined" && list.shareToken ? `${window.location.origin}/share/${list.shareToken}` : null;

  async function share() {
    if (!shareUrl) return;
    try {
      if (navigator.share) await navigator.share({ title: list.name, url: shareUrl });
      else {
        await navigator.clipboard.writeText(shareUrl);
        setMessage("Share link copied.");
      }
    } catch {
      setMessage(shareUrl);
    }
  }

  return (
    <div data-testid="checklist">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="tabular text-muted" data-testid="progress">
          {done}/{buy.length} in cart
        </span>
        {online ? <Badge tone="accent">online</Badge> : <Badge tone="warn">offline</Badge>}
        {pendingCount ? <Badge tone="warn">{pendingCount} to sync</Badge> : null}
      </div>

      {mode === "owner" ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            className={btn.primary}
            disabled={busy || !checkedToPantry}
            onClick={() => ownerCall(base, { action: "toPantry" }, "Moved {n} item(s) to the pantry.")}
            data-testid="to-pantry"
          >
            Checked → pantry{checkedToPantry ? ` (${checkedToPantry})` : ""}
          </button>
          <button className={btn.secondary} onClick={share} disabled={!shareUrl}>
            Share
          </button>
          <a className={btn.secondary} href={`${base}/export`} data-testid="export">
            Export S-market JSON
          </a>
          {list.planId ? (
            <Link className={btn.ghost} href={`/plan/${list.planId}`}>
              Plan
            </Link>
          ) : null}
        </div>
      ) : null}
      {message ? <p className="mb-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent" data-testid="list-message">{message}</p> : null}

      {ask.length ? (
        <div className="mb-4 rounded-xl border border-line bg-warn-soft/50 p-3" data-testid="have-it">
          <div className="mb-2 text-sm font-semibold">Have it?</div>
          <ul className="space-y-1.5">
            {ask.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2">
                <span className="text-sm">
                  {cap(i.displayName)} <span className="text-muted">{formatQty(i)}</span>
                </span>
                <span className="flex gap-1">
                  <button className={btn.small} disabled={busy} onClick={() => ownerCall(`${base}/items/${i.id}`, { action: "staple", have: true })}>
                    Have it
                  </button>
                  <button className={btn.small} disabled={busy} onClick={() => ownerCall(`${base}/items/${i.id}`, { action: "staple", have: false })}>
                    Need it
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {groups.length === 0 ? <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">Nothing to buy.</p> : null}

      {groups.map((g) => (
        <section key={g.storeId} className="mb-6" data-testid={`store-${g.storeId}`}>
          <h2 className={cx("mb-2 flex items-center justify-between rounded-lg px-3 py-2 font-semibold", g.storeId === "lidl" ? "bg-lidl-soft text-lidl" : "bg-smarket-soft text-smarket")}>
            <span>{storeName(g.storeId)}</span>
            <span className="text-xs font-medium tabular">{g.sections.reduce((n, s) => n + s.items.length, 0)} items</span>
          </h2>
          {g.sections.map((s) => (
            <div key={s.key} className="mb-3" data-testid={`section-${g.storeId}-${s.key}`}>
              <div className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">{SECTIONS.find((x) => x.key === s.key)?.fi}</div>
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {s.items.map((i) => (
                  <Row
                    key={i.id}
                    item={i}
                    mode={mode}
                    open={open === i.id}
                    busy={busy}
                    listId={list.id}
                    onToggle={() => toggle(i)}
                    onOpen={() => setOpen(open === i.id ? null : i.id)}
                    onStore={(storeId, remember) => ownerCall(`${base}/items/${i.id}`, { action: "store", storeId, remember })}
                    onDelete={() => ownerCall(`${base}/items/${i.id}`, { action: "delete" })}
                  />
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}

      {mode === "owner" ? (
        <form
          className="mb-6 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newItem.trim()) return;
            ownerCall(base, { action: "add", text: newItem }).then(() => setNewItem(""));
          }}
        >
          <input className={inputCls} placeholder="Add item, e.g. 1 l maitoa" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
          <button className={btn.secondary} disabled={busy}>
            Add
          </button>
        </form>
      ) : null}

      {covered.length ? (
        <div className="mb-6">
          <button className="text-sm text-muted underline" onClick={() => setShowCovered((v) => !v)}>
            {showCovered ? "Hide" : "Show"} {covered.length} covered by pantry
          </button>
          {showCovered ? (
            <ul className="mt-2 space-y-1 text-sm text-muted">
              {covered.map((i) => (
                <li key={i.id}>
                  {cap(i.displayName)} {formatQty(i)} {i.note ? `· ${i.note}` : i.state === "have" ? "· you have it" : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Row({
  item: i,
  mode,
  open,
  busy,
  listId,
  onToggle,
  onOpen,
  onStore,
  onDelete,
}: {
  item: ClientItem;
  mode: Mode;
  open: boolean;
  busy: boolean;
  listId: string;
  onToggle: () => void;
  onOpen: () => void;
  onStore: (storeId: "smarket" | "lidl", remember: boolean) => void;
  onDelete: () => void;
}) {
  const other = i.storeId === "lidl" ? "smarket" : "lidl";
  const otherName = other === "lidl" ? "Lidl" : "S-market";
  const total = i.price != null ? i.price * (i.packs ?? 1) : null;
  return (
    <li data-testid="list-item" data-name={i.nameFi} data-checked={i.checked ? "1" : "0"}>
      <div className="flex items-stretch">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-start gap-3 px-3 py-2.5 text-left" aria-pressed={i.checked}>
          <span
            className={cx(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
              i.checked ? "border-accent bg-accent text-accent-ink" : "border-line",
            )}
            aria-hidden
          >
            {i.checked ? "✓" : ""}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className={cx("font-medium", i.checked && "text-muted line-through")}>{cap(i.displayName)}</span>
              <span className={cx("shrink-0 tabular text-sm", i.checked && "text-muted")}>{formatQty(i) || "as needed"}</span>
            </span>
            {i.product || i.packs ? (
              <span className="block text-xs text-muted">
                {i.packs ? `${i.packs} × ` : ""}
                {i.product?.name ?? ""}
                {i.product?.source === "mock" ? " (MOCK)" : ""}
                {total != null ? ` · ${formatPrice(total)}` : ""}
              </span>
            ) : null}
            {i.storeReason ? (
              <span className={cx("block text-xs", i.storeId === "lidl" ? "text-lidl" : "text-smarket")} data-testid="store-reason">
                {i.storeReason}
              </span>
            ) : null}
            {i.note ? <span className="block text-xs text-warn">{i.note}</span> : null}
          </span>
        </button>
        {mode === "owner" ? (
          <button type="button" onClick={onOpen} className="px-3 text-muted" aria-label="Item options" data-testid="item-options">
            ⋯
          </button>
        ) : null}
      </div>
      {open && mode === "owner" ? (
        <div className="space-y-2 border-t border-line bg-bg px-3 py-2 text-sm">
          {i.sources.length ? <div className="text-xs text-muted">For: {i.sources.join(", ")}</div> : null}
          <div className="flex flex-wrap gap-1.5">
            <button className={btn.small} disabled={busy} onClick={() => onStore(other, false)} data-testid="move-store">
              Buy at {otherName}
            </button>
            <button className={btn.small} disabled={busy} onClick={() => onStore(other, true)}>
              Always buy {i.nameFi} at {otherName}
            </button>
            {i.storeOverridden ? (
              <button className={btn.small} disabled={busy} onClick={() => onStore(i.storeId, true)}>
                Remember {i.storeId === "lidl" ? "Lidl" : "S-market"} for {i.nameFi}
              </button>
            ) : null}
            {i.storeId === "smarket" ? (
              <Link className={btn.small} href={`/products?name=${encodeURIComponent(i.nameFi)}&return=${encodeURIComponent(`/list/${listId}`)}`}>
                {i.product ? "Change product" : "Match product"}
              </Link>
            ) : null}
            <button className={cx(btn.small, "text-danger")} disabled={busy} onClick={onDelete}>
              Remove
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
