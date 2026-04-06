import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  // Fetch the app user profile with organization
  const { data: user } = await supabase
    .from("users")
    .select("*, organizations(*)")
    .eq("id", authUser.id)
    .single();

  if (!user) {
    // User exists in auth but not in users table yet — may happen during signup flow
    redirect("/login");
  }

  return <AppShell user={user}>{children}</AppShell>;
}
