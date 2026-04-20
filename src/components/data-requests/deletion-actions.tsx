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
import { Undo2, Trash2, Download } from "lucide-react";

export function DeletionActions({ residentId }: { residentId: string }) {
  const router = useRouter();
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [purging, setPurging] = useState(false);
  const [restoring, setRestoring] = useState(false);

  async function handleRestore() {
    setRestoring(true);
    const res = await fetch(`/api/residents/${residentId}/restore`, {
      method: "POST",
    });
    setRestoring(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error ?? "Failed to restore");
      return;
    }

    toast.success("Resident restored");
    router.refresh();
  }

  async function handlePurge() {
    if (reason.trim().length < 5) {
      toast.error("Reason must be at least 5 characters");
      return;
    }

    setPurging(true);
    const res = await fetch(`/api/residents/${residentId}/purge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    setPurging(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error ?? "Failed to purge");
      return;
    }

    toast.success("Resident purged");
    setPurgeOpen(false);
    setReason("");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <a
        href={`/api/residents/${residentId}/export`}
        className="inline-flex"
        download
      >
        <Button variant="outline" size="sm">
          <Download className="mr-1 h-3 w-3" />
          Export JSON
        </Button>
      </a>

      <Button
        variant="outline"
        size="sm"
        onClick={handleRestore}
        disabled={restoring}
      >
        <Undo2 className="mr-1 h-3 w-3" />
        {restoring ? "Restoring…" : "Restore"}
      </Button>

      <Dialog
        open={purgeOpen}
        onOpenChange={(o) => {
          if (!o) {
            setPurgeOpen(false);
            setReason("");
          } else {
            setPurgeOpen(true);
          }
        }}
      >
        <DialogTrigger render={<Button variant="destructive" size="sm" />}>
          <Trash2 className="mr-1 h-3 w-3" />
          Purge
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Purge resident and all related data</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This cascade-deletes notes, incident reports, family contacts,
              voice sessions, and disclosure records for this resident.{" "}
              <strong>This cannot be undone.</strong> A hash of the resident&apos;s
              name + DOB is kept on the purge ledger along with your reason.
            </p>
            <p className="text-sm text-muted-foreground">
              Use this only when the record was created in error or an
              authoritative legal request requires full destruction.
              Discharged or deceased residents should stay in the system at
              their corresponding status.
            </p>
            <textarea
              className="w-full rounded-md border bg-background p-2 text-sm min-h-[80px]"
              placeholder="Reason (required — recorded on the purge ledger)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setPurgeOpen(false);
                  setReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handlePurge}
                disabled={purging || reason.trim().length < 5}
              >
                {purging ? "Purging…" : "Confirm purge"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
