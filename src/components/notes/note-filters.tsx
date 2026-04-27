"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

// URL-driven filter UI for a resident's note timeline. Mirrors the audit-log
// pattern so behavior is consistent across the app: filters live in URL
// search params; the server component re-renders on change; the API route
// re-applies the same params during "Load older" pagination.

export interface NoteFilterValues {
  start?: string;
  end?: string;
  search?: string;
  incidents?: string;
}

export function NoteFilters({
  initial,
}: {
  initial: NoteFilterValues;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(initial.search ?? "");

  function apply(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function clear() {
    setSearchValue("");
    router.push(pathname);
  }

  function onSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    apply({ search: searchValue.trim() || undefined });
  }

  const hasActiveFilters = Boolean(
    initial.start || initial.end || initial.search || initial.incidents === "1"
  );

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      <form onSubmit={onSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search note text..."
            className="pl-8"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
        </div>
        <Button type="submit" size="sm" variant="outline">
          Search
        </Button>
      </form>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="filter-start" className="text-xs">
            From
          </Label>
          <Input
            id="filter-start"
            type="date"
            defaultValue={initial.start ?? ""}
            onBlur={(e) =>
              apply({ start: e.currentTarget.value || undefined })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-end" className="text-xs">
            To
          </Label>
          <Input
            id="filter-end"
            type="date"
            defaultValue={initial.end ?? ""}
            onBlur={(e) =>
              apply({ end: e.currentTarget.value || undefined })
            }
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={initial.incidents === "1"}
            onChange={(e) =>
              apply({ incidents: e.currentTarget.checked ? "1" : undefined })
            }
          />
          <span>Incidents only</span>
        </label>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clear}>
            <X className="mr-1 h-3.5 w-3.5" />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
