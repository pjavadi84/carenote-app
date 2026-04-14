"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("America/Los_Angeles");
  const [emailFromName, setEmailFromName] = useState("");
  const [emailReplyTo, setEmailReplyTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: appUser } = await supabase
        .from("users")
        .select("organization_id, role")
        .eq("id", user.id)
        .single();

      if (!appUser || (appUser as { role: string }).role !== "admin") {
        router.push("/today");
        return;
      }

      const { data: org } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", (appUser as { organization_id: string }).organization_id)
        .single();

      if (org) {
        const o = org as {
          name: string;
          timezone: string;
          email_from_name: string | null;
          email_reply_to: string | null;
        };
        setName(o.name);
        setTimezone(o.timezone || "America/Los_Angeles");
        setEmailFromName(o.email_from_name || "");
        setEmailReplyTo(o.email_reply_to || "");
      }
      setLoading(false);
    }
    load();
  }, [supabase, router]);

  async function handleSave() {
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: appUser } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user!.id)
      .single();

    const { error } = await supabase
      .from("organizations")
      .update({
        name,
        timezone,
        email_from_name: emailFromName || null,
        email_reply_to: emailReplyTo || null,
      })
      .eq("id", (appUser as { organization_id: string }).organization_id);

    if (error) {
      toast.error("Failed to save settings");
    } else {
      toast.success("Settings saved");
      router.refresh();
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <div className="px-4 py-6">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <h2 className="mb-6 text-xl font-semibold">Settings</h2>

      <div className="space-y-4 max-w-md">
        <div className="space-y-2">
          <Label htmlFor="facility-name">Facility Name</Label>
          <Input
            id="facility-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
              <SelectItem value="America/Denver">Mountain Time</SelectItem>
              <SelectItem value="America/Chicago">Central Time</SelectItem>
              <SelectItem value="America/New_York">Eastern Time</SelectItem>
              <SelectItem value="Pacific/Honolulu">Hawaii Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email-from">
            Email From Name
            <span className="ml-1 text-xs text-muted-foreground font-normal">
              (used in family update emails)
            </span>
          </Label>
          <Input
            id="email-from"
            value={emailFromName}
            onChange={(e) => setEmailFromName(e.target.value)}
            placeholder="Sunrise Senior Care"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email-reply">Reply-to Email</Label>
          <Input
            id="email-reply"
            type="email"
            value={emailReplyTo}
            onChange={(e) => setEmailReplyTo(e.target.value)}
            placeholder="care@youfacility.com"
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
