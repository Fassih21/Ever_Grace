import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Plus, Search } from "lucide-react";
import { StageQueue, STAGES, useStages, type StageKey } from "@/components/stage-queue";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { BookForm } from "@/components/book-form";
import { MakeInvoice, type InvTarget } from "@/components/make-invoice";
import { useIsMobile } from "@/hooks/use-mobile";
import { ACTIVE, calcMaxDur, chip, pageAll, useDayAppts, useServices, useSlots } from "@/lib/shared";
import { fmtDate, fmtTime, initials, todayPK } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/patients/")({
  head: () => ({ meta: [{ title: "Patients · Evergrace Clinic" }] }),
  component: Patients,
});

const Avatar = ({ name }: { name: string }) => (
  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#e3f1ed] text-xs font-bold text-[#2f7d6b]">{initials(name)}</div>
);
const InvBtn = ({ onClick }: { onClick: (e: React.MouseEvent) => void }) => (
  <Button size="sm" variant="outline" onClick={onClick}>Make invoice</Button>
);

function Patients() {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const today = todayPK();
  const [tab, setTab] = useState<"today" | "all">("today");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [slot, setSlot] = useState<number | null>(null);
  const [inv, setInv] = useState<InvTarget | null>(null);
  const [queue, setQueue] = useState<StageKey | null>(null);
  const stages = useStages().data;
  const slots = useSlots().data ?? [];
  const services = useServices().data ?? [];
  const day = useDayAppts(today);
  const rows = day.data ?? [];
  const term = q.trim().toLowerCase();
  const isNum = /^[\d\s+-]+$/.test(term);
  const hit = (name: string, phone: string) => !term || name.toLowerCase().includes(term) || (isNum && phone.includes(term.replace(/\D/g, "")));

  const all = useQuery({
    queryKey: ["patients-all"],
    queryFn: async () => {
      const pts = await pageAll((f, t) => supabase.from("patients").select("id,name,phone").order("name").range(f, t));
      const ap = await pageAll((f, t) => supabase.from("appointment_balance").select("patient_id,balance").in("status", [...ACTIVE]).range(f, t));
      const agg = new Map<string, { v: number; due: number }>();
      ap.forEach((a) => {
        const x = agg.get(a.patient_id!) ?? { v: 0, due: 0 };
        x.v++; x.due += a.balance ?? 0;
        agg.set(a.patient_id!, x);
      });
      return pts.map((p) => ({ ...p, visits: agg.get(p.id)?.v ?? 0, due: agg.get(p.id)?.due ?? 0 }));
    },
  });

  const freeSlots = slots.filter((s) => !rows.some((r) => s.sort_order >= r.start_slot! && s.sort_order < r.start_slot! + r.slots_count!));
  const chosen = slots.find((s) => s.sort_order === slot);
  const close = () => { setAdding(false); setSlot(null); };
  const todayRows = rows.filter((r) => hit(r.patient, r.phone)).sort((a, b) => a.start_slot! - b.start_slot!);
  const allRows = (all.data ?? []).filter((p) => hit(p.name, p.phone));

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="serif text-2xl md:text-3xl">Patients</h1>
          <p className="text-sm text-muted-foreground">{fmtDate(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button><Plus /> Add patient <ChevronDown className="size-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {STAGES.map((x) => (
              <DropdownMenuItem key={x.k} onSelect={() => (x.k === "registered" ? setInv({ name: "", phone: "" }) : setQueue(x.k))} className="justify-between">
                {x.label}
                {"from" in x && <span className="text-xs text-muted-foreground">{rows.filter((r) => (stages?.get(r.id!) ?? "registered") === x.from).length || ""}</span>}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onSelect={() => setAdding(true)}>Book walk-in appointment</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex rounded-xl bg-[#e5eae8] p-1">
          {([["today", `Today · ${rows.length}`], ["all", `All${all.data ? ` · ${all.data.length}` : ""}`]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={cn("rounded-lg px-4 py-2 text-sm font-semibold", tab === k ? "bg-card shadow-sm" : "text-muted-foreground")}>{l}</button>
          ))}
        </div>
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input className="bg-card pl-9" placeholder="Search name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        {tab === "today" ? (
          day.isLoading ? <Skeleton className="m-4 h-40" /> : todayRows.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">No patients booked today.</p>
          ) : (
            <>
              {todayRows.map((r) => (
                <Link key={r.id} to="/patients/$id" params={{ id: r.patient_id! }} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3.5 hover:bg-accent/40">
                  <div className="w-28 text-sm font-semibold tabular-nums">
                    {fmtTime(slots.find((s) => s.sort_order === r.start_slot)?.start_time ?? "0:00")} – {fmtTime(slots.find((s) => s.sort_order === r.start_slot! + r.slots_count! - 1)?.end_time ?? "0:00")}
                  </div>
                  <Avatar name={r.patient} />
                  <div className="min-w-0 flex-1"><div className="truncate font-semibold">{r.patient}</div><div className="text-sm text-muted-foreground">{r.phone}</div></div>
                  <InvBtn onClick={(e) => { e.preventDefault(); e.stopPropagation(); setInv({ name: r.patient, phone: r.phone }); }} />
                </Link>
              ))}

            </>
          )
        ) : all.isLoading ? <Skeleton className="m-4 h-40" /> : allRows.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">No patients found.</p>
        ) : (
          allRows.map((p) => (
            <Link key={p.id} to="/patients/$id" params={{ id: p.id }} className="flex items-center gap-4 border-b px-4 py-3.5 last:border-b-0 hover:bg-accent/40">
              <Avatar name={p.name} />
              <div className="min-w-0 flex-1"><div className="truncate font-semibold">{p.name}</div><div className="text-sm text-muted-foreground">{p.phone}</div></div>
              <div className="text-sm text-muted-foreground">{p.visits} visit{p.visits === 1 ? "" : "s"}</div>
              <InvBtn onClick={(e) => { e.preventDefault(); e.stopPropagation(); setInv({ name: p.name, phone: p.phone }); }} />
            </Link>
          ))
        )}
      </div>

      <Sheet open={adding} onOpenChange={(o) => !o && close()}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={cn("overflow-y-auto px-5 pb-8", isMobile ? "max-h-[92vh] rounded-t-3xl" : "w-[420px] sm:max-w-[420px]")}>
          <SheetHeader className="sr-only"><SheetTitle>Add patient</SheetTitle></SheetHeader>
          {!chosen ? (
            <div className="pt-6">
              <h2 className="text-xl font-semibold">Add patient</h2>
              <p className="mb-4 text-sm text-muted-foreground">Today’s visit, one step. Choose a free slot.</p>
              {freeSlots.length ? (
                <div className="flex flex-wrap gap-2">
                  {freeSlots.map((s) => <button key={s.id} className={chip(false)} onClick={() => setSlot(s.sort_order)}>{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</button>)}
                </div>
              ) : <p className="text-sm text-muted-foreground">All slots are booked today.</p>}
            </div>
          ) : (
            <div className="pt-6">
              <BookForm walkIn key={slot} date={today} start={chosen.sort_order} label={`${fmtTime(chosen.start_time)} – ${fmtTime(chosen.end_time)}`}
                maxDur={calcMaxDur(slots, rows, chosen.sort_order)} slots={slots} services={services}
                onDone={() => { close(); qc.invalidateQueries(); }} />
            </div>
          )}
        </SheetContent>
      </Sheet>
      <StageQueue stage={queue} onClose={() => setQueue(null)} />
      <MakeInvoice target={inv} onClose={() => setInv(null)} />
    </div>
  );
}