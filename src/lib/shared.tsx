import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type Method = "cash" | "card" | "bank_transfer";
export const METHODS: { v: Method; l: string }[] = [
  { v: "cash", l: "Cash" },
  { v: "card", l: "Card" },
  { v: "bank_transfer", l: "Bank transfer" },
];
export const ACTIVE = ["booked", "completed"] as const;

export const STATUS = {
  booked: { label: "Booked", cls: "bg-[#fdf3dc] text-[#b7791f]" },
  completed: { label: "Completed", cls: "bg-[#e3f1ed] text-[#2f7d6b]" },
  on_hold: { label: "On hold", cls: "bg-[#e6eefb] text-[#2f5fa8]" },
  cancelled: { label: "Cancelled", cls: "bg-[#fbe9e6] text-[#b4443a]" },
} as const;
export type Status = keyof typeof STATUS;

export const chip = (on: boolean) =>
  cn(
    "whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors",
    on ? "border-[#14211f] bg-[#14211f] text-white" : "bg-card hover:bg-accent",
  );

export function useSlots() {
  return useQuery({
    queryKey: ["slots"],
    queryFn: async () => (await supabase.from("slots").select("*").eq("active", true).order("sort_order")).data ?? [],
  });
}
export function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: async () => (await supabase.from("services").select("*").eq("active", true).order("name")).data ?? [],
  });
}

export function useDayAppts(date: string) {
  return useQuery({
    queryKey: ["appts", date],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("appointment_balance").select("*").eq("appt_date", date).in("status", [...ACTIVE, "on_hold"]);
      const ids = [...new Set((rows ?? []).map((r) => r.patient_id!))];
      const { data: pts } = ids.length ? await supabase.from("patients").select("id,name,phone").in("id", ids) : { data: [] };
      const m = new Map((pts ?? []).map((p) => [p.id, p]));
      return (rows ?? []).map((r) => ({ ...r, patient: m.get(r.patient_id!)?.name ?? "—", phone: m.get(r.patient_id!)?.phone ?? "" }));
    },
  });
}

type Slot = { sort_order: number; start_time: string; end_time: string };
type Row = { start_slot: number | null; slots_count: number | null };
export function calcMaxDur(slots: Slot[], rows: Row[], start: number) {
  const occ = (o: number) => rows.some((r) => o >= r.start_slot! && o < r.start_slot! + r.slots_count!);
  let n = 1;
  while (n < 3) {
    const prev = slots.find((s) => s.sort_order === start + n - 1);
    const next = slots.find((s) => s.sort_order === start + n);
    if (!prev || !next || prev.end_time !== next.start_time || occ(next.sort_order)) break;
    n++;
  }
  return n;
}

export async function fetchByIds<T>(ids: string[], mk: (chunk: string[]) => PromiseLike<{ data: T[] | null }>) {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await mk(ids.slice(i, i + 100));
    out.push(...(data ?? []));
  }
  return out;
}

export async function pageAll<T>(mk: (from: number, to: number) => PromiseLike<{ data: T[] | null }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await mk(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}
// extra services per appointment (first service stays in appointments.service_id)
export function useExtras() {
  return useQuery({
    queryKey: ["appt-extras"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("appointments").select("id,extra_service_ids").neq("extra_service_ids", "{}");
      return new Map<string, string[]>((data ?? []).map((r: { id: string; extra_service_ids: string[] }) => [r.id, r.extra_service_ids]));
    },
  });
}
export function useSvcLabel() {
  const services = useServices().data ?? [];
  const ex = useExtras().data;
  return (apptId: string | null, sid: string | null) =>
    [sid, ...((apptId && ex?.get(apptId)) || [])].map((i) => services.find((s) => s.id === i)?.name).filter(Boolean).join(" + ");
}

export function useCancelled(date: string) {
  return useQuery({
    queryKey: ["appts", "cancelled", date],
    queryFn: async () => {
      const { data: rows } = await supabase.from("appointment_balance").select("id,patient_id,service_id,start_slot,slots_count,total_amount,discount_amount").eq("appt_date", date).eq("status", "cancelled").order("start_slot");
      const ids = [...new Set((rows ?? []).map((r) => r.patient_id!))];
      const { data: pts } = ids.length ? await supabase.from("patients").select("id,name").in("id", ids) : { data: [] };
      return (rows ?? []).map((r) => ({ ...r, patient: (pts ?? []).find((p) => p.id === r.patient_id)?.name ?? "—" }));
    },
  });
}