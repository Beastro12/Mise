"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importFileAction, importPhotosAction, importUrlAction, startManualAction } from "@/app/actions/recipes";
import { uploadFile, uploadImages } from "./upload";
import { Button, Field, Notice, cx, inputCls } from "./ui";

const TABS = ["Link", "Photos", "File", "Manual"] as const;
type Tab = (typeof TABS)[number];

export function ImportTabs({ aiReady }: { aiReady: boolean }) {
  const [tab, setTab] = useState<Tab>("Link");
  return (
    <div>
      <div className="mb-4 grid grid-cols-4 rounded-lg border border-line bg-surface p-1 text-sm" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cx("rounded-md py-1.5 font-medium", tab === t ? "bg-accent text-accent-ink" : "text-muted")}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Link" && <UrlForm aiReady={aiReady} />}
      {tab === "Photos" && <PhotoForm aiReady={aiReady} />}
      {tab === "File" && <FileForm aiReady={aiReady} />}
      {tab === "Manual" && (
        <form action={startManualAction} className="space-y-3">
          <p className="text-sm text-muted">Type a recipe in yourself. You can paste all ingredient lines at once.</p>
          <Button type="submit">Start blank recipe</Button>
        </form>
      )}
    </div>
  );
}

function useImport() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: true; data?: string } | { ok: false; error: string }>, label: string) => {
    setError(null);
    setStatus(label);
    start(async () => {
      try {
        const res = await fn();
        if (!res.ok) {
          setError(res.error);
          setStatus(null);
          return;
        }
        router.push(`/recipes/import/${res.data}`);
      } catch (e) {
        setError((e as Error).message);
        setStatus(null);
      }
    });
  };
  return { error, status, pending, run, setStatus };
}

function UrlForm({ aiReady }: { aiReady: boolean }) {
  const [url, setUrl] = useState("");
  const { error, status, pending, run } = useImport();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => importUrlAction(url), "Fetching the page…");
      }}
    >
      <Field
        label="Recipe web page"
        hint={
          aiReady
            ? "Reads the page's schema.org recipe data; falls back to Claude on the page text."
            : "Reads the page's schema.org recipe data. (Claude fallback off: no API key.)"
        }
      >
        <input className={inputCls} type="url" inputMode="url" required placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} name="url" />
      </Field>
      <Button type="submit" disabled={pending || !url}>
        {pending ? status : "Import"}
      </Button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </form>
  );
}

function PhotoForm({ aiReady }: { aiReady: boolean }) {
  const [files, setFiles] = useState<File[]>([]);
  const { error, status, pending, run, setStatus } = useImport();
  if (!aiReady) return <Notice>Photo import needs Claude. Set ANTHROPIC_API_KEY on the server.</Notice>;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          const ids = await uploadImages(files, (n) => setStatus(`Uploading ${n}/${files.length}…`));
          setStatus("Claude is reading the pages…");
          return importPhotosAction(ids);
        }, "Preparing photos…");
      }}
    >
      <Field label="Cookbook pages" hint="Several photos may belong to one recipe, or one photo may hold several recipes: Claude sorts it out and you review each.">
        <input
          className={inputCls}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles([...(e.target.files ?? [])])}
          data-testid="photo-input"
        />
      </Field>
      {files.length ? <p className="text-sm text-muted">{files.length} photo(s) selected</p> : null}
      <Button type="submit" disabled={pending || !files.length}>
        {pending ? status : "Extract recipes"}
      </Button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </form>
  );
}

function FileForm({ aiReady }: { aiReady: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const { error, status, pending, run, setStatus } = useImport();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!file) return;
        run(async () => {
          const id = await uploadFile(file, file.name);
          setStatus(aiReady ? "Claude is reading the file…" : "Parsing…");
          return importFileAction(id);
        }, "Uploading…");
      }}
    >
      <Field
        label="PDF, Word (.docx), .txt or .md"
        hint={aiReady ? "One file may contain many recipes; each becomes its own draft." : "Without Claude a local parser splits recipes by headings (best effort)."}
      >
        <input
          className={inputCls}
          type="file"
          accept=".pdf,.docx,.txt,.md,.markdown,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          data-testid="file-input"
        />
      </Field>
      <Button type="submit" disabled={pending || !file}>
        {pending ? status : "Import file"}
      </Button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </form>
  );
}
