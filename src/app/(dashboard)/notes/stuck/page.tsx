import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { RetryStuckNoteButton } from "@/components/notes/retry-stuck-note-button";

// Admin-only review surface for notes whose structuring failed and never
// recovered — see Gap 2 in docs/PRE-PILOT-CORRECTNESS-FIXES.md. The cron
// auto-retries up to MAX_STRUCTURING_ATTEMPTS; rows with structuring_giving_up
// = true are permanently parked here until an admin clicks Retry.

export const dynamic = "force-dynamic";

interface StuckNote {
  id: string;
  raw_input: string;
  structuring_attempts: number;
  structuring_giving_up: boolean;
  structuring_error: string | null;
  last_structuring_attempt_at: string | null;
  created_at: string;
  resident_id: string;
  author_id: string;
  residents: { first_name: string; last_name: string } | null;
  users: { full_name: string } | null;
}

export default async function StuckNotesPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("notes")
    .select(
      "id, raw_input, structuring_attempts, structuring_giving_up, structuring_error, last_structuring_attempt_at, created_at, resident_id, author_id, residents(first_name, last_name), users:author_id(full_name)"
    )
    .eq("is_structured", false)
    .order("last_structuring_attempt_at", {
      ascending: false,
      nullsFirst: false,
    });

  const notes = (data ?? []) as StuckNote[];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Stuck notes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Notes whose AI structuring failed and never recovered. The auto-retry
          cron handles transient failures (rate limits, network) up to{" "}
          <span className="font-medium">5 attempts</span>; rows below either
          ran out of attempts or hit a non-retryable error. They are invisible
          to clinician summaries, family updates, and weekly summaries until
          structuring succeeds.
        </p>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No stuck notes. Everything is structured.
        </p>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => {
            const resident = n.residents
              ? `${n.residents.first_name} ${n.residents.last_name}`
              : "unknown resident";
            const author = n.users?.full_name ?? "unknown author";
            const attempted = n.last_structuring_attempt_at
              ? new Date(n.last_structuring_attempt_at).toLocaleString()
              : "never";
            return (
              <Card key={n.id}>
                <CardContent className="py-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{resident}</p>
                        {n.structuring_giving_up && (
                          <Badge variant="destructive" className="text-xs">
                            gave up
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {n.structuring_attempts} attempt
                          {n.structuring_attempts === 1 ? "" : "s"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {author} · created{" "}
                        <time suppressHydrationWarning>
                          {new Date(n.created_at).toLocaleString()}
                        </time>{" "}
                        · last attempt {attempted}
                      </p>
                      {n.structuring_error && (
                        <p className="mt-1.5 text-xs bg-muted/50 p-2 rounded overflow-x-auto font-mono">
                          {n.structuring_error}
                        </p>
                      )}
                      <p className="mt-1.5 text-xs text-muted-foreground line-clamp-3">
                        {n.raw_input}
                      </p>
                    </div>
                    <RetryStuckNoteButton noteId={n.id} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
