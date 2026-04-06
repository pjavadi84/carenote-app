import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { NoteTimeline } from "@/components/notes/note-timeline";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

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
    .order("created_at", { ascending: false });

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
        <NoteTimeline notes={notes as Parameters<typeof NoteTimeline>[0]["notes"]} />
      )}
    </div>
  );
}
