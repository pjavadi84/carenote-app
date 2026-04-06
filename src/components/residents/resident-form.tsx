"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Resident } from "@/types/database";

export function ResidentForm({ resident }: { resident?: Resident }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const isEditing = !!resident;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    // Get current user's organization
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    const { data: appUser } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", authUser!.id)
      .single();

    const data = {
      first_name: formData.get("first_name") as string,
      last_name: formData.get("last_name") as string,
      date_of_birth: (formData.get("date_of_birth") as string) || null,
      move_in_date: (formData.get("move_in_date") as string) || null,
      room_number: (formData.get("room_number") as string) || null,
      conditions: (formData.get("conditions") as string) || null,
      preferences: (formData.get("preferences") as string) || null,
      care_notes_context: (formData.get("care_notes_context") as string) || null,
    };

    if (isEditing) {
      const { error } = await supabase
        .from("residents")
        .update(data)
        .eq("id", resident.id);

      if (error) {
        toast.error("Failed to update resident");
        setLoading(false);
        return;
      }
      toast.success("Resident updated");
      router.push(`/residents/${resident.id}`);
    } else {
      const { error } = await supabase.from("residents").insert({
        ...data,
        organization_id: appUser!.organization_id,
      });

      if (error) {
        toast.error("Failed to add resident");
        setLoading(false);
        return;
      }
      toast.success("Resident added");
      router.push("/residents");
    }

    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="first_name">First Name</Label>
          <Input
            id="first_name"
            name="first_name"
            defaultValue={resident?.first_name}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">Last Name</Label>
          <Input
            id="last_name"
            name="last_name"
            defaultValue={resident?.last_name}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date_of_birth">Date of Birth</Label>
          <Input
            id="date_of_birth"
            name="date_of_birth"
            type="date"
            defaultValue={resident?.date_of_birth ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="move_in_date">Move-in Date</Label>
          <Input
            id="move_in_date"
            name="move_in_date"
            type="date"
            defaultValue={resident?.move_in_date ?? ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="room_number">Room Number</Label>
        <Input
          id="room_number"
          name="room_number"
          placeholder="e.g., 3A"
          defaultValue={resident?.room_number ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="conditions">Conditions</Label>
        <Textarea
          id="conditions"
          name="conditions"
          placeholder="e.g., dementia, diabetes, limited mobility"
          defaultValue={resident?.conditions ?? ""}
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="preferences">Preferences</Label>
        <Textarea
          id="preferences"
          name="preferences"
          placeholder="e.g., likes morning walks, prefers tea"
          defaultValue={resident?.preferences ?? ""}
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="care_notes_context">
          Care Notes Context
          <span className="ml-1 text-xs text-muted-foreground font-normal">
            (sent to AI with every note for personalized output)
          </span>
        </Label>
        <Textarea
          id="care_notes_context"
          name="care_notes_context"
          placeholder="e.g., Dorothy responds well to outdoor activities. Her daughter Sarah calls daily around 11 AM."
          defaultValue={resident?.care_notes_context ?? ""}
          rows={3}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading}>
          {loading
            ? isEditing
              ? "Updating..."
              : "Adding..."
            : isEditing
            ? "Update Resident"
            : "Add Resident"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
