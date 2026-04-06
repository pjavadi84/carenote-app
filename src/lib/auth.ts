import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { User } from "@/types/database";

export async function getAuthenticatedUser(): Promise<User> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  const appUser = data as User | null;
  if (!appUser) redirect("/login");

  return appUser;
}

export async function requireAdmin(): Promise<User> {
  const user = await getAuthenticatedUser();
  if (user.role !== "admin") redirect("/today");
  return user;
}
