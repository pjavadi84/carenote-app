"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const MAX_CHARS = 2000;

export function NoteInputForm({
  residentId,
  organizationId,
}: {
  residentId: string;
  organizationId: string;
}) {
  const [rawInput, setRawInput] = useState("");
  const [noteType, setNoteType] = useState<string>("shift_note");
  const [shift, setShift] = useState<string>(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 18) return "afternoon";
    return "night";
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rawInput.trim()) return;
    setLoading(true);

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("notes").insert({
      organization_id: organizationId,
      resident_id: residentId,
      author_id: authUser!.id,
      note_type: noteType as "shift_note" | "incident" | "observation",
      raw_input: rawInput.trim(),
      shift: shift as "morning" | "afternoon" | "night",
    });

    if (error) {
      toast.error("Failed to save note");
      setLoading(false);
      return;
    }

    toast.success("Note saved");
    setRawInput("");
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <Select value={noteType} onValueChange={(v) => v && setNoteType(v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="shift_note">Shift Note</SelectItem>
            <SelectItem value="observation">Observation</SelectItem>
          </SelectContent>
        </Select>

        <Select value={shift} onValueChange={(v) => v && setShift(v)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="morning">Morning</SelectItem>
            <SelectItem value="afternoon">Afternoon</SelectItem>
            <SelectItem value="night">Night</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="relative">
        <Textarea
          placeholder="Describe what you observed... e.g., 'Dorothy was in good spirits today, ate all her lunch, went for a walk in the garden.'"
          value={rawInput}
          onChange={(e) =>
            setRawInput(e.target.value.slice(0, MAX_CHARS))
          }
          rows={4}
          className="resize-none"
        />
        <span className="absolute bottom-2 right-2 text-xs text-muted-foreground">
          {rawInput.length}/{MAX_CHARS}
        </span>
      </div>

      <Button
        type="submit"
        disabled={loading || !rawInput.trim()}
        className="w-full"
      >
        {loading ? "Saving..." : "Save Note"}
      </Button>
    </form>
  );
}
