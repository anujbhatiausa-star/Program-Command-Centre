"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/lib/toast";

export function AcceptanceActions({ storyId, storyKey }: { storyId: string; storyKey: string }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function decide(action: "accept" | "reject") {
    setBusy(true);
    try {
      const res = await fetch(`/api/stories/${storyId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "reject" ? { reason } : {}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      toast(json.message, action === "accept" ? "success" : "info");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(false);
    }
  }

  if (rejecting) {
    return (
      <form
        className="mt-3 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          decide("reject");
        }}
      >
        <label className="block text-xs font-medium text-slate-700" htmlFor={`reason-${storyId}`}>
          Why is {storyKey} being rejected? The team sees this on the board.
        </label>
        <textarea
          id={`reason-${storyId}`}
          className="input w-full"
          rows={2}
          minLength={5}
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Warning banner colour fails contrast in the console"
        />
        <div className="flex gap-2">
          <button className="btn-danger" disabled={busy || reason.trim().length < 5}>
            Confirm rejection
          </button>
          <button type="button" className="btn-secondary" onClick={() => setRejecting(false)} disabled={busy}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-3 flex gap-2">
      <button type="button" className="btn-primary" onClick={() => decide("accept")} disabled={busy}>
        Accept
      </button>
      <button type="button" className="btn-danger" onClick={() => setRejecting(true)} disabled={busy}>
        Reject…
      </button>
    </div>
  );
}
