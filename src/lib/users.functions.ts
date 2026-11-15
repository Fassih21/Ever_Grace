import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; password: string; fullName: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: r } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "owner");
    if (!r?.length) throw new Error("Only the owner can add users");
    if (data.password.length < 8) throw new Error("Password must be at least 8 characters");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.trim(), password: data.password, email_confirm: true, user_metadata: { full_name: data.fullName.trim() },
    });
    if (error || !u.user) throw new Error(error?.message ?? "Could not create user");
    const { error: e2 } = await supabaseAdmin.from("user_roles").insert({ user_id: u.user.id, role: "manager", created_by: context.userId });
    if (e2) {
      await supabaseAdmin.auth.admin.deleteUser(u.user.id);
      throw new Error(e2.message);
    }
    return { id: u.user.id };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; active: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { data: r } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "owner");
    if (!r?.length) throw new Error("Only the owner can change users");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId).eq("role", "owner");
    if (t?.length) throw new Error("The owner account cannot be deactivated");
    const { error } = await supabaseAdmin.from("profiles").update({ is_active: data.active }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
