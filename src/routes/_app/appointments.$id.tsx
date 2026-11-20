import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { BillingPanel } from "@/components/billing-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { STATUS, useServices, useSlots, type Status } from "@/lib/shared";
import { fmtDate, fmtTime, money } from "@/lib/format";

export const Route = createFileRoute("/_app/appointments/$id")({
  head: () => ({ meta: [{ title: "Appointment · Evergrace Clinic" }] }),
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const services = useServices().data ?? [];
  const slots = useSlots().data ?? [];
  const [note, setNote] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["appt", id],
    queryFn: async () => {
      const { data: a, error } = await supabase.from("appointment_balance").select("*").eq("id", id).single();
      if (error) throw error;
      const { data: p } = await supabase.from("patients").select("name,phone").eq("id", a.patient_id!).single();
      return { a, p };
    },
  });
  const a = q.data?.a;
  const text = note ?? a?.cancel_reason ?? "";

  const set = useMutation({
    mutationFn: async (status: Status) => {
      const keep = status === "cancelled";
      const { error } = await supabase.from("appointments")
        .update({ status, cancel_reason: keep ? text.trim() || null : null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      ["appt", "appts", "pending", "dash", "patient-detail"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success("Status updated");
    },
    onError: (e: Error) =>
      toast.error(/exclusion|overlap/i.test(e.message) ? "Ye slot kisi aur appointment ne le liya" : e.message),
  });

  if (q.isLoading) return <Skeleton className="h-64" />;
  if (!a) return <p className="text-sm text-muted-foreground">Appointment not found.</p>;

  const s0 = slots.find((s) => s.sort_order === a.start_slot);
  const s1 = slots.find((s) => s.sort_order === a.start_slot! + a.slots_count! - 1) ?? s0;
  const svc = services.find((s) => s.id === a.service_id)?.name ?? "—";
  const row = (k: string, v: string) => (
    <div className="flex justify-between gap-4 border-b py-2.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{k}</span><span className="text-right font-medium">{v}</span>
    </div>
  );

  return (
    <div className="max-w-xl">
      <Link to="/appointments" className="mb-3 inline-flex items-center text-sm text-muted-foreground">
        <ChevronLeft className="size-4" /> Appointments
      </Link>
      <h1 className="serif text-2xl md:text-3xl">{q.data?.p?.name ?? "Patient"}</h1>
      <p className="mb-5 text-sm text-muted-foreground">{q.data?.p?.phone}</p>

      <div className="mb-5 rounded-2xl border bg-card px-4">
        {row("Service", svc)}
        {row("Date", fmtDate(a.appt_date!, { weekday: "short", day: "numeric", month: "short", year: "numeric" }))}
        {s0 && s1 && row("Time", `${fmtTime(s0.start_time)} – ${fmtTime(s1.end_time)}`)}
        {a.total_amount! > 0 ? row("Total", money(a.total_amount!)) : row("Price", "Not set")}
        {a.total_amount! > 0 && row("Paid", money(a.paid_total!))}
        {a.total_amount! > 0 && row("Pending", money(a.balance!))}
      </div>
      {(a.status !== "cancelled" && a.status !== "no_show") && (
        <BillingPanel key={`${a.total_amount}-${a.paid_total}`} id={id} total={a.total_amount!} discount={a.discount_amount ?? 0} paid={a.paid_total ?? 0}
          defaultPrice={services.find((s) => s.id === a.service_id)?.default_price ?? 0} />
      )}

      <div className="mb-2 text-sm font-semibold">Status</div>
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(STATUS) as Status[]).map((k) => (
          <button
            key={k}
            type="button"
            disabled={set.isPending}
            onClick={() => a.status !== k && set.mutate(k)}
            className={cn("rounded-xl border-2 px-4 py-3 text-sm font-semibold transition",
              STATUS[k].cls, a.status === k ? "border-current" : "border-transparent opacity-60 hover:opacity-100")}
          >
            {STATUS[k].label}
          </button>
        ))}
      </div>
      <Input className="mt-4" placeholder="Note (hold / cancel reason)" value={text} onChange={(e) => setNote(e.target.value)} />
      <p className="mt-1 text-xs text-muted-foreground">Note pehle likho, phir On hold / Cancelled dabao.</p>
    </div>
  );
}
