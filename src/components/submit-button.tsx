"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";

/** Submit button that disables itself while its form's action runs, so a double tap can't save twice. */
export function SubmitButton({ pendingText, children, ...p }: ComponentProps<"button"> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || p.disabled} aria-disabled={pending || p.disabled} {...p}>
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
