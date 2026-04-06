"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function DeactivateButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleDeactivate() {
    if (!confirm("Deactivate this team member? Their notes will be preserved.")) {
      return;
    }
    setLoading(true);

    const { error } = await supabase
      .from("users")
      .update({ is_active: false })
      .eq("id", userId);

    if (error) {
      toast.error("Failed to deactivate");
    } else {
      toast.success("Team member deactivated");
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDeactivate}
      disabled={loading}
      className="text-destructive hover:text-destructive"
    >
      {loading ? "..." : "Deactivate"}
    </Button>
  );
}
