import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { OwnerOnly } from "@/components/owner-only";
import { ACTIVE, pageAll, useDayAppts, useServices, useSlots } from "@/lib/shared";
import { addDays, fmtDate, fmtTime, money, todayPK } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · Evergrace Clinic" }] }),
  component: () => <OwnerOnly><Dashboard /></OwnerOnly>,
});

const sum = (a: { amount: number }[]) => a.reduce((t, x) => t + x.amount, 0);
const pk = (d: string) => `${d}T00:00:00+05:00`;

function Dashboard() {
  const today = todayPK();
  const [mode, setMode] = useState<"today" | "month">("today");
  const start = mode === "today" ? today : today.slice(0, 8) + "01";
  const services = useServices().data ?? [];
  const slots = useSlots().data ?? [];
  const day = useDayAppts(today);

  const d = useQuery({
    queryKey: ["dash", mode, today],
    queryFn: async () => {
      const [pay, exp, sal, open, appts] = await Promise.all([
        pageAll((f, t) => supabase.from("payments").select("amount,appointment_id").eq("voided", false).gte("paid_at", pk(start)).lt("paid_at", pk(addDays(today, 1))).range(f, t)),
        pageAll((f, t) => supabase.from("expenses").select("amount").gte("spent_on", start).lte("spent_on", today).range(f, t)),
        pageAll((f, t) => supabase.from("salaries").select("net").eq("status", "paid").gte("paid_on", start).lte("paid_on", today).range(f, t)),
        pageAll((f, t) => supabase.from("appointment_balance").select("patient_id,balance").gt("balance", 0).in("status", [...ACTIVE]).range(f, t)),
        pageAll((f, t) => supabase.from("appointments").select("id,service_id").order("id").range(f, t)),
      ]);
      const owing = new Set(open.map((a) => a.patient_id));
      const svcOf = new Map(appts.map((a) => [a.id, a.service_id]));
      const bySvc = new Map<string, number>();
      pay.forEach((x) => {
        const sid = svcOf.get(x.appointment_id);
        if (sid) bySvc.set(sid, (bySvc.get(sid) ?? 0) + x.amount);
      });
      const salaries = sal.reduce((t, x) => t + x.net, 0);
      return { collected: sum(pay), expenses: sum(exp) + salaries, salaries, pending: open.reduce((t, a) => t + (a.balance ?? 0), 0), owing: owing.size, bySvc };
    },
  });

  const chart = useQuery({
    queryKey: ["dash", "chart", today],
    queryFn: async () => {
      const months = Array.from({ length: 6 }, (_, i) => {
        const dt = new Date(today.slice(0, 7) + "-01T00:00:00Z");
        dt.setUTCMonth(dt.getUTCMonth() - (5 - i));
        return dt.toISOString().slice(0, 7);
      });
      const from = months[0] + "-01";
      const [pay, exp, sal] = await Promise.all([
        pageAll((f, t) => supabase.from("payments").select("amount,paid_at").eq("voided", false).gte("paid_at", pk(from)).range(f, t)),
        pageAll((f, t) => supabase.from("expenses").select("amount,spent_on").gte("spent_on", from).range(f, t)),
        pageAll((f, t) => supabase.from("salaries").select("net,paid_on").eq("status", "paid").gte("paid_on", from).range(f, t)),
      ]);
      return months.map((m) => ({
        m,
        c: pay.filter((p) => new Date(new Date(p.paid_at).getTime() + 5 * 3600e3).toISOString().slice(0, 7) === m).reduce((t, p) => t + p.amount, 0),
        e: exp.filter((x) => x.spent_on.slice(0, 7) === m).reduce((t, x) => t + x.amount, 0)
          + sal.filter((x) => x.paid_on?.slice(0, 7) === m).reduce((t, x) => t + x.net, 0),
      }));
    },
  });

  const staff = useQuery({
    queryKey: ["dash", "staff", today],
    queryFn: async () => {
      const [s, a, sal] = await Promise.all([
        supabase.from("staff").select("id").eq("active", true),
        supabase.from("attendance").select("status").eq("work_date", today),
        supabase.from("salaries").select("net").eq("status", "pending"),
      ]);
      return {
        total: s.data?.length ?? 0,
        present: (a.data ?? []).filter((x) => ["present", "late", "half_day"].includes(x.status)).length,
        owed: (sal.data ?? []).reduce((t, x) => t + x.net, 0),
      };
    },
  });

  const v = d.data;
  const kpis = [
    [mode === "today" ? "Collected today" : "Collected this month", v ? money(v.collected) : "", "Payments received", "border-l-[#2f7d6b]"],
    ["Pending (all time)", v ? money(v.pending) : "", v ? `${v.owing} patient${v.owing === 1 ? "" : "s"} owe` : "", "border-l-[#b7791f]"],
    [mode === "today" ? "Expenses today" : "Expenses this month", v ? money(v.expenses) : "", v ? `Incl. salaries paid ${money(v.salaries)}` : "", "border-l-[#e9b8b0]"],
    ["Net", v ? money(v.collected - v.expenses) : "", "Collected − expenses − salaries", "bg-[#14211f] text-white border-0"],
  ];
  const rev = [...(v?.bySvc ?? [])].sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rev.map((r) => r[1]), 0);
  const cmax = Math.max(1, ...(chart.data ?? []).flatMap((c) => [c.c, c.e]));
  const rows = [...(day.data ?? [])].sort((a, b) => a.start_slot! - b.start_slot!);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="serif text-2xl md:text-3xl">Dashboard</h1><p className="text-sm text-muted-foreground">{fmtDate(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p></div>
        <div className="flex rounded-xl bg-[#e5eae8] p-1">
          {(["today", "month"] as const).map((k) => <button key={k} onClick={() => setMode(k)} className={cn("rounded-lg px-5 py-2 text-sm font-semibold capitalize", mode === k ? "bg-card shadow-sm" : "text-muted-foreground")}>{k === "today" ? "Today" : "Month"}</button>)}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(([l, val, sub, c], i) => (
          <div key={l} className={cn("rounded-2xl border border-l-4 bg-card p-4", c)}>
            <div className={cn("text-xs", i === 3 ? "text-[#9ebdb5]" : "text-muted-foreground")}>{l}</div>
            {d.isLoading ? <Skeleton className="mt-2 h-8 w-24" /> : <div className="serif mt-1 text-xl md:text-3xl">{val}</div>}
            <div className={cn("mt-1 text-xs", i === 3 ? "text-[#9ebdb5]" : "text-muted-foreground")}>{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-5">
            <h3 className="mb-3 flex justify-between font-semibold">Today’s schedule<small className="font-medium text-muted-foreground">{rows.length} booking{rows.length === 1 ? "" : "s"} today</small></h3>
            {slots.map((s) => {
              const a = rows.find((r) => r.start_slot === s.sort_order);
              if (!a && rows.some((r) => s.sort_order > r.start_slot! && s.sort_order < r.start_slot! + r.slots_count!)) return null;
              const end = a ? slots.find((x) => x.sort_order === a.start_slot! + a.slots_count! - 1) ?? s : s;
              return (
                <div key={s.id} className="flex items-center gap-3 border-t py-2.5 text-sm first:border-t-0">
                  <div className="w-28 shrink-0 text-muted-foreground tabular-nums">{fmtTime(s.start_time)} – {fmtTime(end.end_time)}</div>
                  <div className="min-w-0 flex-1">{a ? <><b>{a.patient}</b><span className="text-muted-foreground"> · {services.find((x) => x.id === a.service_id)?.name}{a.slots_count! > 1 ? ` · ${a.slots_count} slots` : ""}</span></> : <span className="text-muted-foreground">Open slot</span>}</div>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", !a ? "border border-dashed text-muted-foreground" : a.status === "completed" ? "bg-[#e3f1ed] text-[#2f7d6b]" : "bg-[#e8eefb] text-[#3a5bb0]")}>{!a ? "Free" : a.status === "completed" ? "Completed" : "Booked"}</span>
                </div>
              );
            })}
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <h3 className="mb-3 flex justify-between font-semibold">Revenue by service<small className="font-medium text-muted-foreground">{mode === "today" ? "Today" : "This month"}</small></h3>
            {!rev.length ? <p className="text-sm text-muted-foreground">No payments on these visits yet.</p> : rev.map(([id, amt]) => (
              <div key={id} className="my-3 flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0">{services.find((s) => s.id === id)?.name ?? "Service"}</span>
                <div className="h-2.5 flex-1 rounded-full bg-[#eef1f0]"><div className="h-full rounded-full bg-[#2f7d6b]" style={{ width: `${(amt / max) * 100}%` }} /></div>
                <b className="w-24 text-right">{money(amt)}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-5">
            <h3 className="mb-3 flex justify-between font-semibold">Last 6 months<small className="font-medium text-muted-foreground"><span className="text-[#2f7d6b]">●</span> Collected <span className="text-[#e9b8b0]">●</span> Expenses</small></h3>
            {chart.isLoading ? <Skeleton className="h-40" /> : (
              <svg viewBox="0 0 330 150" width="100%">
                {(chart.data ?? []).map((c, i) => (
                  <g key={c.m}>
                    <rect x={i * 54 + 8} y={130 - (c.c / cmax) * 120} width="18" height={(c.c / cmax) * 120} rx="4" fill="#2f7d6b" />
                    <rect x={i * 54 + 28} y={130 - (c.e / cmax) * 120} width="18" height={(c.e / cmax) * 120} rx="4" fill="#e9b8b0" />
                    <text x={i * 54 + 27} y="146" fontSize="10.5" fill="#6b7a77" textAnchor="middle">{fmtDate(c.m + "-01", { month: "short" })}</text>
                  </g>
                ))}
              </svg>
            )}
          </div>
          <div className="rounded-2xl border bg-card p-5">
            <h3 className="mb-3 font-semibold">Staff</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><div className="text-xs text-muted-foreground">Present today</div><div className="serif text-2xl">{staff.data ? `${staff.data.present} / ${staff.data.total}` : "–"}</div></div>
              <div><div className="text-xs text-muted-foreground">Salaries pending</div><div className="serif text-2xl text-[#b7791f]">{staff.data ? money(staff.data.owed) : "–"}</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}