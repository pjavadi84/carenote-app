import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { ResidentCard } from "@/components/residents/resident-card";
import type { Resident } from "@/types/database";

export default async function ResidentsPage() {
  const user = await getAuthenticatedUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("residents")
    .select("*")
    .eq("organization_id", user.organization_id)
    .eq("status", "active")
    .order("first_name");

  const residents = (data ?? []) as Resident[];
  const isAdmin = user.role === "admin";

  return (
    <div className="px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Residents</h2>
        {isAdmin && (
          <Link href="/residents/new">
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Add Resident
            </Button>
          </Link>
        )}
      </div>

      {residents.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            No residents yet. Add your first resident to get started.
          </p>
          {isAdmin && (
            <Link href="/residents/new">
              <Button variant="outline" className="mt-4">
                Add First Resident
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {residents.map((resident) => (
            <ResidentCard key={resident.id} resident={resident} />
          ))}
        </div>
      )}
    </div>
  );
}
