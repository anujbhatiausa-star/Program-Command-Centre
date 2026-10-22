"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PAGES, type Role } from "@/lib/roles";
import { browserClient } from "@/lib/supabase/client";

export function Nav({ role }: { role: Role }) {
  const path = usePathname();
  const pages = PAGES.filter((p) => p.roles.includes(role));
  return (
    <nav aria-label="Main" className="-mb-px flex gap-1 overflow-x-auto">
      {pages.map((p) => {
        const active = p.href === "/" ? path === "/" : path.startsWith(p.href);
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${active ? "border-accent text-accent" : "border-transparent text-slate-600 hover:text-slate-900"}`}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={async () => {
        await browserClient().auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
