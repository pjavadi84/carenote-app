import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { InviteCaregiverForm } from "@/components/team/invite-caregiver-form";
import { DeactivateButton } from "@/components/team/deactivate-button";
import { CaregiverConsentButton } from "@/components/pdpa/caregiver-consent-button";

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

  // For each member, find the most recent caregiver-PDPA row in
  // consent_records. If it's not a withdrawal, the member has active
  // consent. Same logic as hasCaregiverPdpaConsent but batched.
  const { data: consentRowsData } = await supabase
    .from("consent_records")
    .select("user_id, consent_type, accepted_at")
    .eq("organization_id", user.organization_id)
    .in("consent_type", [
      "caregiver_pdpa_self_ack",
      "caregiver_pdpa_paper",
      "caregiver_pdpa_withdraw",
    ])
    .order("accepted_at", { ascending: false });
  const consentRows = (consentRowsData ?? []) as Array<{
    user_id: string;
    consent_type: string;
    accepted_at: string;
  }>;
  const mostRecentByUser = new Map<string, string>();
  for (const row of consentRows) {
    if (!mostRecentByUser.has(row.user_id)) {
      mostRecentByUser.set(row.user_id, row.consent_type);
    }
  }

  return (
    <div className="px-4 py-6">
      <h2 className="mb-6 text-xl font-semibold">Team</h2>

      <div className="mb-6">
        <InviteCaregiverForm organizationId={user.organization_id} />
      </div>

      <div className="space-y-3">
        {members.map((member) => {
          const mostRecent = mostRecentByUser.get(member.id);
          const hasActiveConsent =
            mostRecent != null && mostRecent !== "caregiver_pdpa_withdraw";
          return (
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
                  {member.is_active && member.role === "caregiver" && (
                    <CaregiverConsentButton
                      caregiverUserId={member.id}
                      caregiverName={member.full_name}
                      hasActiveConsent={hasActiveConsent}
                    />
                  )}
                  {member.id !== user.id && member.is_active && (
                    <DeactivateButton userId={member.id} />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
