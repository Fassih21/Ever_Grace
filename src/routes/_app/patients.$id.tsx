import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ReceivePayment, type PayTarget } from "@/components/receive-payment";
import { useMe } from "@/lib/auth";
import { chip, useServices } from "@/lib/shared";
import { fmtDate, money } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/patients/$id")({
  head: () => ({ meta: [{ title: "Patient · Evergrace Clinic" }] }),
  component: Detail,
});

const st: Record<string, string> = {
  booked: "bg-[#fdf3dc] text-[#b7791f]", completed: "bg-[#e3f1ed] text-[#2f7d6b]",
  cancelled: "bg-[#f7e1de] text-[#b4443a]", no_show: "bg-[#eef1f0] text-muted-foreground",
  active: "bg-[#fdf3dc] text-[#b7791f]",
};
const lbl = "mb-1.5 block text-xs text-muted-foreground";

function Detail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const owner = useMe().data?.role === "owner";
  const [pay, setPay] = useState<PayTarget | null>(null);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [np, setNp] = useState({ service: "", sessions: "", price: "" });
  const services = useServices().data ?? [];

  const q = useQuery({
    queryKey: ["patient-detail", id],
    queryFn: async () => {
      const { data: p } = await supabase.from("patients").select("id,name,phone").eq("id", id).maybeSingle();
      const { data: v } = await supabase.from("appointment_balance").select("*").eq("patient_id", id).order("appt_date", { ascending: false });
      const { data: pays } = await supabase.from("payments").select("*").eq("patient_id", id).order("paid_at", { ascending: false });
      const { data: plans } = await supabase.from("treatment_plans").select("*").eq("patient_id", id).order("created_at", { ascending: false });
      return { p, v: v ?? [], pays: pays ?? [], plans: plans ?? [] };
    },
  });

  const refresh = () => qc.invalidateQueries();

  const voidPay = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("payments").update({ voided: true, void_reason: voidReason.trim() }).eq("id", voidId!);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Payment voided"); setVoidId(null); setVoidReason(""); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPlan = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("treatment_plans").insert({
        patient_id: id, service_id: np.service, total_sessions: Number(np.sessions), total_price: Number(np.price) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Plan created"); setNp({ service: "", sessions: "", price: "" }); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setPlanStatus = useMutation({
    mutationFn: async (v: { id: string; status: "completed" | "cancelled" }) => {
      const { error } = await supabase.from("treatment_plans").update({ status: v.status }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Plan updated"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <Skeleton className="h-40" />;
  const p = q.data?.p;
  if (!p) return <p className="text-sm text-muted-foreground">Patient not found.</p>;
  const live = q.data!.v.filter((a) => a.status === "booked" || a.status === "completed");
  const billed = live.reduce((t, a) => t + a.total_amount!, 0);
  const paid = live.reduce((t, a) => t + (a.paid_total ?? 0), 0);
  const svcName = (sid: string | null) => services.find((s) => s.id === sid)?.name ?? "Service";
  const usedBy = (planId: string) => live.filter((a) => a.plan_id === planId).length;
  const apptOf = (aid: string) => q.data!.v.find((a) => a.id === aid);
  const planOk = !!np.service && Number(np.sessions) > 0;

  return (
    <div>
      <Link to="/patients" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Patients</Link>
      <h1 className="serif text-2xl md:text-3xl">{p.name}</h1>
      <p className="mb-5 text-sm text-muted-foreground">{p.phone} · {live.length} visit{live.length === 1 ? "" : "s"}</p>
      <div className="mb-5 grid grid-cols-3 gap-3">
        {[["Billed", money(billed), ""], ["Paid", money(paid), "text-[#2f7d6b]"], ["Pending", money(billed - paid), billed - paid ? "text-[#b4443a]" : ""]].map(([l, v, c]) => (
          <div key={l} className="rounded-2xl border bg-card p-4"><div className="text-xs text-muted-foreground">{l}</div><div className={cn("serif mt-1 text-lg md:text-2xl", c)}>{v}</div></div>
        ))}
      </div>

      <h2 className="mb-2 text-lg font-semibold">Visits</h2>
      <div className="mb-6 overflow-hidden rounded-2xl border bg-card">
        {q.data!.v.map((a) => (
          <div key={a.id!} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3.5 last:border-b-0">
            <div className="w-28 text-sm font-semibold">{fmtDate(a.appt_date!, { day: "numeric", month: "short", year: "numeric" })}</div>
            <div className="min-w-0 flex-1 text-sm">{svcName(a.service_id)}{a.slots_count! > 1 ? ` · ${a.slots_count} slots` : ""}{a.plan_id ? " · plan" : ""}</div>
            <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize", st[a.status!])}>{a.status!.replace("_", " ")}</span>
            <div className="w-28 text-right text-sm"><b>{money(a.paid_total ?? 0)}</b><div className="text-xs text-muted-foreground">of {money(a.total_amount!)}</div></div>
            {(a.status === "booked" || a.status === "completed") && (a.balance ?? 0) > 0 ? (
              <Button size="sm" variant="outline" onClick={() => setPay({ id: a.id!, balance: a.balance!, who: p.name })}>Receive {money(a.balance!)}</Button>
            ) : <div className="w-[110px]" />}
          </div>
        ))}
        {!q.data!.v.length && <p className="p-8 text-center text-sm text-muted-foreground">No visits yet.</p>}
      </div>

      <h2 className="mb-2 text-lg font-semibold">Treatment plans</h2>
      <div className="mb-6 overflow-hidden rounded-2xl border bg-card">
        {q.data!.plans.map((pl) => {
          const used = usedBy(pl.id);
          return (
            <div key={pl.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3.5 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{svcName(pl.service_id)}</div>
                <div className="text-xs text-muted-foreground">{used} of {pl.total_sessions} sessions booked · {money(pl.total_price)} total</div>
              </div>
              <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize", st[pl.status] ?? st["cancelled"])}>{pl.status}</span>
              {pl.status === "active" && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPlanStatus.mutate({ id: pl.id, status: "completed" })}>Complete</Button>
                  <Button size="sm" variant="outline" className="border-[#e9b8b0] text-[#b4443a]" onClick={() => setPlanStatus.mutate({ id: pl.id, status: "cancelled" })}>Cancel plan</Button>
                </div>
              )}
            </div>
          );
        })}
        <div className="bg-[#f7f9f8] px-4 py-3">
          <span className={lbl}>New plan</span>
          <div className="mb-3 flex flex-wrap gap-2">
            {services.map((s) => <button key={s.id} type="button" className={chip(np.service === s.id)} onClick={() => setNp({ ...np, service: s.id })}>{s.name}</button>)}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-28"><span className={lbl}>Sessions</span><Input inputMode="numeric" value={np.sessions} onChange={(e) => setNp({ ...np, sessions: e.target.value.replace(/\D/g, "") })} /></div>
            <div className="w-36"><span className={lbl}>Total price (Rs)</span><Input inputMode="numeric" value={np.price} onChange={(e) => setNp({ ...np, price: e.target.value.replace(/\D/g, "") })} /></div>
            <Button disabled={!planOk || addPlan.isPending} onClick={() => addPlan.mutate()}>Create plan</Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">When booking this patient, choose the plan and the per-session amount fills in.</p>
        </div>
      </div>

      <h2 className="mb-2 text-lg font-semibold">Payments</h2>
      <div className="overflow-hidden rounded-2xl border bg-card">
        {!q.data!.pays.length ? <p className="p-8 text-center text-sm text-muted-foreground">No payments yet.</p> : q.data!.pays.map((x) => {
          const a = apptOf(x.appointment_id);
          return (
            <div key={x.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 text-sm last:border-b-0", x.voided && "opacity-60")}>
              <div className="w-28 font-medium">{fmtDate(x.paid_at.slice(0, 10), { day: "numeric", month: "short", year: "numeric" })}</div>
              <div className="min-w-0 flex-1 text-muted-foreground">
                {a ? svcName(a.service_id) : "Visit"} · <span className="capitalize">{x.method.replace("_", " ")}</span>
                {x.voided && <div className="text-xs text-[#b4443a]">Voided: {x.void_reason}</div>}
              </div>
              <div className={cn("w-24 text-right font-semibold", x.voided && "line-through")}>{money(x.amount)}</div>
              {owner && !x.voided ? (
                <Button size="sm" variant="outline" className="border-[#e9b8b0] text-[#b4443a]" onClick={() => { setVoidReason(""); setVoidId(x.id); }}>Void</Button>
              ) : <div className="w-[62px]" />}
            </div>
          );
        })}
      </div>

      <ReceivePayment target={pay} onClose={() => setPay(null)} />

      <AlertDialog open={!!voidId} onOpenChange={(o) => !o && setVoidId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this payment?</AlertDialogTitle>
            <AlertDialogDescription>Use this for a refund or a wrong entry. The payment stays in history, but it no longer counts as collected, and on an active visit the amount becomes pending again.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input placeholder="Reason (required)" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel>Keep payment</AlertDialogCancel>
            <AlertDialogAction disabled={!voidReason.trim() || voidPay.isPending} onClick={(e) => { e.preventDefault(); voidPay.mutate(); }}>Void payment</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
