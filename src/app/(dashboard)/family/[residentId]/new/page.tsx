import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";
import { FamilyUpdateEditor } from "@/components/family/family-update-editor";
import type { Resident, FamilyContact } from "@/types/database";
import {
  buildFamilyDisclosureFooter,
  localeForRegulatoryRegion,
} from "@/lib/family/disclosure-footer";

export default async function NewFamilyUpdatePage({
  params,
}: {
  params: Promise<{ residentId: string }>;
}) {
  const { residentId } = await params;
  const user = await requireAdmin();
  const supabase = await createClient();

  const { data: residentData } = await supabase
    .from("residents")
    .select("*")
    .eq("id", residentId)
    .eq("organization_id", user.organization_id)
    .single();

  const resident = residentData as Resident | null;
  if (!resident) notFound();

  const { data: contactsData } = await supabase
    .from("family_contacts")
    .select("*")
    .eq("resident_id", residentId)
    .eq("receives_updates", true);

  const contacts = (contactsData ?? []) as FamilyContact[];

  // Pre-render the exact disclosure footer that will be auto-appended at
  // send time, so the admin sees what the family will receive before they
  // approve. Locale follows the org's regulatory_region.
  const { data: orgData } = await supabase
    .from("organizations")
    .select("regulatory_region, email_reply_to")
    .eq("id", user.organization_id)
    .single();

  const typedOrg = orgData as
    | { regulatory_region: string | null; email_reply_to: string | null }
    | null;

  const disclosurePreview = buildFamilyDisclosureFooter({
    clinicianName: user.full_name,
    replyTo: typedOrg?.email_reply_to || "noreply@kinroster.com",
    locale: localeForRegulatoryRegion(typedOrg?.regulatory_region),
  });

  if (contacts.length === 0) {
    return (
      <div className="px-4 py-6">
        <h2 className="mb-4 text-xl font-semibold">
          Family Update — {resident.first_name} {resident.last_name}
        </h2>
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            No family contacts with updates enabled. Add a contact with email on the resident profile first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <h2 className="mb-4 text-xl font-semibold">
        Family Update — {resident.first_name} {resident.last_name}
      </h2>
      <FamilyUpdateEditor
        residentId={residentId}
        organizationId={user.organization_id}
        contacts={contacts}
        disclosurePreview={disclosurePreview}
      />
    </div>
  );
}
