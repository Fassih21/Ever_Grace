import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMe } from "@/lib/auth";
import { chip } from "@/lib/shared";
import { fmtDate, monthRange, money, todayPK } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/staff")({
  head: () => ({ meta: [{ title: "Staff · Evergrace Clinic" }] }),
  component: Staff,
});

const STATUS = [["present", "Present"], ["late", "Late"], ["half_day", "Half day"], ["absent", "Absent"], ["leave", "Leave"]] as const;
type St = (typeof STATUS)[number][0];
const lbl = "text-xs text-muted-foreground";

function useStaff() {
  return useQuery({ queryKey: ["staff"], queryFn: async () => (await supabase.from("staff").select("*").order("name")).data ?? [] });
}

function Staff() {
  const owner = useMe().data?.role === "owner";
  return (
    <div>
      <h1 className="serif text-2xl md:text-3xl">Staff</h1>
      <p className="mb-5 text-sm text-muted-foreground">Attendance, salaries and team.</p>
      <Tabs defaultValue="attendance">
        <TabsList><TabsTrigger value="attendance">Attendance</TabsTrigger><TabsTrigger value="salary">Salary</TabsTrigger>{owner && <TabsTrigger value="team">Team</TabsTrigger>}</TabsList>
        <TabsContent value="attendance"><Attendance /></TabsContent>
        <TabsContent value="salary"><Salary owner={owner} /></TabsContent>
        {owner && <TabsContent value="team"><Team /></TabsContent>}
      </Tabs>
    </div>
  );
}

