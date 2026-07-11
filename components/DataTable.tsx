"use client";

import { useMemo, useState } from "react";
import { clsx } from "@/lib/cx";
import { compareValues, type SortDir } from "@/lib/table";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortable?: boolean; // default true
  sortValue?: (row: T) => string | number; // defaults to filterText
  filterText?: (row: T) => string; // used for global search + facet values
  facet?: boolean; // render a dropdown of distinct filterText values
  align?: "left" | "right";
  className?: string;
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  initialSortKey,
  initialSortDir = "asc",
  searchPlaceholder = "Search…",
  bare = false,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  initialSortKey?: string;
  initialSortDir?: SortDir;
  searchPlaceholder?: string;
  bare?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | undefined>(initialSortKey);
  const [sortDir, setSortDir] = useState<SortDir>(initialSortDir);
  const [facets, setFacets] = useState<Record<string, string>>({});

  const facetCols = columns.filter((c) => c.facet && c.filterText);

  const facetOptions = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const c of facetCols) {
      const set = new Set<string>();
      for (const r of rows) {
        const v = c.filterText!(r);
        if (v) set.add(v);
      }
      m[c.key] = [...set].sort((a, b) => compareValues(a, b, "asc"));
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const view = useMemo(() => {
    let out = rows;
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter((r) => columns.some((c) => c.filterText && c.filterText(r).toLowerCase().includes(q)));
    }
    for (const [k, val] of Object.entries(facets)) {
      if (!val) continue;
      const col = columns.find((c) => c.key === k);
      if (col?.filterText) out = out.filter((r) => col.filterText!(r) === val);
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      const accessor = col?.sortValue ?? col?.filterText;
      if (accessor) out = [...out].sort((a, b) => compareValues(accessor(a), accessor(b), sortDir));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, facets, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const control = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className={clsx(control, "w-full max-w-xs placeholder:text-slate-400")}
        />
        {facetCols.map((c) => (
          <select key={c.key} value={facets[c.key] ?? ""} onChange={(e) => setFacets((f) => ({ ...f, [c.key]: e.target.value }))} className={control}>
            <option value="">All {c.header}</option>
            {(facetOptions[c.key] ?? []).map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ))}
        <span className="ml-auto text-xs text-slate-400">{view.length} of {rows.length}</span>
      </div>

      <div className={clsx("overflow-x-auto", !bare && "rounded-2xl border border-slate-100 bg-white shadow-sm")}>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((c) => {
                const sortable = c.sortable !== false;
                const active = sortKey === c.key;
                return (
                  <th key={c.key} className={clsx("px-4 py-3 font-semibold", c.align === "right" && "text-right")}>
                    {sortable ? (
                      <button type="button" onClick={() => toggleSort(c.key)} className={clsx("inline-flex items-center gap-1 hover:text-slate-700", active && "text-slate-700")}>
                        {c.header}
                        <span className="text-[10px] text-slate-400">{active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span>
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {view.length === 0 && (
              <tr><td className="px-4 py-6 text-slate-500" colSpan={columns.length}>No matching rows.</td></tr>
            )}
            {view.map((r) => (
              <tr key={getRowKey(r)} className="border-b border-slate-50 transition last:border-0 hover:bg-slate-50/60">
                {columns.map((c) => (
                  <td key={c.key} className={clsx("px-4 py-3", c.align === "right" && "text-right", c.className)}>{c.render(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
