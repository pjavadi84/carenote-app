"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, AlertTriangle } from "lucide-react";
import { DeletionActions } from "./deletion-actions";

// Shown on the resident detail page. Two visual modes:
//   - status != deleted_pending: a compact "Delete" button in the header
//     that kicks off the soft-delete confirm dialog
//   - status == deleted_pending: an amber banner with Restore / Purge /
//     Export actions (reusing DeletionActions)
export function ResidentDeleteControls({
  residentId,
  residentName,
  status,
  variant,
}: {
  residentId: string;
  residentName: string;
  status: string;
  variant: "header-button" | "banner";
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [soft, setSoft] = useState(false);

  if (status === "deleted_pending") {
    if (variant !== "banner") return null;
    return (
      <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm space-y-2">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />
          <div>
            <p className="font-medium">
              {residentName} is marked for deletion
            </p>
            <p className="text-xs text-muted-foreground">
              Export now if you need a portable copy. Restore to bring them
              back, or Purge to cascade-delete every related record
              permanently.
            </p>
          </div>
        </div>
        <DeletionActions residentId={residentId} />
      </div>
    );
  }

  if (variant !== "header-button") return null;

  async function handleSoftDelete() {
    setSoft(true);
    const res = await fetch(`/api/residents/${residentId}`, {
      method: "DELETE",
    });
    setSoft(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error ?? "Failed to mark for deletion");
      return;
    }

    toast.success("Marked for deletion. You can restore from Data Requests.");
    setConfirmOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={confirmOpen}
      onOpenChange={(o) => setConfirmOpen(o)}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Trash2 className="mr-1 h-3 w-3" />
        Delete
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark {residentName} for deletion?</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            The resident will move to &ldquo;Deleted (pending)&rdquo; and
            hide from the normal list. No data is destroyed yet — you can
            restore or export from the Data Requests page before purging.
          </p>
          <p className="text-muted-foreground">
            For discharged or deceased residents whose records you need to
            retain, update their status on the resident edit page instead.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleSoftDelete} disabled={soft}>
              {soft ? "Marking…" : "Mark for deletion"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
