"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/lib/toast";

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

export function RaidStatus({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  return (
    <select
      aria-label="Status"
      className="input !py-1 text-xs"
      defaultValue={status}
      onChange={async (e) => {
        try {
          await send(`/api/raid/${id}`, "PATCH", { status: e.target.value });
          toast(`Status set to ${e.target.value}`);
          router.refresh();
        } catch (err) {
          toast((err as Error).message, "error");
        }
      }}
    >
      {["Open", "Mitigating", "Closed"].map((s) => (
        <option key={s}>{s}</option>
      ))}
    </select>
  );
}

export function RaidControls() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        Add RAID item
      </button>
    );
  }
  return (
    <form
      className="grid w-full max-w-2xl gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await send("/api/raid", "POST", Object.fromEntries(new FormData(e.currentTarget)));
          toast("RAID item added");
          setOpen(false);
          router.refresh();
        } catch (err) {
          toast((err as Error).message, "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="text-xs font-medium sm:col-span-2">
        Title
        <input name="title" className="input mt-1 w-full" required minLength={5} />
      </label>
      <label className="text-xs font-medium">
        Type
        <select name="type" className="input mt-1 w-full">
          {["Risk", "Issue", "Assumption", "Dependency"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium">
        Severity
        <select name="severity" className="input mt-1 w-full" defaultValue="Medium">
          {["Low", "Medium", "High", "Critical"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium">
        Owner
        <input name="owner" className="input mt-1 w-full" required />
      </label>
      <label className="text-xs font-medium">
        Exposure
        <input name="exposure" className="input mt-1 w-full" />
      </label>
      <label className="text-xs font-medium sm:col-span-2">
        Response / mitigation
        <input name="mitigation" className="input mt-1 w-full" />
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button className="btn-primary" disabled={busy}>
          Save
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
