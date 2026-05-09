"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  noteId: string;
}

export function RetryStuckNoteButton({ noteId }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const onClick = async () => {
    setPending(true);
    try {
      const res = await fetch(`/api/claude/structure/${noteId}/retry`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(
          body?.details
            ? `Retry failed: ${body.details}`
            : "Retry failed. The note is still stuck."
        );
        return;
      }
      toast.success("Note structured successfully.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={onClick}
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
      ) : (
        <RotateCw className="mr-1 h-4 w-4" />
      )}
      Retry now
    </Button>
  );
}
