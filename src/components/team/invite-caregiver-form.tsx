"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

export function InviteCaregiverForm({
  organizationId,
}: {
  organizationId: string;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !fullName) return;
    setLoading(true);

    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName, organizationId }),
      });

      if (res.ok) {
        toast.success(`Invitation sent to ${email}`);
        setEmail("");
        setFullName("");
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to send invitation");
      }
    } catch {
      toast.error("Failed to send invitation");
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleInvite} className="space-y-3">
      <h3 className="text-lg font-medium">Invite Caregiver</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="invite-name">Full Name</Label>
          <Input
            id="invite-name"
            placeholder="James Wilson"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="james@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
      </div>
      <Button type="submit" disabled={loading} size="sm">
        <UserPlus className="mr-1 h-4 w-4" />
        {loading ? "Sending..." : "Send Invitation"}
      </Button>
    </form>
  );
}
