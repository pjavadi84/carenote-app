"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { NoteTimeline, type NoteWithRelations } from "./note-timeline";
import {
  notesFiltersToQueryString,
  type NotesQueryFilters,
} from "@/lib/notes-query";

const PAGE_SIZE = 50;

// Wraps NoteTimeline with cursor-based "Load older" pagination. The page
// owner does the initial query so the first paint is server-rendered;
// this component only handles incremental fetches.
//
// To reset local state when filters change, the parent should pass a
// `key` derived from the filters (e.g., JSON.stringify(filters)). React
// will remount this component, which is cleaner than syncing initial
// props via useEffect.
export function NotesInfiniteList({
  residentId,
  initialNotes,
  hasMore: initialHasMore,
  hiddenSensitiveCount = 0,
  filters = {},
}: {
  residentId: string;
  initialNotes: NoteWithRelations[];
  hasMore: boolean;
  hiddenSensitiveCount?: number;
  filters?: NotesQueryFilters;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [pending, startTransition] = useTransition();

  const loadMore = () => {
    const oldest = notes[notes.length - 1];
    if (!oldest) return;

    startTransition(async () => {
      try {
        const baseParams = new URLSearchParams({
          before: oldest.created_at,
          limit: String(PAGE_SIZE),
        });
        const filterQs = notesFiltersToQueryString(filters);
        const response = await fetch(
          `/api/residents/${residentId}/notes?${baseParams.toString()}${filterQs}`
        );
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }
        const data = (await response.json()) as {
          notes: NoteWithRelations[];
          hasMore: boolean;
        };
        setNotes((prev) => [...prev, ...data.notes]);
        setHasMore(data.hasMore);
      } catch {
        toast.error("Could not load older notes. Please try again.");
      }
    });
  };

  return (
    <div className="space-y-3">
      <NoteTimeline
        notes={notes}
        hiddenSensitiveCount={hiddenSensitiveCount}
      />
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={pending}
          >
            {pending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Loading...
              </>
            ) : (
              "Load older notes"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
