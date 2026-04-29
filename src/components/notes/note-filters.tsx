"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SHIFTS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All shifts" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "night", label: "Night" },
];

const INCIDENTS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All notes" },
  { value: "true", label: "Incidents only" },
];

// Pure helper exported so it can be unit-tested without rendering the
// shadcn Select primitive (which is non-trivial to drive in jsdom).
// Filter changes reset the pagination window so the user lands back at the
// most recent results rather than deep in older history.
export function buildFilterUrl(
  basePath: string,
  currentParams: URLSearchParams,
  key: string,
  value: string
): string {
  const next = new URLSearchParams(currentParams.toString());
  if (!value || value === "all") {
    next.delete(key);
  } else {
    next.set(key, value);
  }
  next.delete("count");
  return `${basePath}${next.toString() ? "?" + next.toString() : ""}`;
}

export function NoteFilters({
  basePath,
  initialFrom,
  initialTo,
  initialShift,
  initialIncident,
}: {
  basePath: string;
  initialFrom: string;
  initialTo: string;
  initialShift: string;
  initialIncident: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function apply(key: string, value: string) {
    router.push(buildFilterUrl(basePath, searchParams, key, value));
  }

  function clear() {
    router.push(basePath);
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="filter-shift" className="text-xs">
            Shift
          </Label>
          <Select
            value={initialShift}
            onValueChange={(v) => apply("shift", v)}
          >
            <SelectTrigger id="filter-shift">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHIFTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-incident" className="text-xs">
            Show
          </Label>
          <Select
            value={initialIncident}
            onValueChange={(v) => apply("incident", v)}
          >
            <SelectTrigger id="filter-incident">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INCIDENTS.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-from" className="text-xs">
            From
          </Label>
          <Input
            id="filter-from"
            type="date"
            defaultValue={initialFrom}
            onBlur={(e) => apply("from", e.currentTarget.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-to" className="text-xs">
            To
          </Label>
          <Input
            id="filter-to"
            type="date"
            defaultValue={initialTo}
            onBlur={(e) => apply("to", e.currentTarget.value)}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={clear}>
          Clear filters
        </Button>
      </div>
    </div>
  );
}
