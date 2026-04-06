import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { InviteCaregiverForm } from "@/components/team/invite-caregiver-form";
import { DeactivateButton } from "@/components/team/deactivate-button";

export default async function TeamPage() {
  const user = await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("organization_id", user.organization_id)
    .order("created_at");

  const members = (data ?? []) as Array<{
    id: string;
    full_name: string;
    email: string;
    role: string;
    is_active: boolean;
    created_at: string;
  }>;

  return (
    <div className="px-4 py-6">
      <h2 className="mb-6 text-xl font-semibold">Team</h2>

      <div className="mb-6">
        <InviteCaregiverForm organizationId={user.organization_id} />
      </div>

      <div className="space-y-3">
        {members.map((member) => (
          <Card key={member.id} className={!member.is_active ? "opacity-60" : ""}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium">
                  {member.full_name}
                  {member.id === user.id && (
                    <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">{member.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {member.role}
                </Badge>
                {!member.is_active && (
                  <Badge variant="outline">Inactive</Badge>
                )}
                {member.id !== user.id && member.is_active && (
                  <DeactivateButton userId={member.id} />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
