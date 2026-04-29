import Link from "next/link";
import { Button } from "@/components/ui/button";

export const NOTES_PAGE_DEFAULT = 50;
export const NOTES_PAGE_INCREMENT = 50;
export const NOTES_PAGE_SOFT_CAP = 500;

type SearchParamsBag = Record<string, string | undefined>;

export function NotesPaginationControl({
  basePath,
  currentSearchParams,
  count,
  notesLength,
}: {
  basePath: string;
  currentSearchParams: SearchParamsBag;
  count: number;
  notesLength: number;
}) {
  if (count >= NOTES_PAGE_SOFT_CAP) {
    return (
      <p className="text-xs text-muted-foreground text-center pt-3">
        Showing the {NOTES_PAGE_SOFT_CAP} most recent notes. Narrow the
        filters to find older entries.
      </p>
    );
  }

  // We asked for `count` and got fewer back — there are no more to load.
  if (notesLength < count) {
    return null;
  }

  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(currentSearchParams)) {
    if (key === "count") continue;
    if (value) next.set(key, value);
  }
  const nextCount = Math.min(count + NOTES_PAGE_INCREMENT, NOTES_PAGE_SOFT_CAP);
  next.set("count", String(nextCount));

  return (
    <div className="flex justify-center pt-3">
      <Link href={`${basePath}?${next.toString()}`}>
        <Button variant="outline" size="sm">
          Show {NOTES_PAGE_INCREMENT} older
        </Button>
      </Link>
    </div>
  );
}