function Attendance() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayPK());
  const staff = (useStaff().data ?? []).filter((s) => s.active);
  const att = useQuery({ queryKey: ["att", date], queryFn: async () => (await supabase.from("attendance").select("staff_id,status").eq("work_date", date)).data ?? [] });
  const mark = useMutation({
    mutationFn: async (v: { id: string; s: St }) => {
      const { error } = await supabase.from("attendance").upsert({ staff_id: v.id, work_date: date, status: v.s }, { onConflict: "staff_id,work_date" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["att"] }); qc.invalidateQueries({ queryKey: ["dash"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="mt-4">
      <Input type="date" className="mb-3 w-44 bg-card" max={todayPK()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
      <div className="overflow-hidden rounded-2xl border bg-card">
        {!staff.length ? <p className="p-10 text-center text-sm text-muted-foreground">No staff yet. The owner adds staff in the Team tab.</p> : staff.map((s) => {
          const cur = att.data?.find((a) => a.staff_id === s.id)?.status;
          return (
            <div key={s.id} className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0">
              <div className="min-w-[120px] flex-1 font-semibold">{s.name}</div>
              <div className="flex flex-wrap gap-2">{STATUS.map(([k, l]) => <button key={k} className={cn(chip(cur === k), "px-3 py-1.5")} onClick={() => mark.mutate({ id: s.id, s: k })}>{l}</button>)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Salary({ owner }: { owner: boolean }) {
  const qc = useQueryClient();
  const [month, setMonth] = useState(todayPK().slice(0, 7));
  const staff = (useStaff().data ?? []).filter((s) => s.active);
  const r = monthRange(month);
  const data = useQuery({
    queryKey: ["salary", month],
    queryFn: async () => {
      const [sal, att] = await Promise.all([
        supabase.from("salaries").select("*").eq("month", r.start),
        supabase.from("attendance").select("staff_id,status").gte("work_date", r.start).lte("work_date", r.end),
      ]);
      return { sal: sal.data ?? [], att: att.data ?? [] };
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["salary"] }); qc.invalidateQueries({ queryKey: ["dash"] }); };
  return (
    <div className="mt-4">
      <Input type="month" className="mb-3 w-44 bg-card" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
      <div className="overflow-hidden rounded-2xl border bg-card">
        {!staff.length ? <p className="p-10 text-center text-sm text-muted-foreground">No staff yet.</p> : staff.map((s) => {
          const e = data.data?.sal.find((x) => x.staff_id === s.id);
          const mine = data.data?.att.filter((a) => a.staff_id === s.id) ?? [];
          const lost = mine.filter((a) => a.status === "absent").length + mine.filter((a) => a.status === "half_day").length * 0.5;
          return <SalaryRow key={s.id + month + (e?.status ?? "") + (data.isFetching ? "" : "r")} s={s} e={e} month={r.start} suggest={Math.round((s.base_salary / 30) * lost)} lost={lost} owner={owner} onDone={refresh} />;
        })}
      </div>
    </div>
  );
}

function SalaryRow({ s, e, month, suggest, lost, owner, onDone }: {
  s: { id: string; name: string; base_salary: number }; e?: { id: string; deductions: number; advance: number; net: number; status: "pending" | "paid"; paid_on: string | null } | undefined;
  month: string; suggest: number; lost: number; owner: boolean; onDone: () => void;
}) {
  const [ded, setDed] = useState(String(e?.deductions ?? suggest));
  const [adv, setAdv] = useState(String(e?.advance ?? 0));
  const d = Number(ded) || 0, a = Number(adv) || 0;
  const net = Math.max(s.base_salary - d - a, 0);
  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("salaries").insert({ staff_id: s.id, month, base: s.base_salary, deductions: d, advance: a, net, status: "pending" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Salary entry created"); onDone(); },
    onError: (x: Error) => toast.error(x.message),
  });
  const pay = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("salaries").update({ status: "paid", paid_on: todayPK() }).eq("id", e!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Marked paid"); onDone(); },
    onError: (x: Error) => toast.error(x.message),
  });
  return (
    <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <div className="min-w-[130px] flex-1"><div className="font-semibold">{s.name}</div><div className={lbl}>Base {money(s.base_salary)} · {lost} day{lost === 1 ? "" : "s"} lost</div></div>
      <div className="w-28"><div className={lbl}>Deductions</div><Input inputMode="numeric" disabled={!!e} value={ded} onChange={(x) => setDed(x.target.value.replace(/\D/g, ""))} /></div>
      <div className="w-28"><div className={lbl}>Advance</div><Input inputMode="numeric" disabled={!!e} value={adv} onChange={(x) => setAdv(x.target.value.replace(/\D/g, ""))} /></div>
      <div className="w-28 text-right"><div className={lbl}>Net</div><div className="font-semibold">{money(e ? e.net : net)}</div></div>
      <div className="w-36 text-right">
        {!e ? <Button size="sm" disabled={create.isPending} onClick={() => create.mutate()}>Create entry</Button>
          : e.status === "paid" ? <span className="rounded-full bg-[#e3f1ed] px-2.5 py-1 text-xs font-semibold text-[#2f7d6b]">Paid {e.paid_on ? fmtDate(e.paid_on, { day: "numeric", month: "short" }) : ""}</span>
          : owner ? <Button size="sm" variant="outline" disabled={pay.isPending} onClick={() => pay.mutate()}>Mark paid</Button>
          : <span className="rounded-full bg-[#fdf3dc] px-2.5 py-1 text-xs font-semibold text-[#b7791f]">Pending</span>}
      </div>
    </div>
  );
}

function Team() {
  const qc = useQueryClient();
  const q = useStaff();
  const [n, setN] = useState({ name: "", base: "" });
  const done = () => { qc.invalidateQueries({ queryKey: ["staff"] }); toast.success("Saved"); };
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border bg-card">
      {(q.data ?? []).map((s) => <TeamRow key={s.id + s.updated_at} s={s} onDone={done} />)}
      <div className="flex flex-wrap items-end gap-3 bg-[#f7f9f8] px-4 py-3">
        <div className="min-w-[160px] flex-1"><div className={lbl}>New staff member</div><Input value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} /></div>
        <div className="w-32"><div className={lbl}>Monthly salary</div><Input inputMode="numeric" value={n.base} onChange={(e) => setN({ ...n, base: e.target.value.replace(/\D/g, "") })} /></div>
        <Button disabled={!n.name.trim()} onClick={async () => {
          const { error } = await supabase.from("staff").insert({ name: n.name.trim(), base_salary: Number(n.base) || 0 });
          if (error) { toast.error(error.message); return; }
          setN({ name: "", base: "" }); done();
        }}>Add</Button>
      </div>
    </div>
  );
}

function TeamRow({ s, onDone }: { s: { id: string; name: string; base_salary: number; active: boolean }; onDone: () => void }) {
  const [v, setV] = useState({ name: s.name, base: String(s.base_salary), active: s.active });
  return (
    <div className="flex flex-wrap items-end gap-3 border-b px-4 py-3">
      <div className="min-w-[160px] flex-1"><div className={lbl}>Name</div><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
      <div className="w-32"><div className={lbl}>Monthly salary</div><Input inputMode="numeric" value={v.base} onChange={(e) => setV({ ...v, base: e.target.value.replace(/\D/g, "") })} /></div>
      <div className="flex items-center gap-2 pb-2 text-sm"><Switch checked={v.active} onCheckedChange={(a) => setV({ ...v, active: a })} />Active</div>
      <Button variant="outline" disabled={!v.name.trim()} onClick={async () => {
        const { error } = await supabase.from("staff").update({ name: v.name.trim(), base_salary: Number(v.base) || 0, active: v.active }).eq("id", s.id);
        if (error) toast.error(error.message); else onDone();
      }}>Save</Button>
    </div>
  );
}
