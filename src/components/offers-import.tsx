"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importOffersPhotosAction, importOffersTextAction } from "@/app/actions/stores";
import { uploadImages } from "./upload";
import { Button, Field, cx, inputCls } from "./ui";

export function OffersImport({ from, to, aiReady }: { from: string; to: string; aiReady: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<"text" | "photo">(aiReady ? "photo" : "text");
  const [validFrom, setFrom] = useState(from);
  const [validTo, setTo] = useState(to);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setMsg(null);
      try {
        const res =
          tab === "text"
            ? await importOffersTextAction(text, validFrom, validTo)
            : await importOffersPhotosAction(await uploadImages(files), validFrom, validTo);
        setMsg(res);
        if (res.ok) {
          setText("");
          setFiles([]);
          router.refresh();
        }
      } catch (e) {
        setMsg({ ok: false, message: (e as Error).message });
      }
    });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 rounded-lg border border-line bg-surface p-1 text-sm">
        {(["photo", "text"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={cx("rounded-md py-1.5 font-medium", tab === t ? "bg-accent text-accent-ink" : "text-muted")}>
            {t === "photo" ? "Leaflet photos" : "Paste text"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valid from">
          <input type="date" className={inputCls} value={validFrom} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Valid to">
          <input type="date" className={inputCls} value={validTo} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      {tab === "photo" ? (
        aiReady ? (
          <Field label="Leaflet pages" hint="Claude reads product, price and dates. Dates printed in the leaflet win over the ones above.">
            <input type="file" accept="image/*" multiple className={inputCls} onChange={(e) => setFiles([...(e.target.files ?? [])])} />
          </Field>
        ) : (
          <p className="text-sm text-warn">Photo reading needs ANTHROPIC_API_KEY. Paste the text instead.</p>
        )
      ) : (
        <Field
          label="Leaflet text"
          hint={aiReady ? "Paste anything; Claude structures it." : "One offer per line: “Kermaviili 10 % 200 g 0,49 €”. Parsed locally."}
        >
          <textarea className={inputCls} rows={6} value={text} onChange={(e) => setText(e.target.value)} data-testid="offers-text" />
        </Field>
      )}
      <Button type="button" onClick={submit} disabled={pending || (tab === "text" ? !text.trim() : !files.length || !aiReady)} data-testid="import-offers">
        {pending ? "Reading…" : "Add offers"}
      </Button>
      {msg ? <p className={cx("text-sm", msg.ok ? "text-accent" : "text-danger")}>{msg.message}</p> : null}
    </div>
  );
}
