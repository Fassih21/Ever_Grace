import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ACTIVE, METHODS, chip, type Method } from "@/lib/shared";
import { fmtDate, money, normPhone } from "@/lib/format";

export function BookForm(p: {
  walkIn?: boolean;
  date: string; start: number; label: string; maxDur: number;
  slots: { sort_order: number }[]; services: { id: string; name: string; default_price: number; default_slots: number }[];
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [serviceId, setServiceId] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [dur, setDur] = useState(1);
  const [total, setTotal] = useState("");
  const [advance, setAdvance] = useState("");
  const [method, setMethod] = useState<Method>("cash");
  const [planId, setPlanId] = useState("");
  const ph = normPhone(phone);
  const phoneOk = /^03\d{9}$/.test(ph);

  const existing = useQuery({
    queryKey: ["patient", ph],
    enabled: phoneOk,
    queryFn: async () => {
      const { data: pt } = await supabase.from("patients").select("id,name").eq("phone", ph).maybeSingle();
      if (!pt) return null;
      const { data: v } = await supabase
        .from("appointment_balance").select("appt_date,service_id").eq("patient_id", pt.id)
        .in("status", [...ACTIVE]).order("appt_date", { ascending: false });
      return { id: pt.id, name: pt.name, visits: v?.length ?? 0, last: v?.[0] ?? null };
    },
  });
  const ex = phoneOk ? existing.data : null;
  const shownName = ex ? ex.name : name;

  const plans = useQuery({
    queryKey: ["patient-plans", ex?.id],
    enabled: !!ex?.id,
    queryFn: async () => {
      const { data: pl } = await supabase.from("treatment_plans").select("id,service_id,total_sessions,total_price").eq("patient_id", ex!.id).eq("status", "active");
      const ids = (pl ?? []).map((x) => x.id);
      const { data: used } = ids.length ? await supabase.from("appointments").select("plan_id").in("plan_id", ids).in("status", [...ACTIVE]) : { data: [] };
      return (pl ?? []).map((x) => ({ ...x, used: (used ?? []).filter((u) => u.plan_id === x.id).length }));
    },
  });
  const openPlans = (ex ? plans.data ?? [] : []).filter((x) => x.service_id === serviceId && x.used < x.total_sessions);
  const plan = openPlans.find((x) => x.id === planId);
  const pickPlan = (id: string) => {
    setPlanId(id);
    const x = openPlans.find((y) => y.id === id);
    if (x) setTotal(String(Math.round(x.total_price / x.total_sessions)));
  };

  const pickService = (id: string) => {
    const s = p.services.find((x) => x.id === id);
    setServiceId(id);
    setPlanId("");
    if (s) {
      setTotal(s.default_price ? String(s.default_price) : "");
      setDur(Math.min(s.default_slots, p.maxDur));
    }
  };
  const t = Number(total) || 0;
  const adv = Number(advance) || 0;
  const valid = !!serviceId && phoneOk && !!shownName.trim() && t > 0 && adv >= 0 && adv <= t;

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("book_appointment", {
        p_phone: ph, p_name: shownName.trim(), p_service_id: serviceId, p_appt_date: p.date,
        p_start_slot: p.start, p_slots_count: dur, p_total_amount: t, p_advance_amount: adv,
        ...(adv > 0 ? { p_payment_method: method } : {}),
        ...(plan ? { p_plan_id: plan.id } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Booking saved");
      qc.invalidateQueries();
      p.onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lbl = "mb-1.5 mt-4 block text-sm text-muted-foreground";
  const lastSvc = p.services.find((s) => s.id === ex?.last?.service_id)?.name;
  return (
    <div>
      <h2 className="text-xl font-semibold">{p.walkIn ? "Add patient" : `Book ${p.label}`}</h2>
      <p className="text-sm text-muted-foreground">{fmtDate(p.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>

      <span className={lbl}>Service</span>
      <div className="flex flex-wrap gap-2">
        {p.services.map((s) => <button key={s.id} type="button" className={chip(serviceId === s.id)} onClick={() => pickService(s.id)}>{s.name}</button>)}
      </div>

      {openPlans.length > 0 && (
        <>
          <span className={lbl}>Treatment plan</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(!planId)} onClick={() => setPlanId("")}>No plan</button>
            {openPlans.map((x) => <button key={x.id} type="button" className={chip(planId === x.id)} onClick={() => pickPlan(x.id)}>Session {x.used + 1} of {x.total_sessions}</button>)}
          </div>
        </>
      )}

      <span className={lbl}>Duration</span>
      <div className="flex gap-2">
        {[1, 2, 3].map((n) => (
          <button key={n} type="button" disabled={n > p.maxDur} className={cn(chip(dur === n), n > p.maxDur && "opacity-40")} onClick={() => setDur(n)}>
            {n} slot{n > 1 ? "s" : ""}
          </button>
        ))}
      </div>

      <span className={lbl}>Phone</span>
      <Input inputMode="tel" placeholder="03xx xxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
      {phone && !phoneOk && <p className="mt-1 text-xs text-[#b4443a]">Enter a valid mobile number (03xx xxxxxxx)</p>}
      {ex && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-[#e3f1ed] px-3 py-2 text-sm text-[#2f7d6b]">
          <Users className="size-4" />
          Existing patient · {ex.visits} visit{ex.visits === 1 ? "" : "s"}{ex.last && lastSvc ? `, last ${lastSvc} on ${fmtDate(ex.last.appt_date!, { day: "numeric", month: "short" })}` : ""}
        </div>
      )}

      <span className={lbl}>Patient name</span>
      <Input value={shownName} readOnly={!!ex} className={ex ? "bg-muted" : ""} onChange={(e) => setName(e.target.value)} />

      <div className="grid grid-cols-2 gap-3">
        <div><span className={lbl}>Total (Rs)</span><Input inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value.replace(/\D/g, ""))} /></div>
        <div><span className={lbl}>{p.walkIn ? "Paid now (Rs)" : "Advance (Rs)"}</span><Input inputMode="numeric" value={advance} onChange={(e) => setAdvance(e.target.value.replace(/\D/g, ""))} /></div>
      </div>
      {adv > t && <p className="mt-1 text-xs text-[#b4443a]">Advance cannot be more than the total</p>}

      {adv > 0 && (
        <>
          <span className={lbl}>Payment method</span>
          <div className="flex flex-wrap gap-2">
            {METHODS.map((m) => <button key={m.v} type="button" className={chip(method === m.v)} onClick={() => setMethod(m.v)}>{m.l}</button>)}
          </div>
        </>
      )}

      <div className="mt-4 flex justify-between rounded-lg bg-[#f7e1de] px-3 py-3 text-sm font-semibold text-[#b4443a]">
        <span>Pending after advance</span><span>{money(Math.max(t - adv, 0))}</span>
      </div>
      <Button className="mt-4 w-full" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? "Saving…" : p.walkIn ? "Save patient" : "Save booking"}
      </Button>
    </div>
  );
}
