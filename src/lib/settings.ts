import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULTS = {
  clinic_name: "Evergrace Aesthetics Clinic",
  clinic_address: "Plot 89, Township Block 8, Sector B1, Lahore",
  clinic_phone: "0326-8597427",
  clinic_email: "evergraceaesthetics8@gmail.com",
  invoice_footer: "Thank you for choosing Evergrace.",
  invoice_hide_discount: true,
  pending_show_names: true,
  hidden_nav: [] as string[],
};
export type AppSettings = typeof DEFAULTS;

export async function fetchSettings(): Promise<AppSettings> {
  const { data } = await (supabase as any).from("app_settings").select("key,value");
  const o: Record<string, unknown> = {};
  for (const r of data ?? []) o[r.key] = r.value;
  return { ...DEFAULTS, ...o } as AppSettings;
}
export function useAppSettings() {
  return useQuery({ queryKey: ["app-settings"], staleTime: 60_000, queryFn: fetchSettings });
}
export function useSaveSettings() {
  const qc = useQueryClient();
  return async (v: Partial<AppSettings>) => {
    const { error } = await (supabase as any).rpc("set_app_settings", { p_values: v });
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ["app-settings"] });
  };
}
