"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface Filter {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}

/** Select filters stored in the URL so views can be shared and reloaded. */
export function FilterBar({ filters }: { filters: Filter[] }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();

  function set(name: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    router.replace(`${path}?${next}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      {filters.map((f) => (
        <label key={f.name} className="text-xs font-medium text-slate-600">
          <span className="mb-1 block">{f.label}</span>
          <select className="input" value={params.get(f.name) ?? ""} onChange={(e) => set(f.name, e.target.value)}>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
