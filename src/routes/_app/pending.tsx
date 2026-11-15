import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ReceivePayment, type PayTarget } from "@/components/receive-payment";
import { ACTIVE, fetchByIds, pageAll, useServices } from "@/lib/shared";
import { fmtDate, money } from "@/lib/format";

export const Route = createFileRoute("/_app/pending")({
  head: () => ({ meta: [{ title: "Pending · Evergrace Clinic" }] }),
  component: Pending,
});

function Pending() {
  const [pay, setPay] = useState<PayTarget | null>(null);
  const services = useServices().data ?? [];
  const q = useQuery({
    queryKey: ["pending"],
    queryFn: async () => {
      const rows = await pageAll((f, t) => supabase.from("appointment_balance").select("*").gt("balance", 0).in("status", [...ACTIVE]).order("appt_date").range(f, t));
      const ids = [...new Set(rows.map((r) => r.patient_id!))];
      const pts = await fetchByIds(ids, (c) => supabase.from("patients").select("id,name,phone").in("id", c));
      return ids.map((pid) => {
        const p = pts.find((x) => x.id === pid);
        const v = rows.filter((r) => r.patient_id === pid);
        return { pid, name: p?.name ?? "—", phone: p?.phone ?? "", v, due: v.reduce((t, r) => t + r.balance!, 0) };
      }).sort((a, b) => b.due - a.due);
    },
  });
  const total = (q.data ?? []).reduce((t, g) => t + g.due, 0);
  return (
    <div>
      <h1 className="serif text-2xl md:text-3xl">Pending</h1>
      <p className="mb-5 text-sm text-muted-foreground">{q.data ? `${q.data.length} patient${q.data.length === 1 ? "" : "s"} owe ` : ""}<b className="text-[#b4443a]">{money(total)}</b></p>
      {q.isLoading ? <Skeleton className="h-40" /> : !q.data?.length ? (
        <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">Nothing pending. All payments are cleared.</div>
      ) : (
        <div className="space-y-3">
          {q.data.map((g) => (
            <div key={g.pid} className="overflow-hidden rounded-2xl border bg-card">
              <div className="flex items-center justify-between bg-[#f7f9f8] px-4 py-3">
                <Link to="/patients/$id" params={{ id: g.pid }} className="min-w-0"><div className="truncate font-semibold">{g.name}</div><div className="text-xs text-muted-foreground">{g.phone}</div></Link>
                <div className="font-semibold text-[#b4443a]">{money(g.due)}</div>
              </div>
              {g.v.map((a) => (
                <div key={a.id!} className="flex flex-wrap items-center gap-3 border-t px-4 py-3 text-sm">
                  <div className="w-24 font-medium">{fmtDate(a.appt_date!, { day: "numeric", month: "short" })}</div>
                  <div className="min-w-0 flex-1 text-muted-foreground">{services.find((s) => s.id === a.service_id)?.name} · paid {money(a.paid_total ?? 0)} of {money(a.total_amount!)}</div>
                  <Button size="sm" variant="outline" onClick={() => setPay({ id: a.id!, balance: a.balance!, who: g.name })}>Receive {money(a.balance!)}</Button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      <ReceivePayment target={pay} onClose={() => setPay(null)} />
    </div>
  );
}
