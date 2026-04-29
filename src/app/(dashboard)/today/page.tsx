import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { NoteTimeline } from "@/components/notes/note-timeline";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

const TODAY_PAGE_LIMIT = 300;

export default async function TodayPage() {
  const user = await getAuthenticatedUser();
  const supabase = await createClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: notes } = await supabase
    .from("notes")
    .select(
      `
      *,
      residents (first_name, last_name),
      users:author_id (full_name)
    `
    )
    .eq("organization_id", user.organization_id)
    .gte("created_at", today.toISOString())
    .order("created_at", { ascending: false })
    .limit(TODAY_PAGE_LIMIT);

  const truncated = (notes?.length ?? 0) === TODAY_PAGE_LIMIT;

  return (
    <div className="px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Today</h2>
          <p className="text-sm text-muted-foreground">
            {today.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <Link href="/residents">
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" />
            New Note
          </Button>
        </Link>
      </div>

      {!notes || notes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            No notes yet today. Select a resident to start documenting.
          </p>
          <Link href="/residents">
            <Button variant="outline" className="mt-4">
              Go to Residents
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {truncated && (
            <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-300">
              Showing the {TODAY_PAGE_LIMIT} most recent notes for today. Open
              a resident to see their full history.
            </div>
          )}
          <NoteTimeline
            notes={notes as Parameters<typeof NoteTimeline>[0]["notes"]}
          />
        </>
      )}
    </div>
  );
}
