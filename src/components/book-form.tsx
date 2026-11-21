import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { ACTIVE, chip } from "@/lib/shared";
import { fmtDate, normPhone } from "@/lib/format";

export function BookForm(p: {
  walkIn?: boolean;
  date: string; start: number; label: string; maxDur: number;
  slots: { sort_order: number }[]; services: { id: string; name: string; default_price: number; default_slots: number }[];
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [chosen, setChosen] = useState<string[]>([]);
  const [cur, setCur] = useState("");
  const allIds = cur && !chosen.includes(cur) ? [...chosen, cur] : chosen;
  const serviceId = allIds[0] ?? "";
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [dur, setDur] = useState(1);
  const [planId, setPlanId] = useState("");
  const [svcOpen, setSvcOpen] = useState(false);
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
  };

  const pickService = (id: string) => {
    setCur(id);
    setPlanId("");
    if (!chosen.length) {
      const s = p.services.find((x) => x.id === id);
      if (s) setDur(Math.min(s.default_slots, p.maxDur));
    }
  };
  const addCur = () => { if (cur && !chosen.includes(cur)) setChosen([...chosen, cur]); setCur(""); };
  const removeSvc = (id: string) => { setChosen(chosen.filter((x) => x !== id)); setPlanId(""); };
  const valid = !!serviceId && phoneOk && !!shownName.trim();

  const save = useMutation({
    mutationFn: async () => {
      const { data: id, error } = await supabase.rpc("book_appointment", {
        p_phone: ph, p_name: shownName.trim(), p_service_id: serviceId, p_appt_date: p.date,
        p_start_slot: p.start, p_slots_count: dur, p_total_amount: 0, p_discount_amount: 0, p_advance_amount: 0,
        ...(plan ? { p_plan_id: plan.id } : {}),
      });
      if (error) throw error;
      if (allIds.length > 1) {
        const r = await (supabase as any).rpc("set_appointment_extras", { p_appointment_id: id, p_service_ids: allIds.slice(1) });
        if (r.error) throw r.error;
      }
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
      <div className="flex gap-2">
      <Popover open={svcOpen} onOpenChange={setSvcOpen} modal>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" className="min-w-0 flex-1 justify-between font-normal">
            <span className={cn("truncate", !cur && "text-muted-foreground")}>
              {p.services.find((x) => x.id === cur)?.name ?? (chosen.length ? "Add another service…" : "Select service…")}
            </span>
            <ChevronsUpDown className="size-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command>
            <CommandInput placeholder="Search service…" />
            <CommandList>
              <CommandEmpty>No service found.</CommandEmpty>
              {p.services.map((s) => (
                <CommandItem key={s.id} value={s.name} onSelect={() => { pickService(s.id); setSvcOpen(false); }}>
                  <Check className={cn("mr-2 size-4", cur === s.id ? "opacity-100" : "opacity-0")} />
                  {s.name}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Button type="button" variant="outline" disabled={!cur} onClick={addCur}><Plus className="size-4" /> Add</Button>
      </div>
      {chosen.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {chosen.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-[#e3f1ed] px-3 py-1.5 text-sm text-[#2f7d6b]">
              {p.services.find((x) => x.id === id)?.name}
              <button type="button" onClick={() => removeSvc(id)}><X className="size-3.5" /></button>
            </span>
          ))}
        </div>
      )}

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

      <p className="mt-4 text-xs text-muted-foreground">Price baad mein appointment detail se add hogi.</p>
      <Button className="mt-4 w-full" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? "Saving…" : p.walkIn ? "Save patient" : "Save booking"}
      </Button>
    </div>
  );
}
