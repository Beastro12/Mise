"use client";

import { useState, useTransition } from "react";
import { createHelperKeyAction, revokeHelperKeyAction } from "@/app/actions/helper";
import { Button } from "@/components/ui";

/** Create / replace / revoke the Mac helper's key. The key is shown once. */
export function HelperKey({ createdAt }: { createdAt: string | null }) {
  const [key, setKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const create = () =>
    start(async () => {
      if (createdAt && !confirm("Replace the current key? The Mac helper will need the new one.")) return;
      const r = await createHelperKeyAction();
      setKey(r.key);
      setCopied(false);
    });
  const revoke = () =>
    start(async () => {
      if (!confirm("Revoke the helper key? Product matching from the Mac stops until you create a new one.")) return;
      await revokeHelperKeyAction();
      setKey(null);
    });
  const copy = async () => {
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-3 text-sm" data-testid="helper-key">
      <p className="text-muted">
        {createdAt ? `A key is active (created ${new Date(createdAt).toLocaleDateString("fi-FI")}).` : "No key yet."} The key only lets the helper list items that need a
        product and save products you pick. It can&apos;t read anything else.
      </p>
      {key && (
        <div className="space-y-2">
          <p className="font-medium">Copy it now: it won&apos;t be shown again.</p>
          <pre className="overflow-x-auto rounded-2xl bg-primary p-3 text-xs text-primary-ink" data-testid="helper-key-value">
            {key}
          </pre>
          <Button type="button" variant="secondary" onClick={copy}>
            {copied ? "Copied" : "Copy key"}
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={create} disabled={pending} data-testid="create-helper-key">
          {createdAt ? "Replace key" : "Create helper key"}
        </Button>
        {createdAt && (
          <Button type="button" variant="danger" onClick={revoke} disabled={pending}>
            Revoke
          </Button>
        )}
      </div>
    </div>
  );
}
