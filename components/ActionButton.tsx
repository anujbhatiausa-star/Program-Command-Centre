"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/lib/toast";

/** Calls a server route, toasts the outcome and refreshes the page. */
export function ActionButton({
  url,
  body,
  label,
  confirm,
  success,
  className = "btn-secondary",
}: {
  url: string;
  body?: unknown;
  label: string;
  confirm?: string;
  success?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
      toast(json.message ?? success ?? "Done");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={className} onClick={run} disabled={busy}>
      {busy ? "Working…" : label}
    </button>
  );
}
