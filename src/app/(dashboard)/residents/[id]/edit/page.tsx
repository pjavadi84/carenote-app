import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";
import { ResidentForm } from "@/components/residents/resident-form";
import type { Resident } from "@/types/database";

export default async function EditResidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("residents")
    .select("*")
    .eq("id", id)
    .eq("organization_id", user.organization_id)
    .single();

  const resident = data as Resident | null;
  if (!resident) notFound();

  return (
    <div className="px-4 py-6">
      <h2 className="mb-6 text-xl font-semibold">Edit Resident</h2>
      <ResidentForm resident={resident} />
    </div>
  );
}
