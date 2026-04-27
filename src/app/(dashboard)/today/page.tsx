import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { NoteTimeline } from "@/components/notes/note-timeline";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

const TODAY_PAGE_SIZE = 100;

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const user = await getAuthenticatedUser();
  const supabase = await createClient();
  const params = await searchParams;
  const showAll = params.all === "1";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const baseSelect = `
    *,
    residents (first_name, last_name),
    users:author_id (full_name)
  `;

  // Count first so we can decide whether to show a "Show all" affordance.
  // The created_at index handles this efficiently.
  const { count } = await supabase
    .from("notes")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", user.organization_id)
    .gte("created_at", today.toISOString());

  let notesQuery = supabase
    .from("notes")
    .select(baseSelect)
    .eq("organization_id", user.organization_id)
    .gte("created_at", today.toISOString())
    .order("created_at", { ascending: false });

  if (!showAll) {
    notesQuery = notesQuery.range(0, TODAY_PAGE_SIZE - 1);
  }

  const { data: notes } = await notesQuery;

  const totalCount = count ?? 0;
  const shownCount = notes?.length ?? 0;
  const hasMore = !showAll && totalCount > TODAY_PAGE_SIZE;

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
          <NoteTimeline notes={notes as Parameters<typeof NoteTimeline>[0]["notes"]} />
          {hasMore && (
            <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Showing {shownCount} of {totalCount} notes from today
              </p>
              <Link href="/today?all=1">
                <Button variant="outline" size="sm">
                  Show all
                </Button>
              </Link>
            </div>
          )}
          {showAll && totalCount > TODAY_PAGE_SIZE && (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Showing all {totalCount} notes from today
            </div>
          )}
        </>
      )}
    </div>
  );
}
