"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle } from "lucide-react";
import type { Note } from "@/types/database";

type NoteWithRelations = Note & {
  residents: { first_name: string; last_name: string } | null;
  users: { full_name: string } | null;
};

export function NoteTimeline({ notes }: { notes: NoteWithRelations[] }) {
  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <Card key={note.id} className={note.flagged_as_incident ? "border-destructive/50" : ""}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {note.residents?.first_name} {note.residents?.last_name}
                </span>
                {note.flagged_as_incident && (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                )}
              </div>
              <div className="flex items-center gap-2">
                {note.shift && (
                  <Badge variant="secondary" className="text-xs capitalize">
                    {note.shift}
                  </Badge>
                )}
                {!note.is_structured && (
                  <Badge variant="outline" className="text-xs">
                    Pending
                  </Badge>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {note.users?.full_name} &middot;{" "}
              {formatDistanceToNow(new Date(note.created_at), {
                addSuffix: true,
              })}
            </p>
          </CardHeader>
          <CardContent>
            {note.is_structured && note.structured_output ? (
              <StructuredNoteDisplay output={note.edited_output || note.structured_output} />
            ) : (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {note.raw_input}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StructuredNoteDisplay({ output }: { output: string }) {
  try {
    const parsed = JSON.parse(output);
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">{parsed.summary}</p>
        {parsed.sections &&
          Object.entries(parsed.sections).map(([section, text]) => (
            <div key={section}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {section}
              </p>
              <p className="text-sm">{text as string}</p>
            </div>
          ))}
        {parsed.follow_up && parsed.follow_up !== "None noted." && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Follow-up
            </p>
            <p className="text-sm">{parsed.follow_up}</p>
          </div>
        )}
        {parsed.flags && parsed.flags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {parsed.flags.map(
              (flag: { type: string; reason: string }, i: number) => (
                <Badge key={i} variant="destructive" className="text-xs">
                  {flag.type}: {flag.reason}
                </Badge>
              )
            )}
          </div>
        )}
      </div>
    );
  } catch {
    return <p className="text-sm whitespace-pre-wrap">{output}</p>;
  }
}
