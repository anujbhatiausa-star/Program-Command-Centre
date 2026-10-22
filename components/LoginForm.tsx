"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserClient } from "@/lib/supabase/client";

const DEMO = [
  { email: "pm@algoworks.demo", who: "Delivery lead (PM)", note: "everything, incl. cost and margin" },
  { email: "ba@algoworks.demo", who: "Business analyst", note: "backlog and stories" },
  { email: "sponsor@customer.demo", who: "Customer sponsor", note: "overview, billing, RAID" },
  { email: "po@customer.demo", who: "Customer product owner", note: "plus the acceptance queue" },
];

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState(DEMO[0].email);
  const [password, setPassword] = useState("demo123");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await browserClient().auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-800">Demo users (password demo123)</legend>
        <div className="grid gap-2">
          {DEMO.map((d) => (
            <label
              key={d.email}
              className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm ${email === d.email ? "border-accent bg-accent-soft" : "border-slate-200"}`}
            >
              <input type="radio" name="demo" className="mt-1" checked={email === d.email} onChange={() => setEmail(d.email)} />
              <span>
                <span className="font-medium">{d.who}</span> <span className="text-slate-600">({d.note})</span>
                <span className="block font-mono text-xs text-slate-600">{d.email}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Email</span>
          <input className="input w-full" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Password</span>
          <input className="input w-full" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
