"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importHealthAction, syncOuraAction } from "@/app/actions/nutrition";
import { AppleHealthParser, appleEmptyMessage, type DailyHealth } from "@/lib/health/apple";
import { ouraEmptyMessage, parseOuraDetailed } from "@/lib/health/oura";
import { decodeTextStream, zipEntryText } from "@/lib/health/zip";
import { Button, Field, cx, inputCls } from "./ui";

/** Only recent days are sent: plenty for weekly averages, and keeps the request small. */
const KEEP_DAYS = 120;

function sinceDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - KEEP_DAYS);
  return d.toISOString().slice(0, 10);
}

async function readApple(file: File, onProgress: (pct: number) => void): Promise<{ days: DailyHealth[]; parser: AppleHealthParser }> {
  let stream: ReadableStream<string> | null;
  let total = file.size;
  if (/\.zip$/i.test(file.name) || file.type.includes("zip")) {
    stream = await zipEntryText(file, (n) => /(^|\/)export\.xml$/.test(n));
    if (!stream) throw new Error("No export.xml inside this .zip. Pick the export.zip from Health → profile → Export All Health Data.");
    total = 0; // inflated size unknown; show record count instead
  } else {
    stream = decodeTextStream(file.stream());
  }
  const parser = new AppleHealthParser();
  const reader = stream.getReader();
  let read = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.push(value);
    read += value.length;
    onProgress(total ? Math.min(99, Math.round((read / total) * 100)) : -parser.records);
  }
  return { days: parser.result(sinceDate()), parser };
}

export function HealthImport({ ouraReady }: { ouraReady: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  const run = (label: string, job: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      setMsg(null);
      setBusy(label);
      try {
        const res = await job();
        setMsg(res);
        if (res.ok) router.refresh();
      } catch (e) {
        setMsg({ ok: false, message: (e as Error).message });
      } finally {
        setBusy(null);
      }
    });

  const onApple = (file: File | undefined) => {
    if (!file) return;
    run("Reading Apple Health…", async () => {
      const { days, parser } = await readApple(file, (p) => setBusy(p >= 0 ? `Reading Apple Health… ${p} %` : `Reading Apple Health… ${(-p).toLocaleString()} records`));
      if (!days.length) {
        const all = parser.result();
        return { ok: false, message: all.length ? "No energy, steps or weight records found in the last 120 days (all older than 120 days)." : appleEmptyMessage(parser) };
      }
      setBusy("Saving…");
      return importHealthAction("apple", days);
    });
  };

  const onOura = (file: File | undefined) => {
    if (!file) return;
    run("Reading Oura file…", async () => {
      const parsed = parseOuraDetailed(await file.text());
      const days = parsed.days.filter((d) => d.day >= sinceDate());
      if (!days.length) {
        return {
          ok: false,
          message: parsed.days.length
            ? "No daily activity rows found. Expected columns like day, total_calories, active_calories, steps (all older than 120 days)."
            : `${ouraEmptyMessage(parsed)}. Expected columns like day, total_calories, active_calories, steps.`,
        };
      }
      return importHealthAction("oura", days);
    });
  };

  return (
    <div className="space-y-5">
      <Field
        label="Apple Health export"
        hint={
          <>
            iPhone: Health → your picture → <b>Export All Health Data</b>, save to Files, then pick <b>export.zip</b> here (or the export.xml inside it). It is read on this device; only
            daily totals (energy, steps, weight) are sent.
          </>
        }
      >
        <input type="file" accept=".zip,.xml,application/zip,text/xml" className={inputCls} disabled={pending} onChange={(e) => onApple(e.target.files?.[0])} data-testid="apple-file" />
      </Field>
      <Field label="Oura export" hint="Oura web (membership hub) → export data: the daily activity file as CSV or JSON. Uses total calories burned per day.">
        <input type="file" accept=".csv,.json,text/csv,application/json" className={inputCls} disabled={pending} onChange={(e) => onOura(e.target.files?.[0])} data-testid="oura-file" />
      </Field>
      <div>
        <Button type="button" variant="secondary" disabled={pending || !ouraReady} onClick={() => run("Syncing Oura…", () => syncOuraAction())}>
          Sync Oura (last 30 days)
        </Button>
        {!ouraReady ? <p className="mt-1 text-xs text-muted">Needs OURA_ACCESS_TOKEN on the server. The file import above works without it.</p> : null}
      </div>
      {busy ? <p className="text-sm text-muted">{busy}</p> : null}
      {msg ? <p className={cx("text-sm", msg.ok ? "text-accent" : "text-danger")}>{msg.message}</p> : null}
    </div>
  );
}
