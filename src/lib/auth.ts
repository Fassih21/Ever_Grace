import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "owner" | "manager";
export type Me = { id: string; name: string; role: Role };

export async function fetchMe(): Promise<Me | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  const uid = session.user.id;
  const [p, r] = await Promise.all([
    supabase.from("profiles").select("full_name,is_active").eq("id", uid).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", uid),
  ]);
  if (!p.data?.is_active || !r.data?.length) {
    await supabase.auth.signOut();
    return null;
  }
  const role: Role = r.data.some((x) => x.role === "owner") ? "owner" : "manager";
  return { id: uid, name: p.data.full_name, role };
}

export function useMe() {
  return useQuery({ queryKey: ["me"], staleTime: 60_000, queryFn: fetchMe });
}