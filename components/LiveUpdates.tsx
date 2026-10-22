"use client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { indexPeople, storyBilling, type Assignment, type Person, type Story } from "@/lib/billing";
import { fmtPts, fmtUSD } from "@/lib/format";
import { browserClient } from "@/lib/supabase/client";
import type { ToastKind } from "@/lib/toast";

interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

/**
 * Subscribes to the stories table over Supabase Realtime. When a story becomes
 * Accepted it shows "+N billable points" and refreshes the server-rendered page.
 * Also renders toasts raised anywhere in the app via lib/toast.
 */
export function LiveUpdates() {
  const router = useRouter();
  const [live, setLive] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef(new Set<string>());
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let next = 0;
    const push = (message: string, kind: ToastKind = "success") => {
      const id = ++next;
      setToasts((t) => [...t, { id, message, kind }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 8000);
    };
    const onToast = (e: Event) => {
      const { message, kind } = (e as CustomEvent).detail;
      push(message, kind);
    };
    window.addEventListener("pcc-toast", onToast);

    const db = browserClient();
    const refresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 400);
    };

    async function announceAcceptance(story: Story) {
      const [{ data: assignments }, { data: config }] = await Promise.all([
        db.from("assignments").select("story_id, person_id, share_pct").eq("story_id", story.id),
        db.from("program_config").select("rate_per_point").single(),
      ]);
      const ids = (assignments ?? []).map((a: Assignment) => a.person_id);
      const { data: people } = await db.from("people").select("id, name, org, allocation_pct, start_sprint").in("id", ids);
      const b = storyBilling(
        { ...story, points: Number(story.points) },
        (assignments ?? []).map((a: Assignment) => ({ ...a, share_pct: Number(a.share_pct) })),
        indexPeople((people ?? []) as Person[]),
        Number(config?.rate_per_point ?? 0),
      );
      push(`Story ${story.key} accepted: +${fmtPts(b.billablePoints)} billable points (${fmtUSD(b.amount)})`);
    }

    const channel = db
      .channel("stories-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        const story = payload.new as unknown as Story & { accepted_at: string | null };
        const fresh = story?.accepted_at && Date.now() - new Date(story.accepted_at).getTime() < 120_000;
        if (payload.eventType === "UPDATE" && story.status === "Accepted" && fresh && !seen.current.has(story.id)) {
          seen.current.add(story.id);
          announceAcceptance(story).catch(() => push(`Story ${story.key} accepted`));
        }
        refresh();
      })
      .subscribe((status: string) => setLive(status === "SUBSCRIBED"));

    return () => {
      window.removeEventListener("pcc-toast", onToast);
      db.removeChannel(channel);
    };
  }, [router]);

  return (
    <>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${live ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
        title={live ? "Connected to Supabase Realtime: acceptances appear within seconds" : "Connecting to Supabase Realtime…"}
      >
        <span className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-emerald-500" : "bg-slate-400"}`} aria-hidden="true" />
        {live ? "Live" : "Offline"}
      </span>
      <div aria-live="polite" role="status" className="fixed bottom-4 right-4 z-50 flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${
              t.kind === "error" ? "border-red-200 bg-red-50 text-red-900" : t.kind === "info" ? "border-slate-200 bg-white text-slate-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </>
  );
}
